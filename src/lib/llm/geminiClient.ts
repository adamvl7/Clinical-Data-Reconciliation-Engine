import { GoogleGenAI } from "@google/genai";
import { cacheKey, getCachedOrFetch } from "../cache";
import type { MedicationSource, PatientContext } from "../types";

let ai: GoogleGenAI | null = null;

export function isDemoMode(): boolean {
  return !process.env.GEMINI_API_KEY;
}

function getClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

const MODEL = "gemini-2.5-flash";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function callGemini(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const client = getClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
        },
      });

      return response.text ?? "";
    } catch (err: unknown) {
      lastError = err as Error;
      const status = (err as { status?: number }).status;
      if (status === 429 || status === 503 || status === 500) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("LLM call failed after retries");
}

function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];
  return text;
}

// ── Reconciliation LLM Call ──

interface ReconciliationLLMResult {
  reconciled_medication: string;
  reasoning: string;
  recommended_actions: string[];
  safety_concerns: string | null;
  llm_certainty: number;
}

/**
 * Selects the reconciled medication (drug + dose + frequency) and provides
 * clinical reasoning.
 *
 * **Real mode** -- sends patient context, all source records, and the
 * pre-computed heuristic ranking to Gemini, which returns the reconciled
 * medication string, reasoning, recommended actions, safety concerns, and a
 * self-assessed certainty (0--1).  The returned medication string is used
 * verbatim; no deterministic dose comparison is performed.
 *
 * **Demo mode** (no `GEMINI_API_KEY`) -- picks the most recent source by
 * `last_updated` / `last_filled` date and returns its medication string as-is,
 * with a fixed `llm_certainty` of 0.82.
 */
export async function reconcileMedicationLLM(
  sources: MedicationSource[],
  patientContext: PatientContext,
  heuristicRanking: string
): Promise<ReconciliationLLMResult> {
  if (isDemoMode()) {
    const mostRecent = [...sources].sort((a, b) => {
      const dateA = new Date(a.last_updated ?? a.last_filled ?? "2000-01-01").getTime();
      const dateB = new Date(b.last_updated ?? b.last_filled ?? "2000-01-01").getTime();
      return dateB - dateA;
    })[0];

    const egfr = patientContext.recent_labs?.eGFR ?? patientContext.recent_labs?.egfr;
    const hasDiabetes = patientContext.conditions.some((c) =>
      c.toLowerCase().includes("diabetes")
    );

    return {
      reconciled_medication: mostRecent.medication,
      reasoning: `[DEMO] The most recent clinical record from ${mostRecent.system} was prioritized. ${
        egfr !== undefined && egfr <= 45
          ? `Given reduced kidney function (eGFR ${egfr}), a lower dose is clinically appropriate. `
          : ""
      }${hasDiabetes ? "This medication is consistent with your documented diabetic condition. " : ""}Source reliability and recency weighting favored this selection.`,
      recommended_actions: [
        `Confirm continuation of ${mostRecent.medication} as recorded in ${mostRecent.system}.`,
        "Ensure all your health records reflect the reconciled medication.",
        "Schedule a follow-up appointment to monitor for any side effects.",
      ],
      safety_concerns:
        egfr !== undefined && egfr <= 30
          ? `Your kidney function (eGFR ${egfr}) is critically low — please discuss this medication with your doctor before continuing.`
          : null,
      llm_certainty: 0.82,
    };
  }

  const key = cacheKey("reconcile", { sources, patientContext });

  return getCachedOrFetch(key, async () => {
    const systemPrompt = `You are a clinical pharmacist AI assistant specializing in medication reconciliation.
Your job is to analyze conflicting medication records from different healthcare systems and determine the most likely accurate medication information.

IMPORTANT: Your output will be shown directly to the patient. Write all text — reasoning, recommended actions, and safety concerns — in clear, patient-friendly language. Do NOT use phrases like "with the patient" or "the patient should" — instead address the reader directly (e.g., "Confirm continuation of Lisinopril 10mg daily." not "Confirm continuation of Lisinopril 10mg daily with the patient."). Avoid clinical jargon where possible.

You MUST respond with valid JSON only, no other text. Use this exact schema:
{
  "reconciled_medication": "string - the most likely correct medication with dose and frequency",
  "reasoning": "string - 2-4 sentence explanation of why this medication was selected, written for the patient",
  "recommended_actions": ["array of actionable recommendations written for the patient"],
  "safety_concerns": "string or null - any safety issues identified, explained in plain language",
  "llm_certainty": number between 0 and 1 representing your confidence
}`;

    const userPrompt = `Patient Context:
- Age: ${patientContext.age ?? "unknown"}
- Conditions: ${patientContext.conditions.length > 0 ? patientContext.conditions.join(", ") : "none documented"}
- Recent Labs: ${Object.keys(patientContext.recent_labs).length > 0 ? JSON.stringify(patientContext.recent_labs) : "none available"}

Conflicting Medication Records:
${sources.map((s, i) => `${i + 1}. ${s.system}: "${s.medication}" (updated: ${s.last_updated ?? s.last_filled ?? "unknown"}, reliability: ${s.source_reliability})`).join("\n")}

Heuristic Analysis:
${heuristicRanking}

Determine the most likely accurate medication, explain your clinical reasoning, and flag any safety concerns.`;

    const raw = await callGemini(systemPrompt, userPrompt);
    try {
      return JSON.parse(extractJSON(raw)) as ReconciliationLLMResult;
    } catch {
      return {
        reconciled_medication: sources[0]?.medication ?? "Unknown",
        reasoning: raw.slice(0, 500),
        recommended_actions: ["Review records manually"],
        safety_concerns: null,
        llm_certainty: 0.5,
      };
    }
  });
}

// ── Data Quality LLM Call ──

interface PlausibilityLLMResult {
  issues: Array<{
    field: string;
    issue: string;
    severity: "high" | "medium" | "low";
  }>;
  overall_assessment: string;
}

export async function validatePlausibilityLLM(
  record: Record<string, unknown>
): Promise<PlausibilityLLMResult> {
  if (isDemoMode()) {
    const issues: PlausibilityLLMResult["issues"] = [];
    const medications = (record.medications as string[] | undefined) ?? [];
    const conditions = (record.conditions as string[] | undefined) ?? [];
    const hasDiabetes = conditions.some((c) => c.toLowerCase().includes("diabetes"));
    const hasMetformin = medications.some((m) => m.toLowerCase().includes("metformin"));

    if (hasDiabetes && !hasMetformin && medications.length > 0) {
      issues.push({
        field: "medications",
        issue: "You have Type 2 Diabetes on record but no first-line diabetes medication (e.g., Metformin) is documented.",
        severity: "medium",
      });
    }

    const allergies = (record.allergies as string[] | undefined) ?? [];
    if (allergies.length === 0) {
      issues.push({
        field: "allergies",
        issue: "[DEMO] No drug allergies documented — please confirm whether you have any known drug allergies or if this should be marked as 'No Known Drug Allergies'.",
        severity: "medium",
      });
    }

    return {
      issues,
      overall_assessment:
        "[DEMO] Record reviewed for clinical plausibility. Add your GEMINI_API_KEY to enable full AI-powered analysis.",
    };
  }

  const key = cacheKey("plausibility", record);

  return getCachedOrFetch(key, async () => {
    const systemPrompt = `You are a clinical data quality analyst. Examine patient records for clinical implausibilities, inconsistencies, and data quality issues.

IMPORTANT: Your output will be shown directly to the patient. Write all descriptions in clear, patient-friendly language. Address the reader as "you" instead of "the patient". Avoid unnecessary clinical jargon.

You MUST respond with valid JSON only, no other text. Use this exact schema:
{
  "issues": [
    {
      "field": "string - the field path e.g. 'vital_signs.blood_pressure'",
      "issue": "string - description of the issue, written for the patient",
      "severity": "high" | "medium" | "low"
    }
  ],
  "overall_assessment": "string - 1-2 sentence summary written for the patient"
}

Focus on:
- Drug-disease mismatches (e.g., medications that conflict with conditions)
- Missing expected data (e.g., diabetes documented but no diabetes medications listed)
- Physiologically impossible values
- Inconsistencies between fields`;

    const userPrompt = `Analyze this patient record for clinical data quality issues:

${JSON.stringify(record, null, 2)}

Identify any clinical implausibilities, inconsistencies, or data quality concerns.`;

    const raw = await callGemini(systemPrompt, userPrompt);
    try {
      return JSON.parse(extractJSON(raw)) as PlausibilityLLMResult;
    } catch {
      return {
        issues: [],
        overall_assessment: raw.slice(0, 300),
      };
    }
  });
}

// ── Issue Resolution LLM Calls ──

export interface ResolutionQuestion {
  id: string;
  question: string;
  type: "text" | "select";
  options?: string[];
}

export interface ResolutionQuestionsResult {
  message: string;
  questions: ResolutionQuestion[];
}

export interface ResolvedUpdateResult {
  message: string;
  updated_fields: Record<string, unknown>;
}

export async function generateResolutionQuestions(
  issue: { field: string; issue: string; severity: string },
  patientRecord: Record<string, unknown>
): Promise<ResolutionQuestionsResult> {
  if (isDemoMode()) {
    return getDemoQuestions(issue);
  }

  const systemPrompt = `You are a helpful healthcare data assistant. A patient is reviewing their health record and wants to fix a data quality issue. Your job is to ask them the minimal set of clear, simple questions needed to resolve the issue.

You MUST respond with valid JSON only, no other text. Use this exact schema:
{
  "message": "string - a brief, friendly sentence explaining what info you need",
  "questions": [
    {
      "id": "string - unique id like q1, q2",
      "question": "string - the question to ask, written in plain patient-friendly language",
      "type": "text" or "select",
      "options": ["array of choices - only if type is select"]
    }
  ]
}

Keep questions simple and patient-friendly. Usually 1-3 questions is enough.`;

  const userPrompt = `Issue detected in the patient's record:
- Field: ${issue.field}
- Problem: ${issue.issue}
- Severity: ${issue.severity}

Current patient record:
${JSON.stringify(patientRecord, null, 2)}

Generate the questions needed to resolve this issue.`;

  const raw = await callGemini(systemPrompt, userPrompt);
  try {
    return JSON.parse(extractJSON(raw)) as ResolutionQuestionsResult;
  } catch {
    return getDemoQuestions(issue);
  }
}

export async function applyResolutionAnswers(
  issue: { field: string; issue: string },
  answers: Record<string, string>,
  patientRecord: Record<string, unknown>
): Promise<ResolvedUpdateResult> {
  if (isDemoMode()) {
    return getDemoUpdate(issue, answers, patientRecord);
  }

  const systemPrompt = `You are a healthcare data assistant. A patient answered questions to fix a data quality issue in their record. Apply their answers to produce the corrected fields.

You MUST respond with valid JSON only, no other text. Use this exact schema:
{
  "message": "string - a short confirmation message for the patient",
  "updated_fields": { "field_name": "new_value" }
}

The updated_fields should contain ONLY the fields that changed, using the same key structure as the original record. For arrays like "allergies" or "medications", return the full updated array.`;

  const userPrompt = `Issue that was detected:
- Field: ${issue.field}
- Problem: ${issue.issue}

Patient's answers:
${JSON.stringify(answers, null, 2)}

Current patient record:
${JSON.stringify(patientRecord, null, 2)}

Produce the corrected fields based on the patient's answers.`;

  const raw = await callGemini(systemPrompt, userPrompt);
  try {
    return JSON.parse(extractJSON(raw)) as ResolvedUpdateResult;
  } catch {
    return getDemoUpdate(issue, answers, patientRecord);
  }
}

function getDemoQuestions(
  issue: { field: string; issue: string }
): ResolutionQuestionsResult {
  const field = issue.field.toLowerCase();

  if (field.includes("allerg")) {
    return {
      message: "Let's update your allergy information.",
      questions: [
        {
          id: "q1",
          question: "Do you have any known drug allergies?",
          type: "select",
          options: ["Yes", "No known drug allergies"],
        },
        {
          id: "q2",
          question: "If yes, please list your drug allergies (separate with commas):",
          type: "text",
        },
      ],
    };
  }

  if (field.includes("medication")) {
    return {
      message: "Let's review your medications to make sure everything is accurate.",
      questions: [
        {
          id: "q1",
          question: "Are you currently taking any medications for this condition?",
          type: "select",
          options: ["Yes", "No"],
        },
        {
          id: "q2",
          question: "Please list the medication name(s) and dosage (e.g., Metformin 500mg twice daily):",
          type: "text",
        },
      ],
    };
  }

  if (field.includes("vital")) {
    return {
      message: "A vital sign value looks incorrect. Let's fix it.",
      questions: [
        {
          id: "q1",
          question: `What is your most recent reading for ${issue.field.replace("vital_signs.", "")}?`,
          type: "text",
        },
      ],
    };
  }

  return {
    message: "Let's update this information in your record.",
    questions: [
      {
        id: "q1",
        question: `What is the correct value for ${issue.field}?`,
        type: "text",
      },
    ],
  };
}

function getDemoUpdate(
  issue: { field: string; issue: string },
  answers: Record<string, string>,
  patientRecord: Record<string, unknown>
): ResolvedUpdateResult {
  const field = issue.field.toLowerCase();

  if (field.includes("allerg")) {
    const hasAllergies = answers["q1"]?.toLowerCase() === "yes";
    const allergyList = hasAllergies && answers["q2"]
      ? answers["q2"].split(",").map((a) => a.trim()).filter(Boolean)
      : ["NKDA"];
    return {
      message: hasAllergies
        ? `Your allergies have been updated to: ${allergyList.join(", ")}.`
        : "Your record has been updated to reflect no known drug allergies.",
      updated_fields: { allergies: allergyList },
    };
  }

  if (field.includes("medication")) {
    const takingMeds = answers["q1"]?.toLowerCase() === "yes";
    const currentMeds = (patientRecord.medications as string[] | undefined) ?? [];
    const newMeds = takingMeds && answers["q2"]
      ? [...currentMeds, ...answers["q2"].split(",").map((m) => m.trim()).filter(Boolean)]
      : currentMeds;
    return {
      message: takingMeds
        ? `Your medications have been updated.`
        : "No new medications added. Your record remains unchanged.",
      updated_fields: takingMeds ? { medications: newMeds } : {},
    };
  }

  if (field.includes("vital")) {
    const vitalKey = issue.field.replace("vital_signs.", "");
    const value = answers["q1"];
    const currentVitals = (patientRecord.vital_signs as Record<string, unknown>) ?? {};
    return {
      message: `Your ${vitalKey.replace(/_/g, " ")} has been updated to ${value}.`,
      updated_fields: {
        vital_signs: { ...currentVitals, [vitalKey]: isNaN(Number(value)) ? value : Number(value) },
      },
    };
  }

  const firstAnswer = Object.values(answers)[0] ?? "";
  return {
    message: `Your ${issue.field} has been updated.`,
    updated_fields: { [issue.field]: firstAnswer },
  };
}
