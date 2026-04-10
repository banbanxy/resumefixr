"use client";

import { use, useEffect, useState, Suspense } from "react";
import { PaywallSection } from "@/components/PaywallSection";

interface Diagnostic {
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  details: string[];
}

interface KeywordGap {
  required: string[];
  found: string[];
  missing: string[];
}

interface DiagnosticsData {
  totalIssues: number;
  keywordMatch: number;
  keywordGap?: KeywordGap;
  problems: Diagnostic[];
}

interface PreviewExample {
  original: string;
  improved: string;
}

interface ResultData {
  id: string;
  diagnostics: DiagnosticsData;
  previewExamples: { examples: PreviewExample[] };
  isPaid: boolean;
}

const severityColor = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

function ResultContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/result/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError("Result not found.");
        else setData(d);
      })
      .catch(() => setError("Failed to load results."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading your results…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">{error || "Something went wrong."}</p>
      </div>
    );
  }

  const { diagnostics, previewExamples } = data;
  const gap = diagnostics.keywordGap;
  const totalKeywords = gap ? gap.required.length : 0;
  const matchCount = gap ? gap.found.length : 0;

  // ── 动态风险等级 ─────────────────────────────────────────────
  const kw = diagnostics.keywordMatch;
  const riskLevel: "high" | "medium" | "low" =
    kw < 50 ? "high" : kw < 75 ? "medium" : "low";

  const RISK_CONFIG = {
    high: {
      icon: "⚠️",
      label: "High Risk of ATS Rejection",
      headerBg: "bg-red-50 border-red-100",
      headerText: "text-red-900",
      cardBorder: "border-red-100",
      circleColor: "text-red-500",
      scoreColor: "text-red-600",
      message:
        "Your resume is likely being filtered out before a human ever sees it. The keyword gap is significant — but fixable.",
      missingLabel: "text-red-600",
      missingChipBg: "bg-red-50 border-red-100 text-red-700",
    },
    medium: {
      icon: "🔶",
      label: "Moderate Risk — Improvements Needed",
      headerBg: "bg-yellow-50 border-yellow-100",
      headerText: "text-yellow-900",
      cardBorder: "border-yellow-100",
      circleColor: "text-yellow-500",
      scoreColor: "text-yellow-600",
      message:
        "Your resume passes some filters, but is missing key terms that could push you past the competition. Small fixes can make a big difference.",
      missingLabel: "text-yellow-700",
      missingChipBg: "bg-yellow-50 border-yellow-200 text-yellow-800",
    },
    low: {
      icon: "✅",
      label: "Low Risk — Strong Match",
      headerBg: "bg-green-50 border-green-100",
      headerText: "text-green-900",
      cardBorder: "border-green-100",
      circleColor: "text-green-500",
      scoreColor: "text-green-600",
      message:
        "Your resume aligns well with the job description. Fine-tune a few remaining gaps to maximize your chances.",
      missingLabel: "text-green-700",
      missingChipBg: "bg-green-50 border-green-200 text-green-800",
    },
  } as const;

  const cfg = RISK_CONFIG[riskLevel];

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-2">
          <span className="text-2xl">📄</span>
          <span className="text-xl font-bold text-blue-700">ResumeFixr</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Dynamic Risk Banner */}
        <div className={`rounded-2xl bg-white border-2 ${cfg.cardBorder} shadow-lg mb-8 overflow-hidden`}>
          <div className={`${cfg.headerBg} px-6 py-4 border-b flex items-center gap-3`}>
            <span className="text-2xl">{cfg.icon}</span>
            <h1 className={`text-xl font-bold ${cfg.headerText}`}>
              {cfg.label}
            </h1>
          </div>

          <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center">
            {/* Score Circle */}
            <div className="relative flex-shrink-0">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-100" />
                <circle
                  cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent"
                  strokeDasharray={351.8}
                  strokeDashoffset={351.8 - (351.8 * kw) / 100}
                  className={cfg.circleColor}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-extrabold ${cfg.scoreColor}`}>
                  {kw}%
                </span>
                <span className="text-xs text-gray-400 mt-0.5">match</span>
              </div>
            </div>

            {/* Core Message */}
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                Your resume matches {matchCount} of {totalKeywords} required skills
              </h2>
              <p className="text-gray-600 mb-4">{cfg.message}</p>

              {gap && gap.missing.length > 0 && (
                <div>
                  <div className={`text-xs font-bold uppercase tracking-wide mb-2 ${cfg.missingLabel}`}>
                    Missing Keywords:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {gap.missing.slice(0, 5).map((kw, i) => (
                      <span key={i} className={`rounded-md border px-2 py-1 text-xs font-semibold ${cfg.missingChipBg}`}>
                        {kw}
                      </span>
                    ))}
                    {gap.missing.length > 5 && (
                      <span className="rounded-md bg-gray-50 border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500">
                        +{gap.missing.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top 3 Critical Issues */}
        <h3 className="text-xl font-bold text-gray-900 mb-4">Why you're getting rejected</h3>
        <div className="space-y-4 mb-8">
          {diagnostics.problems.map((p, i) => (
            <div key={i} className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm flex gap-4">
              <div className="shrink-0 mt-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  p.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {i + 1}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-lg mb-1">{p.title}</h4>
                <p className="text-gray-600 mb-3">{p.description}</p>
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-100 text-sm">
                  <span className="font-semibold text-gray-700">Example from your resume: </span>
                  <span className="text-gray-600">{p.details[0]}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Free preview */}
        <h3 className="text-xl font-bold text-gray-900 mb-4">How we fix it (Free Preview)</h3>
        <p className="text-gray-600 mb-4">Here's how we rewrite your experience to bypass the ATS and impress human recruiters.</p>
        
        <div className="space-y-5 mb-10">
          {previewExamples.examples.map((ex, i) => (
            <div key={i} className="rounded-xl bg-white border border-gray-200 p-0 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50 flex gap-4">
                <div className="shrink-0">
                  <span className="inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 uppercase">
                    Problem
                  </span>
                </div>
                <p className="text-gray-600">{ex.original}</p>
              </div>
              <div className="p-5 flex gap-4 bg-white relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>
                <div className="shrink-0">
                  <span className="inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700 uppercase">
                    Fixed
                  </span>
                </div>
                <p className="text-gray-900 font-medium">{ex.improved}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Paywall */}
        <PaywallSection
          submissionId={data.id}
          riskLevel={riskLevel === "high" ? "high" : riskLevel === "medium" ? "moderate" : "low"}
        />
      </div>
    </main>
  );
}

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    }>
      <ResultContent params={params} />
    </Suspense>
  );
}
