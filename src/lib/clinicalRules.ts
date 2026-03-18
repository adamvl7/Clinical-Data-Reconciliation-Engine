import type { PatientContext, DataQualityIssue } from "./types";

// Physiologic vital sign ranges
const VITAL_RANGES: Record<string, { min: number; max: number; label: string }> = {
  heart_rate: { min: 20, max: 250, label: "Heart Rate" },
  temperature: { min: 85, max: 110, label: "Temperature (F)" },
  respiratory_rate: { min: 4, max: 60, label: "Respiratory Rate" },
  oxygen_saturation: { min: 50, max: 100, label: "Oxygen Saturation" },
};

function parseBP(value: string | number): { systolic: number; diastolic: number } | null {
  const str = String(value);
  const match = str.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;
  return { systolic: parseInt(match[1], 10), diastolic: parseInt(match[2], 10) };
}

export function checkVitalSigns(
  vitalSigns: Record<string, string | number>
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  for (const [key, value] of Object.entries(vitalSigns)) {
    if (key === "blood_pressure") {
      const bp = parseBP(value);
      if (bp) {
        if (bp.systolic < 40 || bp.systolic > 300) {
          issues.push({
            field: `vital_signs.${key}`,
            issue: `Blood pressure systolic ${bp.systolic} is physiologically implausible`,
            severity: "high",
          });
        }
        if (bp.diastolic < 20 || bp.diastolic > 200) {
          issues.push({
            field: `vital_signs.${key}`,
            issue: `Blood pressure diastolic ${bp.diastolic} is physiologically implausible`,
            severity: "high",
          });
        }
        if (bp.systolic <= bp.diastolic) {
          issues.push({
            field: `vital_signs.${key}`,
            issue: `Systolic (${bp.systolic}) should be greater than diastolic (${bp.diastolic})`,
            severity: "high",
          });
        }
      }
      continue;
    }

    const numValue = typeof value === "number" ? value : parseFloat(String(value));
    if (isNaN(numValue)) continue;

    const range = VITAL_RANGES[key];
    if (range && (numValue < range.min || numValue > range.max)) {
      issues.push({
        field: `vital_signs.${key}`,
        issue: `${range.label} value ${numValue} is outside plausible range (${range.min}–${range.max})`,
        severity: "high",
      });
    }
  }

  return issues;
}

/**
 * Basic clinical compatibility check: returns a score 0–1 indicating how well
 * the medication fits the patient's clinical context (higher = better fit).
 */
export function clinicalCompatibilityScore(
  medication: string,
  context: PatientContext
): number {
  let score = 0.7; // neutral baseline
  const medLower = medication.toLowerCase();

  // Metformin + kidney function check
  if (medLower.includes("metformin")) {
    const egfr = context.recent_labs?.eGFR ?? context.recent_labs?.egfr;
    if (egfr !== undefined) {
      if (egfr < 30) score -= 0.3; // contraindicated
      else if (egfr <= 45) score -= 0.1; // dose reduction recommended
    }

    const doseMatch = medLower.match(/(\d+)\s*mg/);
    if (doseMatch && egfr !== undefined && egfr <= 45) {
      const dose = parseInt(doseMatch[1], 10);
      if (dose <= 500) score += 0.15; // appropriately reduced
      else score -= 0.1; // too high for kidney function
    }
  }

  // Check if medication class matches conditions
  const conditionsLower = context.conditions.map((c) => c.toLowerCase());
  if (medLower.includes("metformin") && conditionsLower.some((c) => c.includes("diabetes"))) {
    score += 0.1;
  }
  if (medLower.includes("lisinopril") && conditionsLower.some((c) => c.includes("hypertension"))) {
    score += 0.1;
  }
  if (medLower.includes("aspirin") && context.age && context.age > 50) {
    score += 0.05;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Simple safety check: returns "PASSED" or "FLAGGED" with a reason.
 */
export function clinicalSafetyCheck(
  medication: string,
  context: PatientContext
): { status: "PASSED" | "FLAGGED"; reason?: string } {
  const medLower = medication.toLowerCase();

  const egfr = context.recent_labs?.eGFR ?? context.recent_labs?.egfr;

  if (medLower.includes("metformin") && egfr !== undefined && egfr < 30) {
    return {
      status: "FLAGGED",
      reason: `Metformin is generally not recommended when kidney function is very low (your eGFR: ${egfr}). Please consult your doctor.`,
    };
  }

  const doseMatch = medLower.match(/(\d+)\s*mg/);
  if (doseMatch) {
    const dose = parseInt(doseMatch[1], 10);
    if (medLower.includes("metformin") && dose > 2000) {
      return {
        status: "FLAGGED",
        reason: `The Metformin dose of ${dose}mg exceeds the typical maximum of 2000mg. Please verify this with your doctor.`,
      };
    }
  }

  return { status: "PASSED" };
}
