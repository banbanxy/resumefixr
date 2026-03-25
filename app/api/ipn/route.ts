import { getAI, MODEL } from "@/lib/wenwen";
import { sendResultEmail } from "@/lib/resend";
import { getDB } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.text();

  // Step 1: 验证 IPN
  const verifyRes = await fetch("https://ipnpb.paypal.com/cgi-bin/webscr", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "cmd=_notify-validate&" + body,
  });
  const verifyText = await verifyRes.text();
  if (verifyText !== "VERIFIED") {
    console.error("IPN not verified:", verifyText);
    return new Response("INVALID", { status: 200 });
  }

  const params = new URLSearchParams(body);
  const paymentStatus = params.get("payment_status");
  const txnId = params.get("txn_id");
  const email = params.get("payer_email");
  const amount = parseFloat(params.get("mc_gross") || "0");
  const submissionId = params.get("custom");

  if (paymentStatus !== "Completed" || !submissionId) {
    return new Response("OK", { status: 200 });
  }

  try {
    const db = getDB();

    // 防止重复处理
    const existing = db.prepare("SELECT id FROM submissions WHERE paypal_txn_id = ?").get(txnId);
    if (existing) return new Response("OK", { status: 200 });

    const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(submissionId) as any;
    if (!row) return new Response("OK", { status: 200 });

    const fullSuggestions = await generateFullSuggestions(row.resume_text, row.job_description);

    db.prepare(
      `UPDATE submissions SET is_paid=1, paypal_txn_id=?, amount_paid=?, full_suggestions=?, email=?, paid_at=datetime('now') WHERE id=?`
    ).run(txnId, amount, JSON.stringify(fullSuggestions), email, submissionId);

    if (email) await sendResultEmail(email, submissionId);
  } catch (error) {
    console.error("IPN processing error:", error);
  }

  return new Response("OK", { status: 200 });
}

async function generateFullSuggestions(resume: string, jd: string) {
  const res = await getAI().chat.completions.create({
    model: MODEL(),
    temperature: 0.5,
    max_tokens: 4000,
    messages: [
      {
        role: "system",
        content: "You are a resume rewriting API. Respond with raw JSON only. No markdown, no explanation.",
      },
      {
        role: "user",
        content: `Generate specific rewrite suggestions for this resume against the job description. Return ONLY raw JSON.

Resume:
${resume}

Job Description:
${jd}

Required JSON format:
{"summary":{"totalSuggestions":NUMBER,"estimatedImpact":"string"},"categories":[{"name":"string","count":NUMBER,"items":[{"original":"string","rewrite":"string","keyword_source":"Found in JD"|"Not in resume","why_it_works":{"jd_requirement":"string","keyword_added":"string","expression_fix":"string"},"impact":"high"|"medium"|"low"}]}]}

STRICT RULES:
1. Do NOT invent numbers or metrics.
2. Do NOT use placeholders like [X], [Number], or [Metric]. If the original lacks numbers, structure the sentence so it does not need them.
3. keyword_source: "Found in JD" if the keyword came from JD, "Not in resume" if it was absent from the resume.
4. why_it_works must reference actual text from the resume or JD — no generic statements.
5. totalSuggestions must equal the actual total number of items across all categories.
6. Group into: Keyword Optimization, Quantified Achievements, Action Verbs, Structure & Clarity.`,
      },
    ],
  });

  function extractJSON(raw: string): string {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) return fence[1].trim();
    const obj = raw.match(/(\{[\s\S]*\})/);
    if (obj) return obj[1].trim();
    return raw.trim();
  }

  return JSON.parse(extractJSON(res.choices[0].message.content!));
}
