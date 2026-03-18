# Clinical Data Reconciliation Engine

A full-stack web application that uses AI to reconcile conflicting clinical data from multiple healthcare systems and assess patient record quality. Built for the Full Stack Developer - EHR Integration Intern assessment.

## Live Demo

Deployed on Vercel: https://clinical-data-reconciliation-engine-phi.vercel.app/

## Quick Start

### Prerequisites

- Node.js 20+
- A Google Gemini API key ([aistudio.google.com](https://aistudio.google.com/apikey))

### Local Setup

```bash
# Clone the repository
git clone <repo-url>
cd clinical-reconciliation

# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Demo Mode**: If no `GEMINI_API_KEY` is set, the app runs with realistic mock responses so you can explore all features without an API key.

### Docker

```bash
# Build and run
docker compose up --build

# Or without compose
docker build -t clinical-reconciliation .
docker run -p 3000:3000 \
  -e GEMINI_API_KEY=your-key \
  -e API_SECRET_KEY=your-secret \
  clinical-reconciliation
```

## API Endpoints

The API is limited to the following endpoints as specified in the assessment:

### `POST /api/reconcile/medication`

Reconciles conflicting medication records from different systems using AI-powered clinical reasoning.

**Headers**: `x-api-key: <your-secret>` (required if `API_SECRET_KEY` is set)

**Request body**:

```json
{
  "patient_context": {
    "age": 67,
    "conditions": ["Type 2 Diabetes", "Hypertension"],
    "recent_labs": { "eGFR": 45 }
  },
  "sources": [
    {
      "system": "Hospital EHR",
      "medication": "Metformin 1000mg twice daily",
      "last_updated": "2024-10-15",
      "source_reliability": "high"
    },
    {
      "system": "Primary Care",
      "medication": "Metformin 500mg twice daily",
      "last_updated": "2025-01-20",
      "source_reliability": "high"
    }
  ],
  "webhook_url": "https://example.com/webhook"
}
```

**Response**:

```json
{
  "reconciled_medication": "Metformin 500mg twice daily",
  "confidence_score": 0.88,
  "confidence_breakdown": {
    "source_reliability": 0.90,
    "recency": 0.80,
    "cross_source_agreement": 0.50,
    "clinical_compatibility": 0.75,
    "llm_certainty": 0.85
  },
  "reasoning": "Primary care record is most recent...",
  "recommended_actions": ["Confirm continuation of Metformin 500mg twice daily."],
  "clinical_safety_check": "PASSED",
  "duplicates_detected": []
}
```

### `POST /api/validate/data-quality`

Evaluates patient record quality across four dimensions: completeness, accuracy, timeliness, and clinical plausibility.

**Request body**:

```json
{
  "demographics": { "name": "John Doe", "dob": "1955-03-15", "gender": "M" },
  "medications": ["Metformin 500mg", "Lisinopril 10mg"],
  "allergies": [],
  "conditions": ["Type 2 Diabetes"],
  "vital_signs": { "blood_pressure": "340/180", "heart_rate": 72 },
  "last_updated": "2024-06-15"
}
```

**Response**:

```json
{
  "overall_score": 62,
  "breakdown": {
    "completeness": 60,
    "accuracy": 50,
    "timeliness": 70,
    "clinical_plausibility": 40
  },
  "issues_detected": [
    {
      "field": "vital_signs.blood_pressure",
      "issue": "Blood pressure systolic 340 is physiologically implausible",
      "severity": "high"
    }
  ]
}
```

## LLM Integration: Google Gemini

### Why Gemini?

- **Strong clinical reasoning**: Performs well on medical/scientific tasks, making it a natural fit for medication reconciliation
- **Reliable structured output**: System instructions enforce JSON-only responses with explicit schemas, minimizing parsing failures
- **Cost-effective**: Gemini 2.5 Flash provides fast inference at low cost, which is important for a prototype with many test interactions. Additionally, we chose this model because our implementation includes robust logic that ensures high accuracy, so we do not require a more powerful or expensive AI model.
- **Modern SDK**: The `@google/genai` package offers a clean, well-documented API

### Prompt Engineering Approach

Three specialized prompt sets are used, each with a system message that:

1. **Defines the AI's role** — clinical pharmacist (reconciliation), data quality analyst (validation), or healthcare data assistant (issue resolution)
2. **Enforces JSON-only output** with an explicit schema to ensure parseable responses
3. **Sets the audience** — all prompts instruct the LLM to write in patient-friendly language since the UI is patient-facing
4. **Provides clinical guardrails** to prevent hallucination of medical facts

The reconciliation prompt includes:
- Full patient context (age, conditions, labs)
- All conflicting source records with metadata (system, date, reliability)
- Pre-computed heuristic rankings to ground the LLM's analysis in data

If JSON parsing fails, the system falls back to safe defaults rather than crashing.

### Caching Strategy

An in-memory cache (keyed by a SHA-256 hash of endpoint + payload) avoids redundant LLM calls during development and repeated UI interactions. Default TTL is 5 minutes.

### Error Handling & Rate Limiting

- **Outbound**: Exponential backoff retries for Gemini rate limits (429) and server errors (500, 503)
- **Inbound**: Per-IP sliding window rate limiter (15 requests/minute) on all API routes, returning 429 with `Retry-After` headers
- **Graceful degradation**: If the LLM call fails entirely, the data quality engine falls back to heuristic-only scoring

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── reconcile/medication/route.ts   # POST - medication reconciliation
│   │   ├── validate/data-quality/route.ts  # POST - data quality evaluation
│   │   ├── resolve-issue/route.ts          # POST - AI-guided issue resolution
│   │   └── status/route.ts                 # GET  - demo mode check
│   ├── dashboard/
│   │   └── page.tsx                        # Dashboard (sidebar + tabs)
│   ├── layout.tsx                          # Root layout
│   ├── page.tsx                            # Landing page
│   └── globals.css
├── components/
│   ├── MedicationReconciliation.tsx        # Reconciliation UI (drag-drop, paste, scenarios)
│   ├── DataQuality.tsx                     # Data quality UI with interactive issue resolution
│   └── WaveMeshBackground.tsx              # Animated background
├── lib/
│   ├── types.ts                # Zod schemas + TypeScript types
│   ├── auth.ts                 # API key middleware
│   ├── cache.ts                # In-memory LLM response cache
│   ├── rateLimit.ts            # Per-IP sliding window rate limiter
│   ├── clinicalRules.ts        # Heuristic clinical checks
│   ├── reconciliationEngine.ts # Core reconciliation logic
│   ├── dataQualityEngine.ts    # Data quality scoring
│   └── llm/
│       └── geminiClient.ts     # Gemini API wrapper + all LLM prompts
├── data/
│   ├── sample-medications.json # Original PDF example (medication)
│   ├── sample-patients.json    # Original PDF example (data quality)
│   ├── medication-scenarios.ts # 8 test scenarios for reconciliation
│   └── patient-scenarios.ts    # 8 test scenarios for data quality
tests/
├── auth.test.ts                # API key authentication (4 tests)
├── clinicalRules.test.ts       # Vital signs, safety checks, compatibility (6 tests)
├── dataQuality.test.ts         # Data quality scoring engine (2 tests)
└── reconciliationEngine.test.ts # Duplicate detection + reconciliation (4 tests)
```

## Test Data & Scenarios

Test scenarios are modeled on clinical patterns found in MIMIC-III / PyHealth EHR datasets to reflect realistic data conflicts, edge cases, and safety concerns seen in real hospital systems.

Both the Medication Reconciliation and Data Quality views include a **scenario selector dropdown** so reviewers can quickly cycle through each case.

### Medication Reconciliation Scenarios (8)

| Scenario | Edge Case Tested |
|----------|-----------------|
| Metformin Dose Conflict (PDF Example) | Dose reduction with declining kidney function (eGFR 45) |
| Unanimous Agreement (Lisinopril) | Full cross-source agreement; high confidence expected |
| Critical Kidney Function (eGFR < 30) | Safety flag: metformin contraindicated at eGFR 22 |
| Excessive Dose (> 2000mg Metformin) | Safety flag: dose exceeds pharmacological maximum |
| Stale Records (> 1 Year Old) | Low recency scores, mixed reliability |
| Duplicate Sources with Conflicts | Duplicate detection with 5 sources, mixed agreement |
| Frequency-Only Mismatch (Amlodipine) | Same drug/dose, different frequencies (daily vs BID) |
| Minimal Patient Context | Missing age, conditions, labs; graceful degradation |

### Data Quality Scenarios (8)

| Scenario | Edge Case Tested |
|----------|-----------------|
| Implausible BP (PDF Example) | Physiologically impossible vitals, missing allergies, stale data |
| Near-Perfect Record | Complete, recent, plausible data; high score baseline |
| Severely Incomplete Record | Almost no data; tests completeness floor |
| Multiple Implausible Vitals | HR 300, temp 110F, BP 40/200, SpO2 150 |
| Very Stale Data (3+ Years Old) | Timeliness scoring under extreme staleness |
| Drug-Disease Mismatch | Diabetes diagnosis but no diabetes meds |
| Invalid Demographics (Future DOB) | Negative calculated age; accuracy validation |
| Inverted Blood Pressure | Systolic < diastolic (80/120); BP-specific rule |

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Next.js App Router** | Unified frontend/backend in one deployable unit; excellent Vercel integration |
| **Zod validation** | Runtime type safety for API inputs; auto-generates clear error messages |
| **Heuristic + LLM hybrid** | Heuristics provide deterministic baseline scoring; LLM adds nuanced clinical reasoning. Rule-based issues are prioritized and LLM duplicates are suppressed |
| **Confidence calibration** | Multi-factor weighted score (reliability, recency, agreement, clinical fit, LLM certainty) rather than relying on a single signal |
| **Patient-facing language** | All AI outputs are written for the patient, not the clinician, since this is a patient-facing tool |
| **Interactive issue resolution** | When a patient accepts a data quality issue, the AI asks targeted follow-up questions and auto-updates their record — reducing friction instead of just flagging problems |
| **In-memory rate limiter** | Sliding window (15 req/min per IP) protects API endpoints without external dependencies |
| **In-memory cache** | Simple, zero-dependency caching sufficient for this scale; avoids Redis overhead |
| **Google Gemini** | Strong clinical reasoning, reliable JSON output, cost-effective inference via Gemini 2.5 Flash |

## Bonus Features

- **Confidence score calibration**: Multi-factor model combining source reliability, recency, cross-source agreement, clinical compatibility, and LLM certainty
- **Duplicate record detection**: Medication string normalization and similarity matching to detect effectively identical records across systems
- **Webhook support**: Both endpoints accept an optional `webhook_url` parameter; results are POSTed asynchronously after computation
- **Docker containerization**: Multi-stage Dockerfile with standalone Next.js output for minimal image size
- **Vercel deployment**: Zero-config deployment with environment variable management

## Deployment to Vercel

1. Push the repository to GitHub
2. Connect the repo in the [Vercel dashboard](https://vercel.com/new)
3. Set environment variables:
   - `GEMINI_API_KEY` — your Google Gemini API key
   - `API_SECRET_KEY` — optional, protects API endpoints
4. Deploy (Vercel auto-detects Next.js)

## Testing

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch
```

16 unit tests across 4 files covering:
- Duplicate detection logic (exact matches, different meds, different doses)
- Clinical rules (vital signs plausibility, safety checks, compatibility scoring)
- Data quality scoring engine (completeness, accuracy, timeliness, plausibility)
- API key authentication (missing key, wrong key, correct key, no secret set)

LLM calls are mocked in tests for deterministic, fast execution.

## What I'd Improve With More Time

- **Persistent storage**: Replace in-memory cache with Redis or a database for production use
- **FHIR compliance**: Map inputs/outputs to HL7 FHIR resource formats for real EHR interoperability
- **Audit trail**: Log all reconciliation decisions with timestamps for compliance
- **More granular clinical rules**: Expand the heuristic rule set beyond the current metformin/BP examples
- **E2E tests**: Add Playwright tests for the full dashboard workflow
- **Streaming responses**: Stream LLM responses to the UI for better perceived performance
- **Multi-language support**: Internationalize the patient-facing text

## Estimated Time Spent

Approximately **20 hours** across design, implementation, testing, and documentation.
