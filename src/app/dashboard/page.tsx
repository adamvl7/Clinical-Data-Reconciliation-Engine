"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import MedicationReconciliation from "@/components/MedicationReconciliation";
import DataQuality from "@/components/DataQuality";
import WaveMeshBackground from "@/components/WaveMeshBackground";
import type { ReconcileResponse, DataQualityResponse } from "@/lib/types";

type Tab = "reconciliation" | "quality";

interface HistoryEntry {
  id: string;
  tab: Tab;
  label: string;
  timestamp: Date;
  result: ReconcileResponse | DataQualityResponse;
}

function PillIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859" />
    </svg>
  );
}

function ChartIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function ClockIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChevronIcon({ className = "w-5 h-5", direction = "left" }: { className?: string; direction?: "left" | "right" }) {
  return (
    <svg className={`${className} transition-transform ${direction === "right" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("reconciliation");
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => setIsDemoMode(data.demo_mode))
      .catch(() => {});
  }, []);

  const addToHistory = useCallback((tab: Tab, label: string, result: ReconcileResponse | DataQualityResponse) => {
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      tab,
      label,
      timestamp: new Date(),
      result,
    };
    setHistory((prev) => [entry, ...prev].slice(0, 50));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setViewingHistoryId(null);
  }, []);

  const viewingEntry = viewingHistoryId ? history.find((h) => h.id === viewingHistoryId) : null;

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "reconciliation",
      label: "Medication Reconciliation",
      icon: <PillIcon />,
    },
    {
      id: "quality",
      label: "Data Quality",
      icon: <ChartIcon />,
    },
  ];

  const reconciliationHistory = history.filter((h) => h.tab === "reconciliation");
  const qualityHistory = history.filter((h) => h.tab === "quality");
  const currentHistory = activeTab === "reconciliation" ? reconciliationHistory : qualityHistory;

  return (
    <div className="min-h-screen flex bg-gray-100 font-medium">
      {/* Sidebar */}
      <aside
        className={`shrink-0 flex flex-col bg-gradient-to-b from-[#0F3F3A] to-[#12524C] text-white transition-all duration-300 relative ${
          sidebarOpen ? "w-64" : "w-16"
        }`}
      >
        {/* Toggle button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-20 z-30 w-6 h-6 bg-[#0F3F3A] border-2 border-white/20 rounded-full flex items-center justify-center hover:bg-[#12524C] transition-colors shadow-md"
        >
          <ChevronIcon className="w-3.5 h-3.5 text-white/80" direction={sidebarOpen ? "left" : "right"} />
        </button>

        {/* Logo */}
        <div className={`pt-7 pb-6 ${sidebarOpen ? "px-6" : "px-3"}`}>
          <Link href="/" className="flex items-center gap-2.5">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <circle cx="20" cy="8" r="5" fill="#5ED4C2" />
              <circle cx="8" cy="20" r="5" fill="#5ED4C2" />
              <circle cx="20" cy="20" r="5" fill="#3DBAA6" />
              <circle cx="32" cy="20" r="5" fill="#5ED4C2" />
              <circle cx="20" cy="32" r="5" fill="#E05A4E" />
            </svg>
            {sidebarOpen && (
              <span className="text-xl font-semibold tracking-tight text-white">onye</span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 space-y-1 ${sidebarOpen ? "px-3" : "px-2"}`}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setViewingHistoryId(null); }}
              title={!sidebarOpen ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                sidebarOpen ? "" : "justify-center !px-0"
              } ${
                activeTab === item.id
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/60 hover:bg-white/8 hover:text-white/90"
              }`}
            >
              {item.icon}
              {sidebarOpen && item.label}
            </button>
          ))}

          {/* History section */}
          {sidebarOpen && currentHistory.length > 0 && (
            <div className="pt-4 mt-4 border-t border-white/10">
              <div className="flex items-center justify-between px-2 mb-2">
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                  History
                </p>
                <button
                  onClick={clearHistory}
                  className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
                {currentHistory.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setViewingHistoryId(entry.id === viewingHistoryId ? null : entry.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all duration-150 ${
                      viewingHistoryId === entry.id
                        ? "bg-white/15 text-white"
                        : "text-white/50 hover:bg-white/8 hover:text-white/80"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ClockIcon className="w-3 h-3 shrink-0 opacity-60" />
                      <span className="truncate">{entry.label}</span>
                    </div>
                    <p className="text-[10px] opacity-50 ml-5 mt-0.5">
                      {formatTime(entry.timestamp)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Collapsed history indicator */}
          {!sidebarOpen && history.length > 0 && (
            <div className="pt-4 mt-4 border-t border-white/10 flex justify-center">
              <button
                onClick={() => setSidebarOpen(true)}
                title="View history"
                className="relative text-white/40 hover:text-white/80 transition-colors"
              >
                <ClockIcon className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-onye-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                  {history.length}
                </span>
              </button>
            </div>
          )}
        </nav>

        {/* Sidebar footer */}
        <div className={`py-5 border-t border-white/10 ${sidebarOpen ? "px-4" : "px-2"}`}>
          {sidebarOpen ? (
            <p className="text-[11px] text-white/30 text-center">
              Clinical Reconciliation Engine
            </p>
          ) : (
            <p className="text-[9px] text-white/20 text-center">CRE</p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <WaveMeshBackground />

        {/* Top bar */}
        <header className="relative z-10 h-16 shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900">
              {viewingEntry
                ? `History: ${viewingEntry.label}`
                : activeTab === "reconciliation"
                  ? "Medication Reconciliation"
                  : "Data Quality"}
            </h1>
            {viewingEntry && (
              <button
                onClick={() => setViewingHistoryId(null)}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
              >
                Back to live
              </button>
            )}
            {isDemoMode && !viewingEntry && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                Demo Mode
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
          </div>
        </header>

        {/* Demo mode banner */}
        {isDemoMode && !viewingEntry && (
          <div className="relative z-10 bg-amber-50/90 backdrop-blur-sm border-b border-amber-200 px-6 py-2 text-sm text-amber-800">
            <span className="font-semibold">Demo Mode</span> — No{" "}
            <code className="bg-amber-100 px-1 rounded text-xs">GEMINI_API_KEY</code>{" "}
            detected. Responses use realistic mock data.
          </div>
        )}

        {/* Page content */}
        <main className="relative z-10 flex-1 overflow-y-auto p-6">
          {activeTab === "reconciliation" ? (
            <MedicationReconciliation
              apiKey=""
              onResult={(label, result) => addToHistory("reconciliation", label, result)}
              viewingResult={viewingEntry?.tab === "reconciliation" ? viewingEntry.result as ReconcileResponse : undefined}
            />
          ) : (
            <DataQuality
              apiKey=""
              onResult={(label, result) => addToHistory("quality", label, result)}
              viewingResult={viewingEntry?.tab === "quality" ? viewingEntry.result as DataQualityResponse : undefined}
            />
          )}
        </main>
      </div>
    </div>
  );
}
