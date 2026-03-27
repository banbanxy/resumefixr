"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface WhyItWorks {
  jd_requirement: string;
  keyword_added: string;
  expression_fix: string;
}

interface RewriteItem {
  original: string;
  rewrite: string;
  keyword_source: string;
  why_it_works: WhyItWorks;
  impact: string;
}

interface Category {
  name: string;
  count: number;
  items: RewriteItem[];
}

interface FullSuggestions {
  summary: { totalSuggestions: number; estimatedImpact: string };
  categories: Category[];
}

interface SuccessData {
  id: string;
  isPaid: boolean;
  fullSuggestions: FullSuggestions;
  _testMode?: boolean;
}

function SuggestionCard({ item }: { item: any }) {
  // Support both old format (rewrites.professional) and new format (rewrite)
  const rewrite = item.rewrite ?? item.rewrites?.professional ?? "";
  const why: WhyItWorks | null = item.why_it_works ?? null;
  const source: string = item.keyword_source ?? "";

  return (
    <div className="rounded-xl bg-white border border-gray-200 p-5 shadow-sm">
      {/* Before */}
      <div className="mb-4">
        <span className="text-xs font-semibold text-red-500 uppercase tracking-wide">Before</span>
        <p className="mt-1 text-sm text-gray-500 line-through">{item.original}</p>
      </div>

      {/* After */}
      <div className="mb-3">
        <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">After</span>
        <p className="mt-1 text-sm text-gray-900 font-medium leading-relaxed">{rewrite}</p>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
        {source && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${
            source === "Found in JD"
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-orange-50 text-orange-700 border-orange-200"
          }`}>
            {source === "Found in JD" ? "📋 From JD" : "⚠️ Missing keyword added"}
          </span>
        )}
        {item.impact === "high" && (
          <span className="rounded-full bg-red-100 text-red-600 text-xs px-2.5 py-0.5 border border-red-200">
            High Impact
          </span>
        )}
      </div>

      {/* Why it works — always visible now */}
      {why && (
        <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 p-4 space-y-2 text-xs text-gray-700">
          {why.jd_requirement && (
            <div>
              <span className="font-semibold text-blue-700">Matches JD requirement: </span>
              "{why.jd_requirement}"
            </div>
          )}
          {why.keyword_added && (
            <div>
              <span className="font-semibold text-blue-700">Keyword added: </span>
              {why.keyword_added}
            </div>
          )}
          {why.expression_fix && (
            <div>
              <span className="font-semibold text-blue-700">Fix applied: </span>
              {why.expression_fix}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SuccessPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const isTestMode =
    process.env.NEXT_PUBLIC_ENABLE_TEST_UNLOCK === "true" &&
    searchParams.get("test") === "1";

  const [data, setData] = useState<SuccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/result/${params.id}`);
      const d = await res.json();
      
      // 测试模式放行
      if (isTestMode) {
        if (d.fullSuggestions) {
          setData({ ...d, _testMode: true });
        } else {
          setError(
            "⚠️ 测试模式：当前记录没有完整报告数据（fullSuggestions 不存在）。请使用已完成支付并生成完整报告的记录 ID 进行测试。"
          );
        }
        setLoading(false);
        return;
      }
      
      // 生产模式：原有逻辑
      if (d.isPaid && d.fullSuggestions) {
        setData(d);
        setLoading(false);
      } else if (!d.isPaid) {
        setPolling(true);
        setLoading(false);
      } else {
        setError("Result not found.");
        setLoading(false);
      }
    };
    load().catch(() => { setError("Failed to load."); setLoading(false); });
  }, [params.id, isTestMode]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/result/${params.id}`);
      const d = await res.json();
      if (d.isPaid && d.fullSuggestions) { setData(d); setPolling(false); }
    }, 3000);
    return () => clearInterval(interval);
  }, [polling, params.id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  );

  if (polling) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm px-4">
        <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Generating your report…</h2>
        <p className="text-gray-500 text-sm">Our AI is crafting personalized suggestions. This takes about 15–20 seconds.</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-red-600">{error || "Something went wrong."}</p>
    </div>
  );

  const { fullSuggestions } = data;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📄</span>
            <span className="text-xl font-bold text-blue-700">ResumeFixr</span>
          </div>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Analyze another resume →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* 测试模式提示 Banner */}
        {data._testMode && (
          <div className="rounded-lg border-2 border-yellow-400 bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-900 mb-6">
            ⚠️ 测试模式 — 当前会话未经支付验证，仅用于开发测试
          </div>
        )}

        {/* Banner */}
        <div className="rounded-2xl bg-blue-600 text-white p-8 mb-6 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-2xl font-extrabold mb-2">Your Full Report is Ready!</h1>
          <p className="text-blue-100 text-sm">
            {fullSuggestions.summary.totalSuggestions} suggestions · {fullSuggestions.summary.estimatedImpact}
          </p>
        </div>

        {/* Grounded note */}
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-800 mb-6">
          📋 Every suggestion is grounded in your actual JD requirements. Click "Why this works" on any card to see the exact match.
        </div>

        {/* Categories */}
        {fullSuggestions.categories.map((cat, ci) => (
          <div key={ci} className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              {cat.name}
              <span className="rounded-full bg-blue-100 text-blue-700 text-xs px-2 py-0.5 font-medium">
                {cat.count} suggestions
              </span>
            </h2>
            <div className="space-y-4">
              {cat.items.map((item, ii) => (
                <SuggestionCard key={ii} item={item} />
              ))}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="mt-10 rounded-2xl bg-white border border-gray-200 p-8 text-center">
          <p className="text-gray-600 mb-4">Want to optimize another resume?</p>
          <Link href="/" className="inline-block rounded-xl bg-blue-600 px-8 py-3 text-white font-bold hover:bg-blue-700 transition-colors">
            Analyze Another Resume →
          </Link>
        </div>
      </div>
    </main>
  );
}
