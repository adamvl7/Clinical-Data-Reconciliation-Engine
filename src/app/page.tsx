import Link from "next/link";
import WaveMeshBackground from "@/components/WaveMeshBackground";

function OnyeLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width="36"
        height="36"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="20" cy="8" r="5" fill="#3DBAA6" />
        <circle cx="8" cy="20" r="5" fill="#3DBAA6" />
        <circle cx="20" cy="20" r="5" fill="#2A9D8F" />
        <circle cx="32" cy="20" r="5" fill="#3DBAA6" />
        <circle cx="20" cy="32" r="5" fill="#E05A4E" />
      </svg>
      <span className="text-2xl font-semibold tracking-tight text-onye-700">
        onye
      </span>
    </div>
  );
}


function FolderShape({ color = "#e5e7eb", borderColor = "#d1d5db" }: { color?: string; borderColor?: string }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 200 160"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Back panel with tab */}
      <path
        d="M12 0 L70 0 L82 12 L188 12 C194.6 12 200 17.4 200 24 L200 148 C200 154.6 194.6 160 188 160 L12 160 C5.4 160 0 154.6 0 148 L0 12 C0 5.4 5.4 0 12 0 Z"
        fill={color}
        stroke={borderColor}
        strokeWidth="1.5"
      />
      {/* Front panel */}
      <rect x="0" y="24" width="200" height="136" rx="10" fill="white" stroke={borderColor} strokeWidth="1.5" />
    </svg>
  );
}

function SourceFolder({
  label,
  medication,
  detail,
  className = "",
}: {
  label: string;
  medication: string;
  detail: string;
  className?: string;
}) {
  return (
    <div className={`w-48 sm:w-52 shrink-0 ${className}`}>
      <div className="relative h-[168px]">
        <FolderShape color="#f3f4f6" borderColor="#d1d5db" />
        <div className="relative z-10 pt-8 pb-4 px-4 space-y-2.5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-sm font-semibold text-gray-700 leading-snug">
            {medication}
          </p>
          <p className="text-[11px] text-gray-400">{detail}</p>
          <div className="flex items-center gap-1 pt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] text-amber-500 font-medium">
              Conflicting
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function OnyeFolder() {
  return (
    <div className="w-48 sm:w-56 shrink-0 -translate-y-6 z-10">
      <div className="relative h-[210px]" style={{ filter: "drop-shadow(0 4px 20px rgba(62,186,166,0.2))" }}>
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 200 200"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 0 L70 0 L82 12 L188 12 C194.6 12 200 17.4 200 24 L200 188 C200 194.6 194.6 200 188 200 L12 200 C5.4 200 0 194.6 0 188 L0 12 C0 5.4 5.4 0 12 0 Z"
            fill="#3ebaa6"
            stroke="#2a9d8f"
            strokeWidth="1.5"
          />
          <rect x="0" y="24" width="200" height="176" rx="10" fill="white" stroke="#86dece" strokeWidth="2" />
        </svg>
        <div className="absolute top-0.5 left-3 z-20 flex items-center gap-1 px-1">
          <svg width="10" height="10" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="8" r="5" fill="white" fillOpacity={0.9} />
            <circle cx="8" cy="20" r="5" fill="white" fillOpacity={0.9} />
            <circle cx="20" cy="20" r="5" fill="white" />
            <circle cx="32" cy="20" r="5" fill="white" fillOpacity={0.9} />
            <circle cx="20" cy="32" r="5" fill="#fca5a5" />
          </svg>
          <span className="text-[8px] font-bold text-white tracking-wide">onye</span>
        </div>
        <div className="relative z-10 pt-9 pb-4 px-5 space-y-3">
          <p className="text-[11px] font-semibold text-onye-500 uppercase tracking-wider">
            Reconciled Result
          </p>
          <p className="text-base font-bold text-gray-900 leading-snug">
            Metformin 500mg twice daily
          </p>
          <p className="text-[11px] text-gray-500">
            Dose reduced &mdash; eGFR 45 (kidney function)
          </p>
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-onye-600">Confidence</span>
              <span className="text-[10px] font-bold text-onye-700">88%</span>
            </div>
            <div className="w-full bg-onye-100 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-onye-500" style={{ width: "88%" }} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[10px] font-semibold text-green-600">Safety Passed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FolderShowcase() {
  return (
    <div className="relative mx-auto max-w-5xl">
      <div className="flex items-end justify-center gap-3 sm:gap-5 pb-4 px-4">
        <SourceFolder
          label="Hospital EHR"
          medication="Metformin 1000mg twice daily"
          detail="Updated Oct 2024"
          className="opacity-60 translate-y-1 hidden sm:block [mask-image:linear-gradient(to_right,transparent_0%,black_60%)]"
        />
        <SourceFolder
          label="Primary Care"
          medication="Metformin 500mg twice daily"
          detail="Updated Jan 2025"
          className="opacity-90"
        />
        <OnyeFolder />
        <SourceFolder
          label="Pharmacy"
          medication="Metformin 1000mg daily"
          detail="Filled Jan 2025"
          className="opacity-90"
        />
        <SourceFolder
          label="Patient Report"
          medication="Metformin 1000mg once daily"
          detail="Self-reported"
          className="opacity-60 translate-y-1 hidden sm:block [mask-image:linear-gradient(to_left,transparent_0%,black_60%)]"
        />
      </div>
      {/* Connecting lines hint */}
      <p className="text-center text-xs text-gray-400 mt-4">
        Multiple sources, conflicting records &mdash;{" "}
        <span className="text-onye-600 font-semibold">
          one reconciled truth
        </span>
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <WaveMeshBackground />

      {/* Header */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <OnyeLogo />
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-onye-600 text-onye-700 text-sm font-semibold hover:bg-onye-600 hover:text-white transition-colors duration-200"
            >
              Go to Dashboard
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col">
        <section className="flex-1 flex flex-col items-center justify-center px-4 pt-12 sm:pt-20 pb-12">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-center text-gray-900 max-w-3xl leading-[1.1]" style={{ fontFamily: "var(--font-quicksand), sans-serif" }}>
            Reconcile with{" "}
            <span className="text-onye-600">Confidence</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-500 text-center max-w-2xl leading-relaxed font-bold" style={{ fontFamily: "var(--font-quicksand), sans-serif" }}>
            Onye is your AI-powered clinical data companion. Aggregate medication
            records from multiple sources, and let intelligent reconciliation
            deliver accurate, safe results you can trust.
          </p>
          <Link
            href="/dashboard"
            className="btn-onye mt-10 inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-white text-base font-semibold"
          >
            Open Dashboard
          </Link>
        </section>

        {/* Folder showcase */}
        <section className="px-4 sm:px-6 lg:px-8 pb-24 sm:pb-32">
          <FolderShowcase />
        </section>
      </main>
    </div>
  );
}
