import type {
  MedicationSource,
  PatientContext,
  ReconcileRequest,
  ReconcileResponse,
  DuplicateGroup,
  ConfidenceBreakdown,
} from "./types";
import { clinicalCompatibilityScore, clinicalSafetyCheck } from "./clinicalRules";
import { reconcileMedicationLLM } from "./llm/geminiClient";

// ── Medication string normalization ──

interface ParsedMedication {
  drugName: string;
  doseMg: number | null;
  frequency: string;
  raw: string;
}

/**
 * Normalizes a free-text medication string into structured components.
 *
 * Extracts:
 *  - `doseMg`    -- first numeric value followed by "mg" (null if absent)
 *  - `frequency` -- matched against a fixed set of patterns (BID, TID, etc.);
 *                   defaults to "unknown" when none match
 *  - `drugName`  -- the remaining text after dose/frequency removal, lowercased
 *                   and whitespace-collapsed
 *
 * This parser does **not** compute a total daily dose (doseMg * frequency).
 */
function parseMedication(raw: string): ParsedMedication {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const doseMatch = normalized.match(/(\d+(?:\.\d+)?)\s*mg/);
  const doseMg = doseMatch ? parseFloat(doseMatch[1]) : null;

  const freqPatterns: [RegExp, string][] = [
    [/twice\s+daily|bid|b\.i\.d/i, "twice daily"],
    [/three\s+times\s+daily|tid|t\.i\.d/i, "three times daily"],
    [/four\s+times\s+daily|qid|q\.i\.d/i, "four times daily"],
    [/once\s+daily|daily|qd|q\.d/i, "daily"],
    [/every\s+(\d+)\s+hours?/i, "every $1 hours"],
    [/as\s+needed|prn/i, "as needed"],
  ];

  let frequency = "unknown";
  for (const [pattern, label] of freqPatterns) {
    if (pattern.test(normalized)) {
      frequency = label;
      break;
    }
  }

  const drugName = normalized
    .replace(/\d+(?:\.\d+)?\s*mg/, "")
    .replace(/(twice|once|three times|four times)\s+daily/, "")
    .replace(/(daily|bid|tid|qid|prn)/, "")
    .replace(/\s+/g, " ")
    .trim();

  return { drugName, doseMg, frequency, raw };
}

// ── Duplicate Detection ──

export function detectDuplicateSources(sources: MedicationSource[]): DuplicateGroup[] {
  const parsed = sources.map((s) => parseMedication(s.medication));
  const groups: DuplicateGroup[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < parsed.length; i++) {
    if (visited.has(i)) continue;
    const group: number[] = [i];

    for (let j = i + 1; j < parsed.length; j++) {
      if (visited.has(j)) continue;
      if (areSimilarMedications(parsed[i], parsed[j])) {
        group.push(j);
        visited.add(j);
      }
    }

    if (group.length > 1) {
      visited.add(i);
      groups.push({
        indices: group,
        normalized_medication: `${parsed[i].drugName} ${parsed[i].doseMg ?? "?"}mg ${parsed[i].frequency}`,
      });
    }
  }

  return groups;
}

function areSimilarMedications(a: ParsedMedication, b: ParsedMedication): boolean {
  const sameDrug =
    a.drugName === b.drugName ||
    a.drugName.includes(b.drugName) ||
    b.drugName.includes(a.drugName);

  if (!sameDrug) return false;

  if (a.doseMg !== null && b.doseMg !== null && a.doseMg === b.doseMg && a.frequency === b.frequency) {
    return true;
  }

  return false;
}

// ── Source scoring ──

const RELIABILITY_WEIGHTS: Record<string, number> = {
  high: 0.9,
  medium: 0.6,
  low: 0.3,
};

function recencyScore(source: MedicationSource): number {
  const dateStr = source.last_updated ?? source.last_filled;
  if (!dateStr) return 0.3;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 0.3;

  const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince < 30) return 1.0;
  if (daysSince < 90) return 0.8;
  if (daysSince < 180) return 0.6;
  if (daysSince < 365) return 0.4;
  return 0.2;
}

function sourceScore(source: MedicationSource, context: PatientContext): number {
  const reliability = RELIABILITY_WEIGHTS[source.source_reliability] ?? 0.5;
  const recency = recencyScore(source);
  const clinical = clinicalCompatibilityScore(source.medication, context);
  return reliability * 0.35 + recency * 0.35 + clinical * 0.3;
}

// ── Confidence Calibration ──

/**
 * Produces the final confidence score (0.05--0.99) and per-component breakdown.
 *
 * Weighted formula:
 *   raw = reliabilityAvg * 0.20
 *       + recencyAvg     * 0.20
 *       + agreementRatio * 0.15   (fraction of sources sharing the mode drug name)
 *       + clinicalAvg    * 0.15
 *       + llmCertainty   * 0.30
 *       + safetyPenalty           (-0.10 when FLAGGED, else 0)
 *
 * The safety penalty is folded into the score but is *not* a separate field in
 * the returned breakdown.
 */
function calibrateConfidence(
  sources: MedicationSource[],
  context: PatientContext,
  llmCertainty: number,
  safetyStatus: "PASSED" | "FLAGGED"
): { score: number; breakdown: ConfidenceBreakdown } {
  const scores = sources.map((s) => sourceScore(s, context));
  const bestScore = Math.max(...scores);

  const reliabilityAvg =
    sources.reduce((sum, s) => sum + (RELIABILITY_WEIGHTS[s.source_reliability] ?? 0.5), 0) /
    sources.length;

  const recencyAvg =
    sources.reduce((sum, s) => sum + recencyScore(s), 0) / sources.length;

  // Cross-source agreement: how many sources roughly agree
  const parsed = sources.map((s) => parseMedication(s.medication));
  const drugNames = parsed.map((p) => p.drugName);
  const mostCommon = drugNames.sort(
    (a, b) => drugNames.filter((n) => n === b).length - drugNames.filter((n) => n === a).length
  )[0];
  const agreementRatio = drugNames.filter((n) => n === mostCommon).length / drugNames.length;

  const clinicalAvg =
    sources.reduce((sum, s) => sum + clinicalCompatibilityScore(s.medication, context), 0) /
    sources.length;

  const safetyPenalty = safetyStatus === "FLAGGED" ? -0.1 : 0;

  const raw =
    reliabilityAvg * 0.2 +
    recencyAvg * 0.2 +
    agreementRatio * 0.15 +
    clinicalAvg * 0.15 +
    llmCertainty * 0.3 +
    safetyPenalty;

  const score = Math.max(0.05, Math.min(0.99, raw));

  return {
    score: parseFloat(score.toFixed(2)),
    breakdown: {
      source_reliability: parseFloat(reliabilityAvg.toFixed(2)),
      recency: parseFloat(recencyAvg.toFixed(2)),
      cross_source_agreement: parseFloat(agreementRatio.toFixed(2)),
      clinical_compatibility: parseFloat(clinicalAvg.toFixed(2)),
      llm_certainty: parseFloat(llmCertainty.toFixed(2)),
    },
  };
}

// ── Main Reconciliation Function ──

export async function reconcileMedication(
  request: ReconcileRequest
): Promise<ReconcileResponse> {
  const { sources, patient_context } = request;

  const duplicates = detectDuplicateSources(sources);

  // Rank sources by heuristic score
  const ranked = sources
    .map((s, i) => ({ source: s, index: i, score: sourceScore(s, patient_context) }))
    .sort((a, b) => b.score - a.score);

  const heuristicRanking = ranked
    .map(
      (r) =>
        `${r.source.system} (score: ${r.score.toFixed(2)}): "${r.source.medication}"`
    )
    .join("\n");

  // Call LLM for clinical reasoning
  const llmResult = await reconcileMedicationLLM(
    sources,
    patient_context,
    heuristicRanking
  );

  // Clinical safety check on the reconciled result
  const safety = clinicalSafetyCheck(llmResult.reconciled_medication, patient_context);
  const finalSafety = llmResult.safety_concerns
    ? { status: "FLAGGED" as const, reason: llmResult.safety_concerns }
    : safety;

  // Calibrate confidence
  const { score: confidenceScore, breakdown } = calibrateConfidence(
    sources,
    patient_context,
    llmResult.llm_certainty,
    finalSafety.status
  );

  return {
    reconciled_medication: llmResult.reconciled_medication,
    confidence_score: confidenceScore,
    confidence_breakdown: breakdown,
    reasoning: llmResult.reasoning,
    recommended_actions: llmResult.recommended_actions,
    clinical_safety_check: finalSafety.status,
    safety_details: finalSafety.reason,
    duplicates_detected: duplicates,
  };
}
