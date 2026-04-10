#!/usr/bin/env node
/**
 * P0-4 多样化免费诊断覆盖性测试
 * 测试 generateDiagnostics() 输出是否具体、可验证、引用原文
 * 只测试，不改代码
 */

import { execSync } from "child_process";

const API_KEY = "sk-TQvGvxzcLqw6nwurBjFfycgGO5LMPschOfhplMj03DmSjxf4";
const BASE_URL = "https://breakout.wenwen-ai.com/v1/chat/completions";
const MODEL = "claude-sonnet-4-6";

// 完全复制 route.ts 的 extractJSON
function extractJSON(raw) {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = raw.match(/(\{[\s\S]*\})/);
  if (objMatch) return objMatch[1].trim();
  return raw.trim();
}

// 完全复制 route.ts 的 generateDiagnostics prompt
function callDiagnosticsAPI(resume, jd) {
  const messages = [
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
  ];

  const payload = JSON.stringify({ model: MODEL, temperature: 0.3, messages });
  const escaped = payload.replace(/'/g, "'\\''");
  const cmd = `curl -s -X POST "${BASE_URL}" -H "Authorization: Bearer ${API_KEY}" -H "Content-Type: application/json" -d '${escaped}'`;
  const output = execSync(cmd, { timeout: 60000 }).toString();
  const res = JSON.parse(output);
  const content = res.choices[0].message.content;
  return JSON.parse(extractJSON(content));
}

// ─────────────────────────────────────────────
// 验收标准检查函数
// ─────────────────────────────────────────────

function checkProblem(problem, resume, groupName) {
  const issues = [];
  const details = problem.details || [];
  const description = problem.description || "";
  const title = problem.title || "";
  const allText = description + " " + details.join(" ");

  // 检查 1：是否引用了原文（带引号，原文片段出现在 description 或 details）
  const quotedText = allText.match(/"([^"]+)"/g) || [];
  const resumeLines = resume.split("\n").map(l => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);

  let hasValidQuote = false;
  for (const q of quotedText) {
    const qContent = q.replace(/"/g, "").toLowerCase();
    // 检查引用内容是否来自简历原文（模糊匹配：至少有2个词重叠）
    for (const line of resumeLines) {
      const words = qContent.split(/\s+/).filter(w => w.length > 2);
      const lineWords = line.toLowerCase().split(/\s+/);
      const overlap = words.filter(w => lineWords.some(lw => lw.includes(w) || w.includes(lw)));
      if (overlap.length >= 2 || line.toLowerCase().includes(qContent)) {
        hasValidQuote = true;
        break;
      }
    }
    if (hasValidQuote) break;
  }

  // 检查 2：是否有 details（具体示例列表不为空）
  const hasDetails = details.length > 0 && details.some(d => d.trim().length > 5);

  // 检查 3：description 是否不空泛（长度 > 30 字符）
  const hasSubstantiveDescription = description.trim().length > 30;

  // 检查 4：details 是否空泛（全是通用废话）
  const genericPhrases = ["improve", "add metrics", "use numbers", "quantify", "action verbs", "stronger verbs"];
  const allDetailText = details.join(" ").toLowerCase();
  const isGeneric = details.every(d => {
    const lower = d.toLowerCase();
    return genericPhrases.some(g => lower.includes(g)) && d.length < 60 && !/"/.test(d);
  });

  if (!hasValidQuote) issues.push("❌ 无原文引用（details/description 中未发现引自简历的带引号文本）");
  if (!hasDetails) issues.push("❌ details 为空或过短");
  if (!hasSubstantiveDescription) issues.push("❌ description 内容不具体（<30字符）");
  if (isGeneric && details.length > 0) issues.push("⚠️  details 疑似空泛（未引用原文，仅通用建议）");

  return { pass: issues.length === 0, issues, hasQuote: hasValidQuote, quotedText, details };
}

// ─────────────────────────────────────────────
// 测试组定义
// ─────────────────────────────────────────────

const GROUPS = [
  {
    name: "A",
    label: "A — 短 Bullet，无数字",
    resume: `- Built web applications
- Managed team communication
- Improved system performance
- Developed internal tools
- Led product collaboration`,
    jd: "cross-functional collaboration, internal tools, product development, communication",
  },
  {
    name: "B",
    label: "B — 短 Bullet，有数字",
    resume: `- Managed 3 engineers
- Reduced load time by 20%
- Served 500 customers monthly
- Built 12 dashboards
- Processed 200 invoices per week`,
    jd: "team leadership, performance metrics, customer handling, dashboard reporting, operations",
  },
  {
    name: "C",
    label: "C — 边界模糊 Bullet",
    resume: `- Improved efficiency
- Supported operations
- Built features for customers
- Contributed to reporting
- Worked with stakeholders`,
    jd: "operational efficiency, stakeholder collaboration, reporting, project delivery",
  },
  {
    name: "D",
    label: "D — 长句复杂 Bullet",
    resume: `- Led cross-functional teams to implement product features from ideation to release, ensuring alignment with business objectives
- Designed internal tools that reduced manual workflow steps by 30% and improved developer efficiency
- Analyzed customer usage data to identify trends and inform product roadmap decisions
- Collaborated with marketing, design, and engineering to deliver quarterly product updates
- Created reporting dashboards consolidating KPIs across multiple departments`,
    jd: "cross-functional collaboration, workflow optimization, data analysis, reporting, roadmap planning",
  },
  {
    name: "E",
    label: "E — 中英文混合/软技能 Bullet",
    resume: `- 协调跨部门团队完成项目交付
- Led user research and translated findings into actionable insights
- 提高团队沟通效率，减少会议冗余
- Supported internal training sessions to onboard new employees
- 参与制定产品策略，确保市场需求落地`,
    jd: "cross-department coordination, user research, team communication, training, product strategy",
  },
];

// ─────────────────────────────────────────────
// 主逻辑
// ─────────────────────────────────────────────

function log(s) { process.stdout.write(s + "\n"); }
function sep(c = "─", n = 62) { log(c.repeat(n)); }

log("╔══════════════════════════════════════════════════════════════╗");
log("║     P0-4 多样化免费诊断覆盖性测试                           ║");
log("║     验证 generateDiagnostics 输出：具体性 + 原文引用         ║");
log("╚══════════════════════════════════════════════════════════════╝");

const allResults = [];

for (const group of GROUPS) {
  log("\n" + "═".repeat(62));
  log(`📋 测试组 ${group.label}`);
  sep("═");
  log(`\n简历:\n${group.resume}`);
  log(`\nJD: ${group.jd}\n`);

  let diagnostics;
  try {
    diagnostics = callDiagnosticsAPI(group.resume, group.jd);
  } catch (e) {
    log(`❌ API 调用失败: ${e.message}`);
    allResults.push({ group: group.name, label: group.label, pass: false, error: e.message, problems: [] });
    continue;
  }

  log(`✅ API 返回成功`);
  log(`   totalIssues: ${diagnostics.totalIssues} | keywordMatch: ${diagnostics.keywordMatch}%`);
  log(`   keywordGap.missing: [${(diagnostics.keywordGap?.missing || []).join(", ")}]`);
  log(`   problems 数量: ${diagnostics.problems?.length}`);

  const problemResults = [];
  let groupPass = true;

  for (let i = 0; i < (diagnostics.problems || []).length; i++) {
    const p = diagnostics.problems[i];
    log(`\n  ── 问题 ${i + 1}: [${p.severity?.toUpperCase()}] ${p.title}`);
    log(`     description: ${p.description}`);
    if (p.details?.length) {
      log(`     details:`);
      for (const d of p.details) log(`       • ${d}`);
    }

    const check = checkProblem(p, group.resume, group.name);
    log(`\n     验收检查:`);
    log(`       原文引用: ${check.hasQuote ? "✅ 有" : "❌ 无"}`);
    if (check.quotedText.length > 0) log(`       引用内容: ${check.quotedText.join(", ")}`);
    log(`       具体性: ${check.pass ? "✅" : "⚠️"}`);
    if (check.issues.length > 0) {
      for (const issue of check.issues) log(`       ${issue}`);
    }
    log(`       单条结论: ${check.pass ? "✅ PASS" : "❌ FAIL"}`);

    if (!check.pass) groupPass = false;
    problemResults.push({ index: i + 1, problem: p, check });
  }

  // 额外检查：是否恰好 3 条问题
  const exactlyThree = (diagnostics.problems || []).length === 3;
  if (!exactlyThree) {
    log(`\n  ⚠️  期望 3 条问题，实际返回 ${diagnostics.problems?.length} 条`);
    groupPass = false;
  }

  log(`\n  组结论: ${groupPass ? "✅ PASS" : "❌ FAIL"}`);
  allResults.push({ group: group.name, label: group.label, pass: groupPass, diagnostics, problemResults });
}

// ─────────────────────────────────────────────
// 汇总报告
// ─────────────────────────────────────────────

log("\n\n" + "═".repeat(62));
log("📊 Test Summary");
sep("═");

let globalPass = true;
const failureCases = [];

for (const r of allResults) {
  if (!r.pass) globalPass = false;
  const status = r.pass ? "✅ PASS" : "❌ FAIL";
  const problems = r.problemResults || [];
  const quoteCount = problems.filter(p => p.check?.hasQuote).length;
  log(`\n▶ 组 ${r.label}`);
  if (r.error) {
    log(`   ❌ 错误: ${r.error}`);
  } else {
    log(`   问题数: ${problems.length}/3 | 有原文引用: ${quoteCount}/${problems.length}`);
    log(`   组结论: ${status}`);
    for (const p of problems) {
      if (!p.check?.pass) {
        failureCases.push({ group: r.label, problem: p });
      }
    }
  }
}

// Failure Cases
if (failureCases.length > 0) {
  log("\n\n" + "═".repeat(62));
  log("❌ Failure Cases（逐条）");
  sep("═");
  for (const f of failureCases) {
    log(`\n  组: ${f.group}`);
    log(`  问题: [${f.problem.problem.severity}] ${f.problem.problem.title}`);
    log(`  description: ${f.problem.problem.description}`);
    log(`  details: ${f.problem.problem.details?.join(" | ")}`);
    for (const issue of f.problem.check.issues) {
      log(`  失败原因: ${issue}`);
    }
  }
}

// Final Verdict
log("\n\n" + "═".repeat(62));
log("🏁 Final Verdict");
sep("═");

const passCount = allResults.filter(r => r.pass).length;
log(`测试组总数: ${allResults.length} | 通过: ${passCount} | 失败: ${allResults.length - passCount}`);

if (globalPass) {
  log("\n✅  PASS — P0-4 多样化测试完成，待人工评审");
  log("    所有 5 组测试均输出了具体、带原文引用的 Top 3 诊断");
} else {
  log("\n❌  FAIL — P0-4 多样化测试完成，待人工评审");
  log("    部分测试组诊断输出不满足验收标准（见 Failure Cases）");
}
sep("═");
