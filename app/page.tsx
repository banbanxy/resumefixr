"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ── 错误分级提示映射 ─────────────────────────────────────────
const ERROR_MESSAGES: Record<string, { title: string; hint: string }> = {
  missing_fields: {
    title: "Please fill in both fields.",
    hint: "Both your resume and job description are required.",
  },
  ai_timeout: {
    title: "Analysis timed out ⏱",
    hint: "The AI took too long to respond. Please click Retry.",
  },
  ai_rate_limit: {
    title: "AI service is busy 🔄",
    hint: "Too many requests right now. Please wait a moment and retry.",
  },
  parse_error: {
    title: "Unexpected AI response",
    hint: "The AI returned an unreadable result. Please try again.",
  },
  analysis_failed: {
    title: "Network hiccup 🌐",
    hint: "The request failed due to a network issue. Please click Retry.",
  },
};

export default function HomePage() {
  const router = useRouter();
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; hint: string } | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!resume.trim() || !jobDescription.trim()) {
      setError(ERROR_MESSAGES["missing_fields"]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jobDescription }),
      });

      const data = await res.json();

      if (!res.ok) {
        const code = (data?.code as string) ?? "analysis_failed";
        setError(ERROR_MESSAGES[code] ?? ERROR_MESSAGES["analysis_failed"]);
        setLoading(false);
        return;
      }

      router.push(`/result/${data.id}`);
    } catch {
      setError(ERROR_MESSAGES["analysis_failed"]);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <header className="border-b border-blue-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📄</span>
            <span className="text-xl font-bold text-blue-700">ResumeFixr</span>
          </div>
          <span className="text-sm text-gray-500">ATS Resume Optimizer</span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-block mb-3 rounded-full bg-red-100 px-4 py-1 text-sm font-semibold text-red-600">
            ⚠️ 75% of resumes never reach a human recruiter
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-3">
            Is Your Resume Getting Rejected by ATS?
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Paste your resume below — get an instant ATS score, see exactly
            what's failing, and unlock AI-powered fixes tailored to your target job.
          </p>
          <div className="mt-4 flex justify-center gap-6 text-sm text-gray-500">
            <span>✓ Free diagnosis</span>
            <span>✓ 2 free rewrites</span>
            <span>✓ Full report $4.99</span>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8"
        >
          <div className="grid gap-6 md:grid-cols-2">
            {/* Resume */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Your Resume
              </label>
              <textarea
                value={resume}
                onChange={(e) => setResume(e.target.value)}
                placeholder="Paste your resume text here..."
                rows={16}
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 p-4 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400
                           resize-none placeholder:text-gray-400
                           disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            {/* Job Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here..."
                rows={16}
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 p-4 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400
                           resize-none placeholder:text-gray-400
                           disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>

          {/* ── Loading 面板（简洁 spinner）──────────────────────── */}
          {loading && (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 py-6 px-4">
              <svg
                className="animate-spin h-8 w-8 text-blue-500"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-sm font-medium text-blue-700 text-center">
                AI is analyzing your resume…
              </p>
              <p className="text-xs text-gray-400">Results in ~15 seconds</p>
            </div>
          )}

          {/* ── 错误分级提示面板 ────────────────────────────────── */}
          {error && !loading && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <span className="text-red-500 text-lg mt-0.5">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700">{error.title}</p>
                  <p className="text-xs text-red-500 mt-0.5">{error.hint}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="mt-3 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold
                           text-white hover:bg-red-700 active:bg-red-800 transition-colors"
              >
                🔄 Retry Analysis
              </button>
            </div>
          )}

          {/* ── 提交按钮 ─────────────────────────────────────────── */}
          <div className="mt-6 text-center">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600
                         px-10 py-4 text-lg font-bold text-white
                         hover:bg-blue-700 active:bg-blue-800
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors shadow-md"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing…
                </>
              ) : (
                "Analyze My Resume →"
              )}
            </button>
            <p className="mt-3 text-xs text-gray-400">
              Free analysis · No account required · Results in ~15 seconds
            </p>
          </div>
        </form>

        {/* Social proof */}
        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500">
            Powered by Claude AI · Trusted by job seekers worldwide
          </p>
        </div>
      </div>
    </main>
  );
}
