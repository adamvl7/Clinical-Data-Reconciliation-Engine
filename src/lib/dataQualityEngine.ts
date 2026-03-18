import type { DataQualityRequest, DataQualityResponse, DataQualityIssue } from "./types";
import { checkVitalSigns } from "./clinicalRules";
import { validatePlausibilityLLM } from "./llm/geminiClient";

// ── Completeness Scoring ──

function scoreCompleteness(record: DataQualityRequest): {
  score: number;
  issues: DataQualityIssue[];
} {
  const issues: DataQualityIssue[] = [];
  let filled = 0;
  const totalFields = 7;

  if (record.demographics?.name) filled++;
  else issues.push({ field: "demographics.name", issue: "Patient name is missing", severity: "medium" });

  if (record.demographics?.dob) filled++;
  else issues.push({ field: "demographics.dob", issue: "Date of birth is missing", severity: "medium" });

  if (record.demographics?.gender) filled++;
  else issues.push({ field: "demographics.gender", issue: "Gender is missing", severity: "low" });

  if (record.medications && record.medications.length > 0) filled++;
  else issues.push({ field: "medications", issue: "No medications documented", severity: "medium" });

  if (record.allergies && record.allergies.length > 0) filled++;
  else
    issues.push({
      field: "allergies",
      issue: "No allergies documented - likely incomplete",
      severity: "medium",
    });

  if (record.conditions && record.conditions.length > 0) filled++;
  else issues.push({ field: "conditions", issue: "No conditions documented", severity: "medium" });

  if (record.vital_signs && Object.keys(record.vital_signs).length > 0) filled++;
  else issues.push({ field: "vital_signs", issue: "No vital signs documented", severity: "medium" });

  const score = Math.round((filled / totalFields) * 100);
  return { score, issues };
}

// ── Accuracy Scoring ──

function scoreAccuracy(record: DataQualityRequest): {
  score: number;
  issues: DataQualityIssue[];
} {
  const issues: DataQualityIssue[] = [];
  let deductions = 0;

  // Check DOB validity
  if (record.demographics?.dob) {
    const dob = new Date(record.demographics.dob);
    if (isNaN(dob.getTime())) {
      issues.push({ field: "demographics.dob", issue: "Invalid date format", severity: "high" });
      deductions += 20;
    } else {
      const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 0 || age > 130) {
        issues.push({
          field: "demographics.dob",
          issue: `Calculated age (${Math.round(age)}) is implausible`,
          severity: "high",
        });
        deductions += 15;
      }
    }
  }

  // Check vital signs for physiologic plausibility
  if (record.vital_signs) {
    const vitalIssues = checkVitalSigns(record.vital_signs);
    issues.push(...vitalIssues);
    deductions += vitalIssues.length * 15;
  }

  // Check for obviously malformed medication entries
  for (const med of record.medications) {
    if (med.trim().length < 2) {
      issues.push({
        field: "medications",
        issue: `Medication entry "${med}" appears malformed`,
        severity: "medium",
      });
      deductions += 5;
    }
  }

  const score = Math.max(0, 100 - deductions);
  return { score, issues };
}

// ── Timeliness Scoring ──

function scoreTimeliness(record: DataQualityRequest): {
  score: number;
  issues: DataQualityIssue[];
} {
  const issues: DataQualityIssue[] = [];

  if (!record.last_updated) {
    return {
      score: 50,
      issues: [
        { field: "last_updated", issue: "No last_updated timestamp provided", severity: "medium" },
      ],
    };
  }

  const updated = new Date(record.last_updated);
  if (isNaN(updated.getTime())) {
    return {
      score: 40,
      issues: [
        { field: "last_updated", issue: "Invalid last_updated date format", severity: "medium" },
      ],
    };
  }

  const monthsSince =
    (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24 * 30);

  let score: number;
  if (monthsSince < 1) score = 100;
  else if (monthsSince < 3) score = 90;
  else if (monthsSince < 6) score = 75;
  else if (monthsSince < 12) score = 55;
  else score = 30;

  if (monthsSince > 6) {
    issues.push({
      field: "last_updated",
      issue: `Data is ${Math.round(monthsSince)}+ months old`,
      severity: monthsSince > 12 ? "high" : "medium",
    });
  }

  return { score, issues };
}

// ── Clinical Plausibility (heuristic + LLM) ──

async function scoreClinicalPlausibility(record: DataQualityRequest): Promise<{
  score: number;
  issues: DataQualityIssue[];
}> {
  const issues: DataQualityIssue[] = [];
  let deductions = 0;

  // Heuristic: vital signs check (also counted in accuracy, but from clinical angle)
  if (record.vital_signs) {
    const vitalIssues = checkVitalSigns(record.vital_signs);
    deductions += vitalIssues.length * 20;
  }

  // LLM-based plausibility check
  try {
    const llmResult = await validatePlausibilityLLM(record as unknown as Record<string, unknown>);
    for (const issue of llmResult.issues) {
      // Avoid exact duplicates from heuristic checks
      const isDuplicate = issues.some(
        (existing) => existing.field === issue.field && existing.issue === issue.issue
      );
      if (!isDuplicate) {
        issues.push(issue);
        deductions += issue.severity === "high" ? 20 : issue.severity === "medium" ? 10 : 5;
      }
    }
  } catch (err) {
    console.error("LLM plausibility check failed, using heuristics only:", err);
  }

  const score = Math.max(0, 100 - deductions);
  return { score, issues };
}

// ── Main Evaluation Function ──

export async function evaluateDataQuality(
  record: DataQualityRequest
): Promise<DataQualityResponse> {
  const completeness = scoreCompleteness(record);
  const accuracy = scoreAccuracy(record);
  const timeliness = scoreTimeliness(record);
  const plausibility = await scoreClinicalPlausibility(record);

  // Collect rule-based issues first (completeness, accuracy, timeliness),
  // then add LLM issues only if no rule-based issue already covers that field.
  const allIssuesMap = new Map<string, DataQualityIssue>();
  const coveredFields = new Set<string>();

  const addRuleIssues = (items: DataQualityIssue[]) => {
    for (const issue of items) {
      const key = `${issue.field}:${issue.issue}`;
      if (!allIssuesMap.has(key)) {
        allIssuesMap.set(key, issue);
        coveredFields.add(issue.field);
        // Also mark the parent field as covered (e.g. "demographics" for "demographics.name")
        const parentField = issue.field.split(".")[0];
        coveredFields.add(parentField);
      }
    }
  };

  addRuleIssues(completeness.issues);
  addRuleIssues(accuracy.issues);
  addRuleIssues(timeliness.issues);

  // LLM issues: skip if the field (or any sub-field) is already covered
  for (const issue of plausibility.issues) {
    const key = `${issue.field}:${issue.issue}`;
    if (allIssuesMap.has(key)) continue;

    const fieldBase = issue.field.split(".")[0];
    const alreadyCovered =
      coveredFields.has(issue.field) ||
      coveredFields.has(fieldBase) ||
      Array.from(coveredFields).some((f) => f.startsWith(issue.field + ".") || issue.field.startsWith(f + "."));

    if (!alreadyCovered) {
      allIssuesMap.set(key, issue);
      coveredFields.add(issue.field);
    }
  }

  const overallScore = Math.round(
    completeness.score * 0.25 +
      accuracy.score * 0.30 +
      timeliness.score * 0.20 +
      plausibility.score * 0.25
  );

  return {
    overall_score: overallScore,
    breakdown: {
      completeness: completeness.score,
      accuracy: accuracy.score,
      timeliness: timeliness.score,
      clinical_plausibility: plausibility.score,
    },
    issues_detected: Array.from(allIssuesMap.values()),
  };
}
