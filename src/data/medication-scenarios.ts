export interface MedicationScenario {
  id: string;
  label: string;
  description: string;
  edgeCase: string;
  data: Record<string, unknown>;
}

export const medicationScenarios: MedicationScenario[] = [
  {
    id: "pdf-example",
    label: "Metformin Dose Conflict (PDF Example)",
    description:
      "Three sources disagree on Metformin dose. Primary care lowered dose due to declining kidney function (eGFR 45).",
    edgeCase: "Dose reduction with renal impairment",
    data: {
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
        {
          system: "Pharmacy",
          medication: "Metformin 1000mg daily",
          last_filled: "2025-01-25",
          source_reliability: "medium",
        },
      ],
    },
  },
  {
    id: "unanimous-agreement",
    label: "Unanimous Agreement (Lisinopril)",
    description:
      "All three sources report the same medication, dose, and frequency. Confidence should be very high.",
    edgeCase: "Full cross-source agreement",
    data: {
      patient_context: {
        age: 72,
        conditions: ["Hypertension"],
        recent_labs: { eGFR: 68, potassium: 4.2 },
      },
      sources: [
        {
          system: "Hospital EHR",
          medication: "Lisinopril 10mg daily",
          last_updated: "2025-02-10",
          source_reliability: "high",
        },
        {
          system: "Primary Care",
          medication: "Lisinopril 10mg daily",
          last_updated: "2025-02-15",
          source_reliability: "high",
        },
        {
          system: "Pharmacy",
          medication: "Lisinopril 10mg daily",
          last_filled: "2025-02-20",
          source_reliability: "medium",
        },
      ],
    },
  },
  {
    id: "critical-egfr",
    label: "Critical Kidney Function (eGFR < 30)",
    description:
      "Patient with CKD Stage 4 and critically low eGFR of 22. Metformin should be FLAGGED as contraindicated.",
    edgeCase: "Safety flag: metformin contraindicated at eGFR < 30",
    data: {
      patient_context: {
        age: 75,
        conditions: ["Type 2 Diabetes", "Chronic Kidney Disease Stage 4"],
        recent_labs: { eGFR: 22, creatinine: 2.8, HbA1c: 7.1 },
      },
      sources: [
        {
          system: "Nephrology Clinic",
          medication: "Metformin 500mg daily",
          last_updated: "2025-01-05",
          source_reliability: "high",
        },
        {
          system: "Primary Care",
          medication: "Metformin 1000mg twice daily",
          last_updated: "2024-08-10",
          source_reliability: "high",
        },
        {
          system: "Pharmacy",
          medication: "Metformin 1000mg twice daily",
          last_filled: "2024-09-01",
          source_reliability: "medium",
        },
      ],
    },
  },
  {
    id: "excessive-dose",
    label: "Excessive Dose (> 2000mg Metformin)",
    description:
      "One source reports Metformin 2500mg daily, exceeding the typical 2000mg max. Should trigger a safety flag.",
    edgeCase: "Safety flag: dose exceeds pharmacological maximum",
    data: {
      patient_context: {
        age: 58,
        conditions: ["Type 2 Diabetes"],
        recent_labs: { eGFR: 82, HbA1c: 9.4 },
      },
      sources: [
        {
          system: "Endocrinology",
          medication: "Metformin 2500mg daily",
          last_updated: "2025-01-28",
          source_reliability: "high",
        },
        {
          system: "Primary Care",
          medication: "Metformin 1000mg twice daily",
          last_updated: "2025-01-15",
          source_reliability: "high",
        },
        {
          system: "Pharmacy",
          medication: "Metformin 1000mg twice daily",
          last_filled: "2025-01-20",
          source_reliability: "medium",
        },
      ],
    },
  },
  {
    id: "stale-records",
    label: "Stale Records (> 1 Year Old)",
    description:
      "All records are over a year old with mixed reliability. Tests how recency scoring and low-confidence handling work.",
    edgeCase: "Low recency scores, mixed reliability",
    data: {
      patient_context: {
        age: 70,
        conditions: ["Coronary Artery Disease", "Prior MI"],
        recent_labs: {},
      },
      sources: [
        {
          system: "Cardiology",
          medication: "Aspirin 81mg daily",
          last_updated: "2023-03-10",
          source_reliability: "high",
        },
        {
          system: "Primary Care",
          medication: "Aspirin 325mg daily",
          last_updated: "2023-06-22",
          source_reliability: "medium",
        },
        {
          system: "Urgent Care",
          medication: "Aspirin 81mg daily",
          last_updated: "2023-01-05",
          source_reliability: "low",
        },
      ],
    },
  },
  {
    id: "duplicates-mixed",
    label: "Duplicate Sources with Conflicts",
    description:
      "Five sources where two pairs are duplicates and one outlier conflicts. Tests duplicate detection and agreement ratio.",
    edgeCase: "Duplicate detection with 5 sources",
    data: {
      patient_context: {
        age: 63,
        conditions: ["Type 2 Diabetes", "Hyperlipidemia"],
        recent_labs: { eGFR: 55, HbA1c: 7.8, LDL: 145 },
      },
      sources: [
        {
          system: "Hospital EHR",
          medication: "Metformin 500mg twice daily",
          last_updated: "2025-01-10",
          source_reliability: "high",
        },
        {
          system: "Primary Care",
          medication: "Metformin 500mg twice daily",
          last_updated: "2025-01-12",
          source_reliability: "high",
        },
        {
          system: "Pharmacy A",
          medication: "Metformin 1000mg daily",
          last_filled: "2025-01-18",
          source_reliability: "medium",
        },
        {
          system: "Pharmacy B",
          medication: "Metformin 1000mg daily",
          last_filled: "2025-01-18",
          source_reliability: "medium",
        },
        {
          system: "Patient Self-Report",
          medication: "Metformin 500mg once daily",
          last_updated: "2025-01-20",
          source_reliability: "low",
        },
      ],
    },
  },
  {
    id: "frequency-only-conflict",
    label: "Frequency-Only Mismatch (Amlodipine)",
    description:
      "All sources agree on drug and dose, but report different frequencies (daily vs BID). Tests frequency parsing.",
    edgeCase: "Same drug/dose, different frequency",
    data: {
      patient_context: {
        age: 55,
        conditions: ["Hypertension"],
        recent_labs: { eGFR: 90, potassium: 4.0 },
      },
      sources: [
        {
          system: "Cardiology",
          medication: "Amlodipine 5mg twice daily",
          last_updated: "2025-02-01",
          source_reliability: "high",
        },
        {
          system: "Primary Care",
          medication: "Amlodipine 5mg daily",
          last_updated: "2025-01-28",
          source_reliability: "high",
        },
        {
          system: "Pharmacy",
          medication: "Amlodipine 5mg once daily",
          last_filled: "2025-02-05",
          source_reliability: "medium",
        },
      ],
    },
  },
  {
    id: "no-context-low-info",
    label: "Minimal Patient Context",
    description:
      "Patient context has no age, no conditions, no labs. Only basic medication records. Tests graceful degradation.",
    edgeCase: "Missing patient context, sparse data",
    data: {
      patient_context: {
        conditions: [],
        recent_labs: {},
      },
      sources: [
        {
          system: "Emergency Dept",
          medication: "Atorvastatin 40mg daily",
          last_updated: "2025-02-10",
          source_reliability: "medium",
        },
        {
          system: "Outside Records",
          medication: "Atorvastatin 20mg daily",
          source_reliability: "low",
        },
      ],
    },
  },
];
