export interface PatientScenario {
  id: string;
  label: string;
  description: string;
  edgeCase: string;
  data: Record<string, unknown>;
}

export const patientScenarios: PatientScenario[] = [
  {
    id: "pdf-example",
    label: "Implausible BP (PDF Example)",
    description:
      "John Doe with blood pressure 340/180, empty allergies, and data 7+ months old.",
    edgeCase: "Implausible vitals, missing allergies, stale data",
    data: {
      demographics: { name: "John Doe", dob: "1955-03-15", gender: "M" },
      medications: ["Metformin 500mg", "Lisinopril 10mg"],
      allergies: [],
      conditions: ["Type 2 Diabetes"],
      vital_signs: { blood_pressure: "340/180", heart_rate: 72 },
      last_updated: "2024-06-15",
    },
  },
  {
    id: "near-perfect",
    label: "Near-Perfect Record",
    description:
      "Complete, recent record with plausible vitals and documented allergies. Should score very high.",
    edgeCase: "High quality baseline",
    data: {
      demographics: { name: "Maria Santos", dob: "1968-07-22", gender: "F" },
      medications: [
        "Metformin 500mg twice daily",
        "Lisinopril 10mg daily",
        "Atorvastatin 20mg daily",
      ],
      allergies: ["Penicillin", "Sulfa drugs"],
      conditions: ["Type 2 Diabetes", "Hypertension", "Hyperlipidemia"],
      vital_signs: {
        blood_pressure: "128/78",
        heart_rate: 74,
        temperature: 98.6,
        respiratory_rate: 16,
        oxygen_saturation: 98,
      },
      last_updated: "2025-02-28",
    },
  },
  {
    id: "severely-incomplete",
    label: "Severely Incomplete Record",
    description:
      "Almost no data provided — no demographics, no medications, no vitals. Should score very low on completeness.",
    edgeCase: "Minimal data, extremely low completeness",
    data: {
      demographics: {},
      medications: [],
      allergies: [],
      conditions: [],
      vital_signs: {},
    },
  },
  {
    id: "multiple-implausible-vitals",
    label: "Multiple Implausible Vitals",
    description:
      "Several physiologically impossible vital signs: HR 300, temp 110F, BP 40/200, SpO2 150.",
    edgeCase: "Multiple accuracy failures in vital signs",
    data: {
      demographics: { name: "Test Patient", dob: "1970-01-01", gender: "M" },
      medications: ["Aspirin 81mg daily"],
      allergies: ["NKDA"],
      conditions: ["Hypertension"],
      vital_signs: {
        blood_pressure: "40/200",
        heart_rate: 300,
        temperature: 110,
        respiratory_rate: 2,
        oxygen_saturation: 150,
      },
      last_updated: "2025-02-15",
    },
  },
  {
    id: "very-stale",
    label: "Very Stale Data (3+ Years Old)",
    description:
      "Otherwise decent record but last updated over 3 years ago. Tests timeliness scoring heavily.",
    edgeCase: "Extremely old data, low timeliness",
    data: {
      demographics: { name: "Robert Chen", dob: "1950-11-30", gender: "M" },
      medications: [
        "Warfarin 5mg daily",
        "Metoprolol 50mg twice daily",
        "Furosemide 40mg daily",
      ],
      allergies: ["Aspirin"],
      conditions: ["Atrial Fibrillation", "Congestive Heart Failure"],
      vital_signs: {
        blood_pressure: "138/82",
        heart_rate: 78,
        temperature: 98.2,
      },
      last_updated: "2022-04-10",
    },
  },
  {
    id: "drug-disease-mismatch",
    label: "Drug–Disease Mismatch",
    description:
      "Patient has Type 2 Diabetes documented but no diabetes medications. Has hypertension meds but no hypertension diagnosis.",
    edgeCase: "Clinical plausibility: mismatched meds and conditions",
    data: {
      demographics: { name: "Linda Park", dob: "1962-09-18", gender: "F" },
      medications: ["Lisinopril 20mg daily", "Amlodipine 5mg daily"],
      allergies: [],
      conditions: ["Type 2 Diabetes"],
      vital_signs: {
        blood_pressure: "142/88",
        heart_rate: 80,
      },
      last_updated: "2025-01-10",
    },
  },
  {
    id: "invalid-demographics",
    label: "Invalid Demographics (Future DOB)",
    description:
      "Date of birth is in the future, producing a negative calculated age. Tests accuracy validation on demographics.",
    edgeCase: "Impossible DOB, negative age",
    data: {
      demographics: { name: "Baby Doe", dob: "2030-06-15", gender: "F" },
      medications: ["Amoxicillin 250mg three times daily"],
      allergies: ["Latex"],
      conditions: ["Otitis Media"],
      vital_signs: {
        heart_rate: 110,
        temperature: 100.4,
        respiratory_rate: 22,
      },
      last_updated: "2025-02-20",
    },
  },
  {
    id: "inverted-bp",
    label: "Inverted Blood Pressure",
    description:
      "Systolic is lower than diastolic (80/120). Tests the BP-specific validation rule.",
    edgeCase: "Systolic < diastolic",
    data: {
      demographics: { name: "James Wilson", dob: "1975-04-05", gender: "M" },
      medications: [
        "Metformin 1000mg twice daily",
        "Lisinopril 5mg daily",
      ],
      allergies: ["Codeine"],
      conditions: ["Type 2 Diabetes", "Hypertension"],
      vital_signs: {
        blood_pressure: "80/120",
        heart_rate: 68,
        temperature: 98.4,
        oxygen_saturation: 97,
      },
      last_updated: "2025-03-01",
    },
  },
];
