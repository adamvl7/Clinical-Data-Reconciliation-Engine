import { z } from "zod";

// ── Medication Reconciliation Types ──

export const MedicationSourceSchema = z.object({
  system: z.string().min(1),
  medication: z.string().min(1),
  last_updated: z.string().optional(),
  last_filled: z.string().optional(),
  source_reliability: z.enum(["high", "medium", "low"]).default("medium"),
});

export const PatientContextSchema = z.object({
  age: z.number().optional(),
  conditions: z.array(z.string()).default([]),
  recent_labs: z.record(z.number()).default({}),
});

export const ReconcileRequestSchema = z.object({
  patient_context: PatientContextSchema,
  sources: z.array(MedicationSourceSchema).min(1),
  webhook_url: z.string().url().optional(),
});

export type MedicationSource = z.infer<typeof MedicationSourceSchema>;
export type PatientContext = z.infer<typeof PatientContextSchema>;
export type ReconcileRequest = z.infer<typeof ReconcileRequestSchema>;

export interface DuplicateGroup {
  indices: number[];
  normalized_medication: string;
}

export interface ConfidenceBreakdown {
  source_reliability: number;
  recency: number;
  cross_source_agreement: number;
  clinical_compatibility: number;
  llm_certainty: number;
}

export interface ReconcileResponse {
  reconciled_medication: string;
  confidence_score: number;
  confidence_breakdown: ConfidenceBreakdown;
  reasoning: string;
  recommended_actions: string[];
  clinical_safety_check: "PASSED" | "FLAGGED";
  safety_details?: string;
  duplicates_detected: DuplicateGroup[];
}

// ── Data Quality Types ──

export const DemographicsSchema = z.object({
  name: z.string().optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
});

export const VitalSignsSchema = z.record(z.union([z.string(), z.number()])).default({});

export const DataQualityRequestSchema = z.object({
  demographics: DemographicsSchema.default({}),
  medications: z.array(z.string()).default([]),
  allergies: z.array(z.string()).default([]),
  conditions: z.array(z.string()).default([]),
  vital_signs: VitalSignsSchema.default({}),
  last_updated: z.string().optional(),
  webhook_url: z.string().url().optional(),
});

export type DataQualityRequest = z.infer<typeof DataQualityRequestSchema>;

export interface DataQualityIssue {
  field: string;
  issue: string;
  severity: "high" | "medium" | "low";
}

export interface DataQualityBreakdown {
  completeness: number;
  accuracy: number;
  timeliness: number;
  clinical_plausibility: number;
}

export interface DataQualityResponse {
  overall_score: number;
  breakdown: DataQualityBreakdown;
  issues_detected: DataQualityIssue[];
}

// ── Shared Error Type ──

export interface ApiError {
  error: string;
  details?: unknown;
}
