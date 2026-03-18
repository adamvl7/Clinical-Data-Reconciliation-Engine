"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { medicationScenarios } from "@/data/medication-scenarios";
import type { ReconcileResponse } from "@/lib/types";

interface Props {
  apiKey: string;
  onResult?: (label: string, result: ReconcileResponse) => void;
  viewingResult?: ReconcileResponse;
}

type InputMode = "drop" | "paste";
type ActionStatus = Record<number, "approved" | "rejected">;

export default function MedicationReconciliation({ apiKey, onResult, viewingResult }: Props) {
  const [inputMode, setInputMode] = useState<InputMode>("drop");
  const [selectedScenario, setSelectedScenario] = useState(medicationScenarios[0].id);
  const [input, setInput] = useState(JSON.stringify(medicationScenarios[0].data, null, 2));
  const [result, setResult] = useState<ReconcileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionStatuses, setActionStatuses] = useState<ActionStatus>({});
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modalOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [modalOpen]);

  const processFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "json" && ext !== "txt") {
      setError("Please upload a .json or .txt file containing JSON");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        JSON.parse(text);
        setInput(text);
        setFileName(file.name);
        setError(null);
      } catch {
        setError("The file does not contain valid JSON");
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setActionStatuses({});
    setModalOpen(false);

    try {
      const body = JSON.parse(input);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers["x-api-key"] = apiKey;

      const response = await fetch("/api/reconcile/medication", {
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
        const med = (data as ReconcileResponse).reconciled_medication ?? "Unknown";
        onResult(med, data);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleActionStatus = (
    index: number,
    status: "approved" | "rejected"
  ) => {
    setActionStatuses((prev) => ({ ...prev, [index]: status }));
  };

  const confidenceColor = (score: number) => {
    if (score >= 0.8) return "text-green-800 bg-green-100 border-green-300";
    if (score >= 0.5) return "text-yellow-800 bg-yellow-100 border-yellow-300";
    return "text-red-800 bg-red-100 border-red-300";
  };

  const confidenceBarColor = (score: number) => {
    if (score >= 0.8) return "bg-green-600";
    if (score >= 0.5) return "bg-yellow-600";
    return "bg-red-600";
  };

  const displayResult = viewingResult ?? result;

  return (
    <div className="relative">
      {/* Floating input button — only visible when results are showing */}
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
              <h2 className="text-lg font-semibold text-gray-900">Reconcile Medications</h2>
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
                <label htmlFor="med-scenario" className="block text-xs font-medium text-gray-500 mb-1">
                  Test Scenario
                </label>
                <select
                  id="med-scenario"
                  value={selectedScenario}
                  onChange={(e) => {
                    const scenario = medicationScenarios.find((s) => s.id === e.target.value);
                    if (scenario) {
                      setSelectedScenario(scenario.id);
                      setInput(JSON.stringify(scenario.data, null, 2));
                      setFileName(null);
                      setResult(null);
                      setError(null);
                    }
                  }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-onye-500 focus:border-transparent"
                >
                  {medicationScenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {(() => {
                  const active = medicationScenarios.find((s) => s.id === selectedScenario);
                  return active ? (
                    <p className="mt-1.5 text-xs text-gray-400">
                      <span className="font-medium text-gray-500">Tests:</span> {active.edgeCase}
                    </p>
                  ) : null;
                })()}
              </div>

              {/* Drag & Drop Zone */}
              <div
                className={`relative rounded-xl border-2 border-dashed transition-colors duration-200 ${
                  dragActive
                    ? "border-onye-500 bg-onye-50"
                    : fileName
                      ? "border-onye-300 bg-onye-50/50"
                      : "border-gray-300 bg-white hover:border-onye-400 hover:bg-gray-50"
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center py-8 px-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                      fileName ? "bg-onye-100" : "bg-onye-50"
                    }`}
                  >
                    {fileName ? (
                      <svg className="w-6 h-6 text-onye-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-onye-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    )}
                  </div>

                  {fileName ? (
                    <>
                      <p className="text-sm text-gray-700 font-medium">{fileName}</p>
                      <p className="text-xs text-onye-600 mt-1">File loaded successfully</p>
                      <button
                        onClick={() => {
                          setFileName(null);
                          const active = medicationScenarios.find((s) => s.id === selectedScenario);
                          setInput(JSON.stringify(active?.data ?? {}, null, 2));
                        }}
                        className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        Remove file
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-700">
                        Drag and drop or{" "}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-onye-600 font-semibold hover:text-onye-700"
                        >
                          Upload a file
                        </button>
                        {" "}here
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        We support .json and .txt files containing JSON
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* OR separator */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs font-medium text-gray-400 uppercase">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Paste JSON toggle */}
              <button
                onClick={() => setInputMode(inputMode === "paste" ? "drop" : "paste")}
                className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm text-gray-600"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                  Paste JSON manually
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${inputMode === "paste" ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {inputMode === "paste" && (
                <textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setFileName(null);
                  }}
                  rows={12}
                  className="w-full font-mono text-sm p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-onye-500 focus:border-transparent bg-white"
                  placeholder="Enter medication reconciliation request JSON..."
                />
              )}
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
                    Reconciling...
                  </span>
                ) : (
                  "Reconcile Medications"
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
            <p className="text-sm">Analyzing medication records with AI...</p>
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
              Add Medication Data
            </p>
            <p className="text-gray-400 text-sm">
              Click here to select a scenario, upload a file, or paste JSON
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Reconciled Medication */}
              <div className="p-6 bg-white border border-gray-200 rounded-xl">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Reconciled Medication
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {displayResult.reconciled_medication}
                </p>
              </div>

              {/* Confidence Score */}
              <div
                className={`p-6 border rounded-xl ${confidenceColor(displayResult.confidence_score)}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold uppercase tracking-wide">
                    Confidence Score
                  </p>
                  <span className="text-3xl font-bold">
                    {(displayResult.confidence_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${confidenceBarColor(displayResult.confidence_score)}`}
                    style={{ width: `${displayResult.confidence_score * 100}%` }}
                  />
                </div>
              </div>

              {/* Clinical Safety */}
              <div
                className={`p-6 border rounded-xl flex flex-col justify-center ${
                  displayResult.clinical_safety_check === "PASSED"
                    ? "bg-green-100 border-green-300"
                    : "bg-red-100 border-red-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      displayResult.clinical_safety_check === "PASSED"
                        ? "bg-green-200 text-green-900"
                        : "bg-red-200 text-red-900"
                    }`}
                  >
                    {displayResult.clinical_safety_check}
                  </span>
                  <span className="text-base font-semibold">
                    Clinical Safety
                  </span>
                </div>
                {displayResult.safety_details && (
                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                    {displayResult.safety_details}
                  </p>
                )}
              </div>
            </div>

            {/* Confidence breakdown */}
            {displayResult.confidence_breakdown && (
              <div className="p-6 bg-white border border-gray-200 rounded-xl">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Confidence Breakdown
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-5">
                  {Object.entries(displayResult.confidence_breakdown).map(
                    ([key, val]) => (
                      <div key={key}>
                        <p className="text-sm text-gray-500 capitalize mb-1">
                          {key.replace(/_/g, " ")}
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {((val as number) * 100).toFixed(0)}%
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div
                            className={`h-2 rounded-full ${confidenceBarColor(val as number)}`}
                            style={{ width: `${(val as number) * 100}%` }}
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* AI Reasoning */}
            <div className="p-6 bg-white border border-gray-200 rounded-xl">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                AI Reasoning
              </p>
              <p className="text-base text-gray-700 leading-relaxed">
                {displayResult.reasoning}
              </p>
            </div>

            {/* Recommended Actions */}
            {displayResult.recommended_actions.length > 0 &&
              displayResult.recommended_actions.some((_, i) => actionStatuses[i] !== "rejected") && (
              <div className="p-6 bg-white border border-gray-200 rounded-xl">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Recommended Actions
                </p>
                <ul className="space-y-3">
                  {displayResult.recommended_actions.map((action, i) => {
                    if (actionStatuses[i] === "rejected") return null;
                    return (
                      <li
                        key={i}
                        className={`flex items-start justify-between gap-4 p-4 rounded-lg transition-all duration-300 ${
                          actionStatuses[i] === "approved"
                            ? "bg-green-50 border border-green-200"
                            : "bg-gray-50"
                        }`}
                      >
                        <span className="text-base text-gray-700 flex-1">
                          {action}
                        </span>
                        <div className="flex gap-1.5 shrink-0">
                          {actionStatuses[i] === "approved" ? (
                            <span className="px-3 py-1.5 rounded text-sm font-semibold bg-green-200 text-green-800">
                              Accepted
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleActionStatus(i, "approved")}
                                className="px-3 py-1.5 text-sm font-medium rounded bg-green-200 text-green-800 hover:bg-green-300 transition-colors"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleActionStatus(i, "rejected")}
                                className="px-3 py-1.5 text-sm font-medium rounded bg-red-200 text-red-800 hover:bg-red-300 transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Duplicates Detected */}
            {displayResult.duplicates_detected.length > 0 && (
              <div className="p-6 bg-yellow-100 border border-yellow-300 rounded-xl">
                <p className="text-sm font-semibold text-yellow-800 uppercase tracking-wide mb-3">
                  Duplicate Records Detected
                </p>
                {displayResult.duplicates_detected.map((dup, i) => (
                  <div key={i} className="text-base text-yellow-900">
                    Sources at indices [{dup.indices.join(", ")}] appear to be
                    duplicates:
                    <span className="font-semibold ml-1">
                      {dup.normalized_medication}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
