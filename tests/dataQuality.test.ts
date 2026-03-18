import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/llm/geminiClient", () => ({
  validatePlausibilityLLM: vi.fn().mockResolvedValue({
    issues: [],
    overall_assessment: "Mocked assessment",
  }),
}));

describe("Data Quality Engine", () => {
  it("flags old last_updated and missing allergies", async () => {
    const { evaluateDataQuality } = await import("@/lib/dataQualityEngine");

    const result = await evaluateDataQuality({
      demographics: { name: "John Doe", dob: "1955-03-15", gender: "M" },
      medications: ["Metformin 500mg"],
      allergies: [],
      conditions: ["Type 2 Diabetes"],
      vital_signs: { blood_pressure: "120/80", heart_rate: 72 },
      last_updated: "2024-06-15",
    });

    expect(result.overall_score).toBeGreaterThan(0);
    expect(result.overall_score).toBeLessThanOrEqual(100);

    const allergyIssue = result.issues_detected.find((i) =>
      i.field === "allergies"
    );
    expect(allergyIssue).toBeDefined();
    expect(allergyIssue?.severity).toBe("medium");

    expect(result.breakdown.completeness).toBeDefined();
    expect(result.breakdown.timeliness).toBeDefined();
  });

  it("flags implausible blood pressure in data quality", async () => {
    const { evaluateDataQuality } = await import("@/lib/dataQualityEngine");

    const result = await evaluateDataQuality({
      demographics: { name: "Jane Smith", dob: "1960-01-01", gender: "F" },
      medications: ["Lisinopril 10mg"],
      allergies: ["Penicillin"],
      conditions: ["Hypertension"],
      vital_signs: { blood_pressure: "340/180", heart_rate: 72 },
      last_updated: "2025-01-01",
    });

    const bpIssue = result.issues_detected.find((i) =>
      i.field.includes("blood_pressure")
    );
    expect(bpIssue).toBeDefined();
    expect(bpIssue?.severity).toBe("high");
    expect(result.breakdown.accuracy).toBeLessThan(100);
  });
});
