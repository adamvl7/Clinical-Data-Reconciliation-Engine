import { describe, it, expect } from "vitest";
import {
  checkVitalSigns,
  clinicalSafetyCheck,
  clinicalCompatibilityScore,
} from "@/lib/clinicalRules";

describe("checkVitalSigns", () => {
  it("flags physiologically implausible blood pressure", () => {
    const issues = checkVitalSigns({ blood_pressure: "340/180" });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.severity === "high")).toBe(true);
    expect(issues.some((i) => i.field === "vital_signs.blood_pressure")).toBe(true);
  });

  it("passes normal vital signs", () => {
    const issues = checkVitalSigns({
      blood_pressure: "120/80",
      heart_rate: 72,
    });
    expect(issues.length).toBe(0);
  });

  it("flags heart rate outside plausible range", () => {
    const issues = checkVitalSigns({ heart_rate: 300 });
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe("high");
  });
});

describe("clinicalSafetyCheck", () => {
  it("flags metformin with very low eGFR", () => {
    const result = clinicalSafetyCheck("Metformin 500mg twice daily", {
      age: 70,
      conditions: ["Type 2 Diabetes"],
      recent_labs: { eGFR: 25 },
    });
    expect(result.status).toBe("FLAGGED");
    expect(result.reason).toContain("eGFR");
  });

  it("passes metformin with adequate kidney function", () => {
    const result = clinicalSafetyCheck("Metformin 500mg twice daily", {
      age: 55,
      conditions: ["Type 2 Diabetes"],
      recent_labs: { eGFR: 80 },
    });
    expect(result.status).toBe("PASSED");
  });
});

describe("clinicalCompatibilityScore", () => {
  it("returns higher score for reduced metformin dose with low eGFR", () => {
    const context = {
      age: 67,
      conditions: ["Type 2 Diabetes"],
      recent_labs: { eGFR: 45 },
    };
    const lowDose = clinicalCompatibilityScore("Metformin 500mg twice daily", context);
    const highDose = clinicalCompatibilityScore("Metformin 1000mg twice daily", context);
    expect(lowDose).toBeGreaterThan(highDose);
  });
});
