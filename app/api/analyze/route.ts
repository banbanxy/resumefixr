import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAI, MODEL } from "@/lib/wenwen";
import { getDB } from "@/lib/db";

// ── 错误类型枚举（结构化分类，便于前端展示友好提示）────────────
type AnalyzeErrorCode =
  | "missing_fields"
  | "ai_timeout"
  | "ai_rate_limit"
  | "parse_error"
  | "analysis_failed";

function classifyError(err: unknown): AnalyzeErrorCode {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes("abort") || msg.includes("timeout") || msg.includes("timed out")) return "ai_timeout";
  if (msg.includes("429") || msg.includes("rate limit")) return "ai_rate_limit";
  if (msg.includes("json") || msg.includes("parse") || msg.includes("unexpected token")) return "parse_error";
  return "analysis_failed";
}

// ── 带超时的 AI 调用包装 ──────────────────────────────────────
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
}

// ── 带重试的调用（最多 2 次重试，指数退避）────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 2000
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
      }
    }
  }
  throw lastErr;
}

export async function POST(req: Request) {
  try {
    const { resume, jobDescription } = await req.json();

    if (!resume?.trim() || !jobDescription?.trim()) {
      return NextResponse.json(
        { error: "Missing fields", code: "missing_fields" },
        { status: 400 }
      );
    }

    const [diagnostics, previewExamples] = await Promise.all([
      withRetry(() => generateDiagnostics(resume, jobDescription)),
      withRetry(() => generatePreview(resume, jobDescription)),
    ]);

    const id = nanoid();
    const db = getDB(req);
    await db
      .prepare(
        `INSERT INTO submissions (id, resume_text, job_description, diagnostics, preview_examples)
       VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        resume,
        jobDescription,
        JSON.stringify(diagnostics),
        JSON.stringify(previewExamples)
      )
      .run();

    return NextResponse.json({ id, diagnostics, previewExamples });
  } catch (error) {
    console.error("Analyze error:", error);
    const code = classifyError(error);
    return NextResponse.json({ error: "Analysis failed", code }, { status: 500 });
  }
}

function extractJSON(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = raw.match(/(\{[\s\S]*\})/);
  if (objMatch) return objMatch[1].trim();
  return raw.trim();
}

async function generateDiagnostics(resume: string, jd: string) {
  const res = await withTimeout(
    getAI().chat.completions.create({
      model: MODEL(),
      temperature: 0.3,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "You are an ATS resume analysis API. Respond with raw JSON only. No markdown, no explanation.",
        },
        {
          role: "user",
          content: `Analyze this resume against the job description. Return ONLY raw JSON.

Resume:
${resume}

Job Description:
${jd}

Required JSON format:
{
  "totalIssues": NUMBER,
  "keywordMatch": NUMBER,
  "keywordGap": {
    "required": ["keyword1", "keyword2"],
    "found": ["keyword3"],
    "missing": ["keyword1", "keyword2"]
  },
  "problems": [
    {"title":"string","description":"string","severity":"high"|"medium"|"low","details":["string"]}
  ]
}

Rules:
- totalIssues: count ALL issues (missing keywords, weak verbs, no metrics, formatting)
- keywordMatch: 0-100 percentage of JD keywords found in resume
- keywordGap.required: all important skills/tools/keywords from the JD
- keywordGap.found: which of those appear in the resume
- keywordGap.missing: which are absent from the resume
- problems: exactly 3 most critical issues with real examples`,
        },
      ],
    }),
    20000 // 20s 超时
  );
  return JSON.parse(extractJSON(res.choices[0].message.content!));
}

async function generatePreview(resume: string, jd: string) {
  const res = await withTimeout(
    getAI().chat.completions.create({
      model: MODEL(),
      temperature: 0.7,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content:
            "You are a resume rewriting API. Respond with raw JSON only. No markdown, no explanation.",
        },
        {
          role: "user",
          content: `Pick the 2 weakest bullet points from this resume and rewrite them. Return ONLY raw JSON.

Resume:
${resume}

Job Description:
${jd}

Required JSON format:
{"examples":[{"original":"string","improved":"string"},{"original":"string","improved":"string"}]}

STRICT RULES:
1. Do NOT invent numbers or metrics.
2. Do NOT use placeholders like [X], [Number], or [Metric]. If the original lacks numbers, write the sentence so it does not need them.
3. Only use strong action verbs and JD keywords.

4. CRITICAL NO-FABRICATION RULE:
   - If original contains NO numbers → rewrite MUST NOT add numbers
   - Only preserve/refine numbers that already exist in original

Examples:
❌ WRONG: "Built applications" → "Built 5 applications serving 10K users"
✅ RIGHT: "Built applications" → "Architected scalable applications using React and AWS"

❌ WRONG: "Managed team" → "Managed team of 8 engineers"
✅ RIGHT: "Managed team" → "Led cross-functional engineering team"`,
        },
      ],
    }),
    20000 // 20s 超时
  );
  const parsed = JSON.parse(extractJSON(res.choices[0].message.content!));

  // 最小 no_fabrication 验证：过滤违规示例
  const validExamples = parsed.examples.filter((ex: any) => {
    const originalHasNumber = /\d/.test(ex.original);
    const improvedHasNumber = /\d/.test(ex.improved);

    if (!originalHasNumber && improvedHasNumber) {
      console.warn("[no_fabrication] Filtered preview example:", ex.original);
      return false;
    }
    return true;
  });

  return { examples: validExamples };
}
