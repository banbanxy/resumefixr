import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAI, MODEL } from "@/lib/wenwen";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { resume, jobDescription } = await req.json();

    if (!resume?.trim() || !jobDescription?.trim()) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const [diagnostics, previewExamples] = await Promise.all([
      generateDiagnostics(resume, jobDescription),
      generatePreview(resume, jobDescription),
    ]);

    const id = nanoid();
    const db = getDB(req);
    await db.prepare(
      `INSERT INTO submissions (id, resume_text, job_description, diagnostics, preview_examples)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, resume, jobDescription,
      JSON.stringify(diagnostics),
      JSON.stringify(previewExamples)).run();

    return NextResponse.json({ id, diagnostics, previewExamples });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
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
  const res = await getAI().chat.completions.create({
    model: MODEL(),
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: "You are an ATS resume analysis API. Respond with raw JSON only. No markdown, no explanation.",
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
  });
  return JSON.parse(extractJSON(res.choices[0].message.content!));
}

async function generatePreview(resume: string, jd: string) {
  const res = await getAI().chat.completions.create({
    model: MODEL(),
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: "You are a resume rewriting API. Respond with raw JSON only. No markdown, no explanation.",
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
3. Only use strong action verbs and JD keywords.`,
      },
    ],
  });
  return JSON.parse(extractJSON(res.choices[0].message.content!));
}
