"use client";

import { use, useEffect, useState } from "react";
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

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-2">
          <span className="text-2xl">📄</span>
          <span className="text-xl font-bold text-blue-700">ResumeFixr</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* The "3 seconds to shock" Header Banner */}
        <div className="rounded-2xl bg-white border-2 border-red-100 shadow-lg mb-8 overflow-hidden">
          <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <h1 className="text-xl font-bold text-red-900">
              High risk of ATS rejection
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
                  strokeDashoffset={351.8 - (351.8 * diagnostics.keywordMatch) / 100}
                  className={diagnostics.keywordMatch < 50 ? "text-red-500" : "text-yellow-500"}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-extrabold ${diagnostics.keywordMatch < 50 ? "text-red-600" : "text-yellow-600"}`}>
                  {diagnostics.keywordMatch}%
                </span>
              </div>
            </div>

            {/* Core Message */}
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                Your resume matches only {matchCount} of {totalKeywords} required skills
              </h2>
              <p className="text-gray-600 mb-4">
                Recruiters use ATS software to filter out resumes that lack specific keywords from the job description. Yours is missing critical terms.
              </p>
              
              {gap && gap.missing.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">
                    Missing Critical Keywords:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {gap.missing.slice(0, 5).map((kw, i) => (
                      <span key={i} className="rounded-md bg-red-50 border border-red-100 px-2 py-1 text-xs font-semibold text-red-700">
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
          riskLevel={diagnostics.keywordMatch < 50 ? "high" : diagnostics.keywordMatch < 70 ? "moderate" : "low"}
        />
      </div>
    </main>
  );
}
