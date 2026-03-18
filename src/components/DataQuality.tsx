"use client";

import { useState, useEffect, useRef } from "react";
import { patientScenarios } from "@/data/patient-scenarios";
import type { DataQualityResponse, DataQualityIssue } from "@/lib/types";

interface Props {
  apiKey: string;
  onResult?: (label: string, result: DataQualityResponse) => void;
  viewingResult?: DataQualityResponse;
}

type IssueStatus = Record<string, "accepted" | "dismissed" | "resolving" | "resolved">;

interface ResolutionQuestion {
  id: string;
  question: string;
  type: "text" | "select";
  options?: string[];
}

interface ResolutionState {
  issueKey: string;
  step: "loading" | "questions" | "submitting" | "done";
  message: string;
  questions: ResolutionQuestion[];
  answers: Record<string, string>;
  resultMessage?: string;
  updatedFields?: Record<string, unknown>;
}

export default function DataQuality({ apiKey, onResult, viewingResult }: Props) {
  const [selectedScenario, setSelectedScenario] = useState(patientScenarios[0].id);
  const [input, setInput] = useState(JSON.stringify(patientScenarios[0].data, null, 2));
  const [result, setResult] = useState<DataQualityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueStatuses, setIssueStatuses] = useState<IssueStatus>({});
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, ResolutionState>>({});
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modalOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [modalOpen]);

  const getPatientRecord = (): Record<string, unknown> => {
    try {
      return JSON.parse(input);
    } catch {
      return {};
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setIssueStatuses({});
    setResolutions({});
    setModalOpen(false);

    try {
      const body = JSON.parse(input);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers["x-api-key"] = apiKey;

      const response = await fetch("/api/validate/data-quality", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || `Request failed with status ${response.status}`);
        return;
      }

      setResult(data);
      if (onResult) {
        const score = (data as DataQualityResponse).overall_score;
        onResult(`Quality ${score}/100`, data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (issueKey: string) => {
    setIssueStatuses((prev) => ({ ...prev, [issueKey]: "dismissed" }));
  };

  const handleAccept = async (issueKey: string, issue: DataQualityIssue) => {
    setIssueStatuses((prev) => ({ ...prev, [issueKey]: "resolving" }));
    setResolutions((prev) => ({
      ...prev,
      [issueKey]: {
        issueKey,
        step: "loading",
        message: "",
        questions: [],
        answers: {},
      },
    }));

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["x-api-key"] = apiKey;

      const response = await fetch("/api/resolve-issue", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "get_questions",
          issue: { field: issue.field, issue: issue.issue, severity: issue.severity },
          patient_record: getPatientRecord(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setIssueStatuses((prev) => ({ ...prev, [issueKey]: "accepted" }));
        setResolutions((prev) => {
          const copy = { ...prev };
          delete copy[issueKey];
          return copy;
        });
        return;
      }

      setResolutions((prev) => ({
        ...prev,
        [issueKey]: {
          ...prev[issueKey],
          step: "questions",
          message: data.message,
          questions: data.questions,
        },
      }));
    } catch {
      setIssueStatuses((prev) => ({ ...prev, [issueKey]: "accepted" }));
    }
  };

  const handleAnswerChange = (issueKey: string, questionId: string, value: string) => {
    setResolutions((prev) => ({
      ...prev,
      [issueKey]: {
        ...prev[issueKey],
        answers: { ...prev[issueKey].answers, [questionId]: value },
      },
    }));
  };

  const handleSubmitAnswers = async (issueKey: string, issue: DataQualityIssue) => {
    const resolution = resolutions[issueKey];
    if (!resolution) return;

    setResolutions((prev) => ({
      ...prev,
      [issueKey]: { ...prev[issueKey], step: "submitting" },
    }));

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["x-api-key"] = apiKey;

      const response = await fetch("/api/resolve-issue", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "apply_answers",
          issue: { field: issue.field, issue: issue.issue, severity: issue.severity },
          answers: resolution.answers,
          patient_record: getPatientRecord(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setResolutions((prev) => ({
          ...prev,
          [issueKey]: { ...prev[issueKey], step: "questions" },
        }));
        return;
      }

      setResolutions((prev) => ({
        ...prev,
        [issueKey]: {
          ...prev[issueKey],
          step: "done",
          resultMessage: data.message,
          updatedFields: data.updated_fields,
        },
      }));
      setIssueStatuses((prev) => ({ ...prev, [issueKey]: "resolved" }));

      if (data.updated_fields && Object.keys(data.updated_fields).length > 0) {
        try {
          const current = JSON.parse(input);
          const updated = { ...current, ...data.updated_fields };
          setInput(JSON.stringify(updated, null, 2));
        } catch {
          // input isn't valid JSON, skip auto-update
        }
      }
    } catch {
      setResolutions((prev) => ({
        ...prev,
        [issueKey]: { ...prev[issueKey], step: "questions" },
      }));
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return { text: "text-green-800", bg: "bg-green-100", border: "border-green-300", bar: "bg-green-600" };
    if (score >= 50) return { text: "text-yellow-800", bg: "bg-yellow-100", border: "border-yellow-300", bar: "bg-yellow-600" };
    return { text: "text-red-800", bg: "bg-red-100", border: "border-red-300", bar: "bg-red-600" };
  };

  const severityStyle = (severity: string) => {
    switch (severity) {
      case "high": return "bg-red-200 text-red-800";
      case "medium": return "bg-yellow-200 text-yellow-800";
      case "low": return "bg-onye-200 text-onye-800";
      default: return "bg-gray-200 text-gray-800";
    }
  };

  const displayResult = viewingResult ?? result;

  const filteredIssues = displayResult?.issues_detected.filter(
    (issue) => filterSeverity === "all" || issue.severity === filterSeverity
  ) ?? [];

  const visibleIssues = filteredIssues.filter((issue) => {
    const key = `${issue.field}:${issue.issue}`;
    const status = issueStatuses[key];
    // Hide issues that have been dismissed or fully resolved
    return status !== "dismissed" && status !== "resolved";
  });

  return (
    <div className="relative">
      {/* Floating input button */}
      {(displayResult || loading || error) && (
        <button
          onClick={() => setModalOpen(true)}
          className="fixed bottom-8 right-8 z-40 w-14 h-14 bg-onye-600 hover:bg-onye-700 active:scale-95 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-200"
          title="Add data"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
        </button>
      )}

      {/* Modal overlay */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            ref={modalRef}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col animate-in"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Evaluate Data Quality</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Scenario select */}
              <div>
                <label htmlFor="dq-scenario" className="block text-xs font-medium text-gray-500 mb-1">
                  Test Scenario
                </label>
                <select
                  id="dq-scenario"
                  value={selectedScenario}
                  onChange={(e) => {
                    const scenario = patientScenarios.find((s) => s.id === e.target.value);
                    if (scenario) {
                      setSelectedScenario(scenario.id);
                      setInput(JSON.stringify(scenario.data, null, 2));
                      setResult(null);
                      setError(null);
                    }
                  }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-onye-500 focus:border-transparent"
                >
                  {patientScenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {(() => {
                  const active = patientScenarios.find((s) => s.id === selectedScenario);
                  return active ? (
                    <p className="mt-1.5 text-xs text-gray-400">
                      <span className="font-medium text-gray-500">Tests:</span> {active.edgeCase}
                    </p>
                  ) : null;
                })()}
              </div>

              {/* JSON textarea */}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={14}
                className="w-full font-mono text-sm p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-onye-500 focus:border-transparent bg-white"
                placeholder="Enter patient record JSON..."
              />
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-3 px-4 bg-onye-600 text-white font-semibold rounded-xl hover:bg-onye-700 disabled:bg-onye-300 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Evaluating...
                  </span>
                ) : (
                  "Evaluate Data Quality"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-width Results */}
      <div className="space-y-4">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700 font-medium">Error</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        )}

        {loading && (
          <div className="p-12 text-center text-gray-500 bg-white border border-gray-200 rounded-xl">
            <div className="inline-block w-8 h-8 border-2 border-onye-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm">Analyzing data quality with AI...</p>
          </div>
        )}

        {!displayResult && !loading && !error && (
          <button
            onClick={() => setModalOpen(true)}
            className="w-full flex flex-col items-center justify-center py-28 text-center bg-white/60 border-2 border-dashed border-gray-300 rounded-2xl hover:border-onye-400 hover:bg-onye-50/40 transition-all duration-200 cursor-pointer group"
          >
            <div className="w-20 h-20 rounded-2xl bg-onye-50 group-hover:bg-onye-100 flex items-center justify-center mb-5 transition-colors">
              <svg className="w-10 h-10 text-onye-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <p className="text-gray-700 text-lg font-semibold mb-1 group-hover:text-onye-700 transition-colors">
              Add Patient Data
            </p>
            <p className="text-gray-400 text-sm">
              Click here to select a scenario or paste patient record JSON
            </p>
          </button>
        )}

        {displayResult && (
          <div className="space-y-4">
            {viewingResult && (
              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                Viewing saved result
              </div>
            )}

            {/* Top summary row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Overall Score */}
              {(() => {
                const colors = scoreColor(displayResult.overall_score);
                return (
                  <div className={`p-5 border rounded-xl ${colors.bg} ${colors.border}`}>
                    <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${colors.text}`}>
                      Overall Score
                    </p>
                    <div className="flex items-end gap-1">
                      <span className={`text-3xl font-bold ${colors.text}`}>
                        {displayResult.overall_score}
                      </span>
                      <span className={`text-sm font-normal mb-1 ${colors.text}`}>/100</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full transition-all ${colors.bar}`}
                        style={{ width: `${displayResult.overall_score}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Dimension Breakdown cards */}
              {Object.entries(displayResult.breakdown).map(([key, value]) => {
                const colors = scoreColor(value);
                return (
                  <div
                    key={key}
                    className={`p-5 border rounded-xl ${colors.bg} ${colors.border}`}
                  >
                    <p className="text-xs font-medium text-gray-500 capitalize mb-1">
                      {key.replace(/_/g, " ")}
                    </p>
                    <div className="flex items-end gap-1">
                      <span className={`text-2xl font-bold ${colors.text}`}>{value}</span>
                      <span className="text-xs text-gray-400 mb-1">/100</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                      <div
                        className={`h-1.5 rounded-full ${colors.bar}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Issues List */}
            <div className="p-5 bg-white border border-gray-200 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Issues Detected ({visibleIssues.length})
                </p>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1"
                >
                  <option value="all">All Severities</option>
                  <option value="high">High Only</option>
                  <option value="medium">Medium Only</option>
                  <option value="low">Low Only</option>
                </select>
              </div>

              {visibleIssues.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No issues found for this filter</p>
              ) : (
                <ul className="space-y-3">
                  {visibleIssues.map((issue: DataQualityIssue, i: number) => {
                    const issueKey = `${issue.field}:${issue.issue}`;
                    const status = issueStatuses[issueKey];
                    const resolution = resolutions[issueKey];

                    return (
                      <li
                        key={i}
                        className={`rounded-xl border transition-all duration-300 overflow-hidden ${
                          status === "resolved"
                            ? "bg-green-50 border-green-200"
                            : status === "resolving"
                              ? "bg-onye-50/50 border-onye-200"
                              : "bg-gray-50 border-gray-100"
                        }`}
                      >
                        {/* Issue header */}
                        <div className="flex items-start justify-between gap-3 p-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityStyle(issue.severity)}`}
                              >
                                {issue.severity}
                              </span>
                              <code className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                {issue.field}
                              </code>
                            </div>
                            <p className="text-sm text-gray-700">{issue.issue}</p>
                          </div>
                          <div className="shrink-0">
                            {status === "resolved" ? (
                              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-200 text-green-800">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Updated
                              </span>
                            ) : status === "resolving" ? (
                              <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-onye-100 text-onye-700">
                                Resolving...
                              </span>
                            ) : (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleAccept(issueKey, issue)}
                                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-onye-100 text-onye-800 hover:bg-onye-200 transition-colors"
                                >
                                  Fix This
                                </button>
                                <button
                                  onClick={() => handleDismiss(issueKey)}
                                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* AI Resolution panel */}
                        {resolution && status !== "dismissed" && (
                          <div className="border-t border-gray-200/60 bg-white/80 px-4 py-4">
                            {resolution.step === "loading" && (
                              <div className="flex items-center gap-3 text-sm text-gray-500">
                                <div className="w-4 h-4 border-2 border-onye-500 border-t-transparent rounded-full animate-spin" />
                                AI is preparing questions for you...
                              </div>
                            )}

                            {(resolution.step === "questions" || resolution.step === "submitting") && (
                              <div className="space-y-4">
                                <div className="flex items-start gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-onye-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <svg className="w-4 h-4 text-onye-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                                    </svg>
                                  </div>
                                  <p className="text-sm text-gray-700 font-medium pt-1">
                                    {resolution.message}
                                  </p>
                                </div>

                                <div className="space-y-3 pl-9">
                                  {resolution.questions.map((q) => (
                                    <div key={q.id}>
                                      <label className="block text-sm text-gray-600 mb-1.5">
                                        {q.question}
                                      </label>
                                      {q.type === "select" && q.options ? (
                                        <div className="flex flex-wrap gap-2">
                                          {q.options.map((opt) => (
                                            <button
                                              key={opt}
                                              onClick={() => handleAnswerChange(issueKey, q.id, opt)}
                                              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                                resolution.answers[q.id] === opt
                                                  ? "bg-onye-100 border-onye-300 text-onye-800 font-medium"
                                                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                                              }`}
                                            >
                                              {opt}
                                            </button>
                                          ))}
                                        </div>
                                      ) : (
                                        <input
                                          type="text"
                                          value={resolution.answers[q.id] ?? ""}
                                          onChange={(e) => handleAnswerChange(issueKey, q.id, e.target.value)}
                                          placeholder="Type your answer..."
                                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-onye-500 focus:border-transparent"
                                        />
                                      )}
                                    </div>
                                  ))}

                                  <button
                                    onClick={() => handleSubmitAnswers(issueKey, issue)}
                                    disabled={
                                      resolution.step === "submitting" ||
                                      resolution.questions.some((q) => !resolution.answers[q.id]?.trim())
                                    }
                                    className="mt-2 px-4 py-2 text-sm font-medium rounded-lg bg-onye-600 text-white hover:bg-onye-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                  >
                                    {resolution.step === "submitting" ? (
                                      <span className="flex items-center gap-2">
                                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Updating...
                                      </span>
                                    ) : (
                                      "Update My Record"
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}

                            {resolution.step === "done" && (
                              <div className="flex items-start gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-green-800">
                                    {resolution.resultMessage}
                                  </p>
                                  {resolution.updatedFields && Object.keys(resolution.updatedFields).length > 0 && (
                                    <p className="text-xs text-green-600 mt-1">
                                      Your record has been updated automatically.
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
