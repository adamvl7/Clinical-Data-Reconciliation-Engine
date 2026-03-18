import { describe, it, expect, vi } from "vitest";
import { detectDuplicateSources } from "@/lib/reconciliationEngine";
import type { MedicationSource } from "@/lib/types";

vi.mock("@/lib/llm/geminiClient", () => ({
  reconcileMedicationLLM: vi.fn().mockResolvedValue({
    reconciled_medication: "Metformin 500mg twice daily",
    reasoning: "Mocked reasoning",
    recommended_actions: ["Update hospital record"],
    safety_concerns: null,
    llm_certainty: 0.85,
  }),
}));

describe("Duplicate Detection", () => {
  it("detects exact duplicate medication records", () => {
    const sources: MedicationSource[] = [
      { system: "Hospital", medication: "Metformin 500mg twice daily", source_reliability: "high" },
      { system: "Clinic", medication: "Metformin 500mg twice daily", source_reliability: "high" },
    ];
    const duplicates = detectDuplicateSources(sources);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].indices).toEqual([0, 1]);
  });

  it("does not flag different medications as duplicates", () => {
    const sources: MedicationSource[] = [
      { system: "Hospital", medication: "Metformin 500mg twice daily", source_reliability: "high" },
      { system: "Clinic", medication: "Lisinopril 10mg daily", source_reliability: "high" },
    ];
    const duplicates = detectDuplicateSources(sources);
    expect(duplicates.length).toBe(0);
  });

  it("does not flag same drug with different doses as duplicates", () => {
    const sources: MedicationSource[] = [
      { system: "Hospital", medication: "Metformin 1000mg twice daily", source_reliability: "high" },
      { system: "Clinic", medication: "Metformin 500mg twice daily", source_reliability: "high" },
    ];
    const duplicates = detectDuplicateSources(sources);
    expect(duplicates.length).toBe(0);
  });
});

describe("Reconciliation Engine (with mocked LLM)", () => {
  it("produces a valid reconciled result", async () => {
    const { reconcileMedication } = await import("@/lib/reconciliationEngine");
    const result = await reconcileMedication({
      patient_context: {
        age: 67,
        conditions: ["Type 2 Diabetes", "Hypertension"],
        recent_labs: { eGFR: 45 },
      },
      sources: [
        {
          system: "Hospital EHR",
          medication: "Metformin 1000mg twice daily",
          last_updated: "2024-10-15",
          source_reliability: "high",
        },
        {
          system: "Primary Care",
          medication: "Metformin 500mg twice daily",
          last_updated: "2025-01-20",
          source_reliability: "high",
        },
      ],
    });

    expect(result.reconciled_medication).toBeDefined();
    expect(result.confidence_score).toBeGreaterThan(0);
    expect(result.confidence_score).toBeLessThanOrEqual(1);
    expect(result.reasoning).toBeDefined();
    expect(["PASSED", "FLAGGED"]).toContain(result.clinical_safety_check);
    expect(Array.isArray(result.recommended_actions)).toBe(true);
  });
});
