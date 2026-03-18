# Medication Reconciliation -- How It Works

This document explains how the clinical-reconciliation application reconciles
conflicting medication records, computes a confidence score, and selects the
final medication (drug, dose, and frequency).

---

## High-level flow

```
POST /api/reconcile/medication
  ┌─ Parse & validate request (Zod)
  ├─ Detect duplicate sources
  ├─ Rank sources by heuristic score
  ├─ Call LLM (or demo fallback) to pick reconciled medication
  ├─ Run clinical safety check on the result
  ├─ Calibrate confidence score
  └─ Return response
```

Key files:

| File | Responsibility |
|------|----------------|
| `src/lib/reconciliationEngine.ts` | Orchestration, parsing, duplicate detection, source ranking, confidence calibration |
| `src/lib/clinicalRules.ts` | Clinical compatibility scoring, safety checks |
| `src/lib/llm/geminiClient.ts` | LLM-based medication selection (and demo-mode fallback) |
| `src/lib/types.ts` | Shared Zod schemas and TypeScript interfaces |

---

## 1. Medication parsing (`parseMedication`)

Every source medication string is normalized to a structured form:

| Field | Extraction method |
|-------|-------------------|
| `drugName` | Lowercase, whitespace-collapsed, dose and frequency text stripped out |
| `doseMg` | First match of `(\d+(?:\.\d+)?)\s*mg` -- e.g. "500mg" becomes `500` |
| `frequency` | Matched against a fixed set of patterns (see table below) |

### Recognized frequency patterns

| Pattern (case-insensitive) | Normalized label |
|----------------------------|------------------|
| `twice daily`, `bid`, `b.i.d` | `twice daily` |
| `three times daily`, `tid`, `t.i.d` | `three times daily` |
| `four times daily`, `qid`, `q.i.d` | `four times daily` |
| `once daily`, `daily`, `qd`, `q.d` | `daily` |
| `every <N> hours` | `every <N> hours` |
| `as needed`, `prn` | `as needed` |
| *(none matched)* | `unknown` |

> **Note:** There is no numeric daily-dose calculation (e.g. 500 mg x 2 = 1000 mg/day).
> Parsing extracts the per-dose amount and the frequency label, but does not multiply them.

---

## 2. Duplicate detection

Two medication sources are considered **duplicates** when both conditions hold:

1. **Same drug** -- normalized `drugName` values match exactly, or one is a
   substring of the other.
2. **Same regimen** -- both `doseMg` values are non-null and equal, **and** the
   `frequency` strings are equal.

Duplicate groups are reported in the response as `duplicates_detected` but do
not themselves influence which dose is selected.

---

## 3. Heuristic source ranking

Each source receives a composite score used to rank it for the LLM prompt.  The
score is **not** the final confidence score; it only shapes the context provided
to the LLM.

```
sourceScore = reliability * 0.35
            + recency     * 0.35
            + clinical    * 0.30
```

### 3a. Reliability weights

| `source_reliability` | Weight |
|----------------------|--------|
| `high` | 0.9 |
| `medium` | 0.6 |
| `low` | 0.3 |
| *(unknown/missing)* | 0.5 |

### 3b. Recency score

Based on the first non-null value of `last_updated` or `last_filled`:

| Days since date | Score |
|-----------------|-------|
| < 30 | 1.0 |
| < 90 | 0.8 |
| < 180 | 0.6 |
| < 365 | 0.4 |
| >= 365 | 0.2 |
| Missing / invalid | 0.3 |

### 3c. Clinical compatibility score

Returned by `clinicalCompatibilityScore` (0--1 scale, baseline **0.7**).

Current rules:

- **Metformin + kidney function (eGFR)**
  - eGFR < 30: -0.3 (contraindicated)
  - eGFR <= 45: -0.1 (dose reduction recommended)
  - eGFR <= 45 *and* dose <= 500 mg: +0.15 (appropriately reduced)
  - eGFR <= 45 *and* dose > 500 mg: -0.1 (too high for kidney function)
- **Condition--drug alignment bonuses**
  - Metformin + diabetes: +0.1
  - Lisinopril + hypertension: +0.1
  - Aspirin + age > 50: +0.05

Result is clamped to [0, 1].

---

## 4. Reconciled medication selection

### Real mode (Gemini API key present)

The application sends a structured prompt to **Gemini** containing:

- Patient context (age, conditions, recent labs)
- All source records (system, medication string, dates, reliability)
- Heuristic ranking with per-source scores

Gemini is instructed to return JSON with:

- `reconciled_medication` -- free-text string including drug name, dose, and
  frequency
- `reasoning` -- 2--4 sentence clinical rationale
- `recommended_actions` -- actionable follow-ups
- `safety_concerns` -- any safety flags (or null)
- `llm_certainty` -- 0--1 self-assessed confidence

The returned `reconciled_medication` string is used **verbatim**.  There is no
deterministic override or numeric comparison of candidate daily doses.

### Demo mode (no API key)

When `GEMINI_API_KEY` is not set, the application falls back to a
deterministic heuristic:

1. Sort sources by date descending (`last_updated` then `last_filled`).
2. Use the **most recent** source's medication string as `reconciled_medication`.
3. Return a fixed `llm_certainty` of **0.82**.

---

## 5. Clinical safety check

After the reconciled medication is chosen, `clinicalSafetyCheck` evaluates it:

| Rule | Result |
|------|--------|
| Metformin and eGFR < 30 | **FLAGGED** -- contraindicated |
| Metformin dose > 2000 mg | **FLAGGED** -- exceeds typical maximum |
| Otherwise | **PASSED** |

If the LLM also returns a non-null `safety_concerns` string, the overall safety
status is set to **FLAGGED** regardless of the rule-based check.

A **FLAGGED** status applies a -0.10 penalty to the final confidence score (see
below) and is surfaced to the consumer in `clinical_safety_check` and
`safety_details`.

---

## 6. Confidence score calibration

`calibrateConfidence` computes the final confidence score from five weighted
components plus an optional safety penalty.

### Formula

```
raw = reliabilityAvg         * 0.20
    + recencyAvg              * 0.20
    + crossSourceAgreement    * 0.15
    + clinicalCompatibilityAvg * 0.15
    + llmCertainty            * 0.30
    + safetyPenalty
```

| Component | Range | Derivation |
|-----------|-------|------------|
| `reliabilityAvg` | 0--1 | Mean of reliability weights across all sources |
| `recencyAvg` | 0--1 | Mean of recency scores across all sources |
| `crossSourceAgreement` | 0--1 | Fraction of sources whose normalized `drugName` matches the mode drug name |
| `clinicalCompatibilityAvg` | 0--1 | Mean of `clinicalCompatibilityScore` across all sources |
| `llmCertainty` | 0--1 | Self-reported certainty from the LLM (or 0.82 in demo mode) |
| `safetyPenalty` | -0.10 or 0 | Applied when the final safety status is FLAGGED |

### Post-processing

1. Clamp to **[0.05, 0.99]**.
2. Round to **two decimal places**.

### Breakdown returned to the consumer

The response includes a `confidence_breakdown` object with each component's
individual value (rounded to two decimals).  The safety penalty is **not** a
separate breakdown field; it is folded into the overall `confidence_score` only.

---

## Known limitations

- **No numeric daily-dose computation.** The app parses per-dose mg and
  frequency labels but never multiplies them to produce a total mg/day figure.
- **Dose selection is LLM-dependent.** Outside demo mode, the final choice of
  drug, dose, and frequency is entirely delegated to Gemini.  There is no
  deterministic rule that picks, for example, the median or the highest reported
  dose.
- **Limited sig/directions parsing.** Only a small set of frequency
  abbreviations is recognized.  Complex directions (tapering, conditional
  dosing, "every other day") are not parsed.
- **Limited drug-specific clinical rules.** Only metformin, lisinopril, and
  aspirin have explicit compatibility or safety rules.
- **No per-source confidence.** A single aggregate confidence score is returned;
  there is no per-source or per-pair match-level confidence metric.
