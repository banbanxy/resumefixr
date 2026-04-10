"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");

  const [loadingStep, setLoadingStep] = useState(0);

  // 友好错误提示映射
  const ERROR_MESSAGES: Record<string, string> = {
    missing_fields: "Please fill in both fields.",
    ai_timeout: "AI service timed out — please click Analyze again 🔄",
    ai_rate_limit: "AI service is busy right now, please wait a moment and retry 🔄",
    parse_error: "AI returned an unexpected response. Please try again.",
    analysis_failed: "Network hiccup caused the request to fail — please click Analyze again 🔄",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resume.trim() || !jobDescription.trim()) {
      setError("Please fill in both fields.");
      return;
    }

    setLoading(true);
    setLoadingStep(1);
    setError("");

    // 模拟进度步骤
    const stepTimer = setTimeout(() => setLoadingStep(2), 5000);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jobDescription }),
      });

      clearTimeout(stepTimer);

      const data = await res.json();

      if (!res.ok) {
        const code = data?.code as string | undefined;
        setError(ERROR_MESSAGES[code ?? "analysis_failed"] ?? ERROR_MESSAGES["analysis_failed"]);
        setLoading(false);
        setLoadingStep(0);
        return;
      }

      router.push(`/result/${data.id}`);
    } catch {
      clearTimeout(stepTimer);
      setError(ERROR_MESSAGES["analysis_failed"]);
      setLoading(false);
      setLoadingStep(0);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <header className="border-b border-blue-100 bg-white/80 backdrop-blur">
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
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8"
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
                className="w-full rounded-xl border border-gray-200 p-4 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400
                           resize-none placeholder:text-gray-400"
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
                className="w-full rounded-xl border border-gray-200 p-4 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400
                           resize-none placeholder:text-gray-400"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={handleSubmit as any}
                className="mt-2 text-sm text-blue-600 underline hover:text-blue-800"
              >
                🔄 Try Again
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600
                         px-10 py-4 text-lg font-bold text-white
                         hover:bg-blue-700 active:bg-blue-800
                         disabled:opacity-60 transition-colors shadow-md"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {loadingStep === 1 ? "Analyzing keywords… (1/2)" : "Generating suggestions… (2/2)"}
                </>
              ) : (
                "Analyze My Resume →"
              )}
            </button>
            <p className="mt-3 text-xs text-gray-400">
              Free analysis · No account required · Results in ~10 seconds
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
