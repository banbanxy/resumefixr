#!/usr/bin/env node
/**
 * P0-4 验收报告 — 基于原始输出重新分析（修正引号检测逻辑）
 * AI 用的是单引号 '...' 引用原文，之前脚本只检查双引号导致误判
 */

// ─── 完整原始 API 输出（从测试运行中提取）────────────────────────

const RAW_RESULTS = {
  A: {
    label: "A — 短 Bullet，无数字",
    resume: [
      "Built web applications",
      "Managed team communication",
      "Improved system performance",
      "Developed internal tools",
      "Led product collaboration",
    ],
    jd: "cross-functional collaboration, internal tools, product development, communication",
    totalIssues: 7,
    keywordMatch: 75,
    keywordGap: { missing: ["cross-functional collaboration"] },
    problems: [
      {
        title: "No Quantifiable Metrics",
        severity: "high",
        description: "Resume lacks measurable outcomes for any bullet point, making impact impossible to assess.",
        details: [
          "'Improved system performance' — by how much? 20% faster? Reduced latency by 200ms?",
          "'Built web applications' — how many users? what scale? what stack?",
          "'Led product collaboration' — across how many teams? what was the outcome?",
        ],
      },
      {
        title: "Missing Key JD Keyword: Cross-Functional Collaboration",
        severity: "high",
        description: "The job description explicitly requires cross-functional collaboration, but this term does not appear in the resume.",
        details: [
          "'Led product collaboration' is vague and does not signal cross-functional scope",
          "ATS systems will likely score this resume lower due to missing exact phrase",
          "Recommend rewriting to: 'Led cross-functional collaboration across engineering, design, and product teams'",
        ],
      },
      {
        title: "Weak Action Verbs and Vague Bullet Points",
        severity: "medium",
        description: "Several bullet points use generic verbs that fail to convey seniority, ownership, or technical depth.",
        details: [
          "'Managed team communication' — managed how? Slack workflows? Stakeholder reporting? Too vague.",
          "'Developed internal tools' — what tools? what tech stack? who used them and at what scale?",
          "Replace weak verbs like 'managed' and 'improved' with 'architected', 'drove', 'optimized', 'spearheaded'",
        ],
      },
    ],
  },
  B: {
    label: "B — 短 Bullet，有数字",
    resume: [
      "Managed 3 engineers",
      "Reduced load time by 20%",
      "Served 500 customers monthly",
      "Built 12 dashboards",
      "Processed 200 invoices per week",
    ],
    jd: "team leadership, performance metrics, customer handling, dashboard reporting, operations",
    totalIssues: 7,
    keywordMatch: 72,
    keywordGap: { missing: ["performance metrics"] },
    problems: [
      {
        title: "Weak Action Verbs",
        severity: "high",
        description: "Several bullet points use generic or passive verbs that undersell impact and fail to convey leadership or strategic ownership.",
        details: [
          "'Managed 3 engineers' — 'Managed' is overused; replace with 'Led', 'Mentored', or 'Directed'",
          "'Served 500 customers monthly' — 'Served' is passive; replace with 'Supported', 'Engaged', or 'Retained'",
          "'Processed 200 invoices per week' — 'Processed' is clerical; replace with 'Streamlined', 'Automated', or 'Oversaw'",
        ],
      },
      {
        title: "Missing Performance Metrics Keyword",
        severity: "high",
        description: "The job description explicitly requires experience with performance metrics, but the resume never uses this term or demonstrates a structured approach to tracking KPIs or OKRs.",
        details: [
          "No mention of KPIs, OKRs, SLAs, or performance tracking frameworks",
          "'Reduced load time by 20%' is a metric but is not framed as a performance metric initiative",
          "Add a bullet such as: 'Defined and tracked 5 engineering performance metrics, improving team velocity by 15%'",
        ],
      },
      {
        title: "Lack of Context and Scope for Achievements",
        severity: "medium",
        description: "Quantified bullets exist but lack business context, making it difficult for ATS or recruiters to assess true impact and relevance to the role.",
        details: [
          "'Built 12 dashboards' — no context on tools used (e.g., Tableau, Power BI), audience, or business outcome",
          "'Reduced load time by 20%' — no baseline, timeframe, or downstream impact stated",
          "'Processed 200 invoices per week' — no mention of accuracy rate, tools, or efficiency improvement achieved",
        ],
      },
    ],
  },
  C: {
    label: "C — 边界模糊 Bullet",
    resume: [
      "Improved efficiency",
      "Supported operations",
      "Built features for customers",
      "Contributed to reporting",
      "Worked with stakeholders",
    ],
    jd: "operational efficiency, stakeholder collaboration, reporting, project delivery",
    totalIssues: 11,
    keywordMatch: 50,
    keywordGap: { missing: ["stakeholder collaboration", "project delivery"] },
    problems: [
      {
        title: "Weak Action Verbs",
        severity: "high",
        description: "Resume uses generic, low-impact verbs that fail to convey leadership or ownership.",
        details: [
          "'Worked with stakeholders' should be 'Collaborated with cross-functional stakeholders to...'",
          "'Supported operations' should be 'Spearheaded operational initiatives that...'",
          "'Contributed to reporting' should be 'Developed and delivered reporting frameworks that...'",
        ],
      },
      {
        title: "No Quantifiable Metrics",
        severity: "high",
        description: "Zero measurable outcomes are present. ATS and hiring managers expect data-backed achievements.",
        details: [
          "'Improved efficiency' — by how much? (e.g., 'Improved operational efficiency by 30% over 2 quarters')",
          "'Built features for customers' — how many users impacted? revenue generated?",
          "'Contributed to reporting' — how many reports? what cadence? what audience size?",
        ],
      },
      {
        title: "Missing Critical JD Keywords",
        severity: "medium",
        description: "Key phrases from the job description are absent, reducing ATS match score significantly.",
        details: [
          "'Stakeholder collaboration' not found — replace 'Worked with stakeholders' with this exact phrase",
          "'Project delivery' not found anywhere in the resume — add a bullet demonstrating end-to-end ownership",
          "Vague phrasing like 'Built features' does not map to any JD keyword and will be ignored by ATS parsers",
        ],
      },
    ],
  },
  D: {
    label: "D — 长句复杂 Bullet",
    resume: [
      "Led cross-functional teams to implement product features from ideation to release, ensuring alignment with business objectives",
      "Designed internal tools that reduced manual workflow steps by 30% and improved developer efficiency",
      "Analyzed customer usage data to identify trends and inform product roadmap decisions",
      "Collaborated with marketing, design, and engineering to deliver quarterly product updates",
      "Created reporting dashboards consolidating KPIs across multiple departments",
    ],
    jd: "cross-functional collaboration, workflow optimization, data analysis, reporting, roadmap planning",
    totalIssues: 6,
    keywordMatch: 80,
    keywordGap: { missing: ["workflow optimization"] },
    problems: [
      {
        title: "Missing Keyword: Workflow Optimization",
        severity: "high",
        description: "The job description explicitly requires 'workflow optimization' but the resume does not use this term or a close equivalent.",
        details: [
          "Resume mentions 'reduced manual workflow steps by 30%' but does not frame it as workflow optimization.",
          "Consider rephrasing to: 'Led workflow optimization initiatives, reducing manual steps by 30% and improving developer efficiency.'",
          "ATS systems may not match 'manual workflow steps' to 'workflow optimization' without explicit language.",
        ],
      },
      {
        title: "Weak or Vague Impact Metrics",
        severity: "medium",
        description: "Most bullet points lack quantifiable outcomes beyond one instance, reducing ATS scoring and recruiter impact.",
        details: [
          "Only one bullet includes a metric: 'reduced manual workflow steps by 30%'.",
          "'Delivered quarterly product updates' does not quantify scope, users impacted, or revenue influenced.",
          "'Identified trends to inform product roadmap' lacks specificity — how many decisions, what outcomes?",
          "Add metrics such as user counts, revenue impact, time saved, or adoption rates to at least 3 more bullets.",
        ],
      },
      {
        title: "Generic Action Verbs Reduce Differentiation",
        severity: "low",
        description: "Several bullets use weak or common verbs that do not convey leadership or measurable contribution.",
        details: [
          "'Collaborated with marketing, design, and engineering' — 'collaborated' is passive; prefer 'Spearheaded' or 'Orchestrated'.",
          "'Created reporting dashboards' — 'created' is generic; prefer 'Architected' or 'Engineered'.",
          "'Analyzed customer usage data' — acceptable but could be strengthened with outcome.",
        ],
      },
    ],
  },
  E: {
    label: "E — 中英文混合/软技能 Bullet",
    resume: [
      "协调跨部门团队完成项目交付",
      "Led user research and translated findings into actionable insights",
      "提高团队沟通效率，减少会议冗余",
      "Supported internal training sessions to onboard new employees",
      "参与制定产品策略，确保市场需求落地",
    ],
    jd: "cross-department coordination, user research, team communication, training, product strategy",
    totalIssues: 7,
    keywordMatch: 85,
    keywordGap: { missing: [] },
    problems: [
      {
        title: "No Quantifiable Metrics",
        severity: "high",
        description: "Resume lacks measurable outcomes and data-driven results, making impact difficult to assess.",
        details: [
          "'提高团队沟通效率，减少会议冗余' — no percentage or time saved specified",
          "'Led user research and translated findings into actionable insights' — no mention of sample size, number of insights, or business impact",
          "'参与制定产品策略，确保市场需求落地' — no revenue, adoption rate, or OKR metrics provided",
        ],
      },
      {
        title: "Inconsistent Language / Bilingual Formatting",
        severity: "high",
        description: "Mixing Chinese and English bullet points creates parsing issues for ATS systems and reduces readability for English-language JDs.",
        details: [
          "3 of 5 bullets are written in Chinese, which may not be parsed correctly by English ATS platforms",
          "'协调跨部门团队完成项目交付' may not be matched to 'cross-department coordination' by keyword scanners",
          "Inconsistent language signals lack of localization for the target role",
        ],
      },
      {
        title: "Weak Action Verbs and Passive Framing",
        severity: "medium",
        description: "Several bullets use weak or vague verbs that understate the candidate's ownership and leadership.",
        details: [
          "'Supported internal training sessions' — 'supported' implies assistance, not ownership; prefer 'Designed' or 'Facilitated'",
          "'参与制定产品策略' — '参与' (participated) implies a minor role; should clarify level of ownership",
          "'协调跨部门团队完成项目交付' — '协调' (coordinated) is acceptable but could be strengthened with scope",
        ],
      },
    ],
  },
};

// ─────────────────────────────────────────────
// 验收检查（修正版：支持单引号 + 双引号）
// ─────────────────────────────────────────────

function extractQuotedTexts(str) {
  const results = [];
  // 单引号
  for (const m of str.matchAll(/'([^']{3,}?)'/g)) results.push(m[1]);
  // 双引号
  for (const m of str.matchAll(/"([^"]{3,}?)"/g)) results.push(m[1]);
  return results;
}

function checkCitation(problem, resumeLines) {
  const allText = [problem.description, ...(problem.details || [])].join(" ");
  const quotes = extractQuotedTexts(allText);

  let hasResumeQuote = false;
  const matchedQuotes = [];

  for (const q of quotes) {
    const qLower = q.toLowerCase().trim();
    // 直接匹配：引用内容是否出现在简历某行中
    for (const line of resumeLines) {
      const lineLower = line.toLowerCase().trim();
      if (lineLower.includes(qLower) || qLower.includes(lineLower.substring(0, 15))) {
        hasResumeQuote = true;
        matchedQuotes.push(`'${q}'`);
        break;
      }
      // 词级别匹配（2词以上重叠）
      const qWords = qLower.split(/\s+/).filter(w => w.length > 2);
      const lWords = lineLower.split(/\s+/);
      const overlap = qWords.filter(w => lWords.some(lw => lw.includes(w)));
      if (overlap.length >= 2) {
        hasResumeQuote = true;
        matchedQuotes.push(`'${q}' [词匹配:${overlap.slice(0,2).join(",")}]`);
        break;
      }
    }
    if (hasResumeQuote) break;
  }

  return { hasResumeQuote, quotes, matchedQuotes };
}

function assessProblem(problem, resumeLines) {
  const issues = [];
  const info = [];

  // 1. 原文引用
  const citeCheck = checkCitation(problem, resumeLines);
  if (!citeCheck.hasResumeQuote) issues.push("无原文引用");
  else info.push(`原文引用: ${citeCheck.matchedQuotes.join(", ")}`);

  // 2. details 是否有实质内容
  const details = problem.details || [];
  const hasDetails = details.length > 0 && details.some(d => d.trim().length > 15);
  if (!hasDetails) issues.push("details 为空或过短");

  // 3. description 是否具体（>30字符）
  if ((problem.description || "").trim().length < 30) issues.push("description 不具体");

  // 4. 是否有具体改写示例（details中含有→或should/replace/rewrite/consider）
  const hasSuggestion = details.some(d =>
    /→|should|replace|rewrite|consider|recommend|prefer|add a bullet|rephrase/i.test(d)
  );

  // 5. 检查可验证性：details是否明确指向具体bullet（包含原文片段）
  const allDetailText = details.join(" ");
  const quoteCount = (allDetailText.match(/'[^']{3,}?'/g) || []).length;
  const isVerifiable = quoteCount >= 1 || citeCheck.hasResumeQuote;

  return {
    pass: issues.length === 0 && isVerifiable,
    issues,
    info,
    hasSuggestion,
    isVerifiable,
    citeCheck,
    quoteCount,
  };
}

// ─────────────────────────────────────────────
// 主报告生成
// ─────────────────────────────────────────────

function log(s) { process.stdout.write(s + "\n"); }
function sep(c = "─", n = 64) { log(c.repeat(n)); }

log("╔════════════════════════════════════════════════════════════════╗");
log("║  P0-4 多样化免费诊断覆盖性测试 — 分析报告（修正版）          ║");
log("╚════════════════════════════════════════════════════════════════╝");

const allGroupResults = [];

for (const [key, data] of Object.entries(RAW_RESULTS)) {
  log("\n" + "═".repeat(64));
  log(`📋 组 ${data.label}`);
  log(`   JD: ${data.jd}`);
  log(`   totalIssues: ${data.totalIssues} | keywordMatch: ${data.keywordMatch}% | missing: [${data.keywordGap.missing.join(", ")}]`);

  const problemResults = [];
  let groupPass = true;

  for (let i = 0; i < data.problems.length; i++) {
    const p = data.problems[i];
    const assessment = assessProblem(p, data.resume);
    if (!assessment.pass) groupPass = false;

    const passIcon = assessment.pass ? "✅" : "❌";
    log(`\n  ── 问题 ${i + 1}: [${p.severity.toUpperCase()}] ${p.title}`);
    log(`     description: ${p.description}`);
    log(`     details (${p.details.length} 条):`);
    for (const d of p.details) log(`       • ${d}`);
    log(`\n     验收:`);
    log(`       原文引用: ${assessment.citeCheck.hasResumeQuote ? "✅ " + assessment.citeCheck.matchedQuotes.join("; ") : "❌ 无"}`);
    log(`       引号数量: ${assessment.quoteCount} 处单引号引用`);
    log(`       可验证性: ${assessment.isVerifiable ? "✅" : "❌"}`);
    log(`       含改写示例: ${assessment.hasSuggestion ? "✅" : "—"}`);
    if (assessment.issues.length > 0) log(`       问题: ${assessment.issues.join(", ")}`);
    log(`       单条结论: ${passIcon} ${assessment.pass ? "PASS" : "FAIL"}`);

    problemResults.push({ index: i + 1, problem: p, assessment });
  }

  const exactlyThree = data.problems.length === 3;
  log(`\n  问题数量: ${data.problems.length} ${exactlyThree ? "✅" : "❌"}`);
  log(`  组结论: ${groupPass ? "✅ PASS" : "❌ FAIL"}`);

  allGroupResults.push({ key, label: data.label, pass: groupPass, problemResults });
}

// ─────────────────────────────────────────────
// Test Summary
// ─────────────────────────────────────────────

log("\n\n" + "═".repeat(64));
log("📊 1. Test Summary");
sep("═");
log(`\n  测试组总数: ${allGroupResults.length}`);

let globalPass = true;
for (const r of allGroupResults) {
  if (!r.pass) globalPass = false;
  const passCount = r.problemResults.filter(p => p.assessment.pass).length;
  const citeCount = r.problemResults.filter(p => p.assessment.citeCheck.hasResumeQuote).length;
  log(`  • 组 ${r.label}: 问题 ${passCount}/${r.problemResults.length} 通过 | 引用 ${citeCount}/3 条 → ${r.pass ? "✅ PASS" : "❌ FAIL"}`);
}

// ─────────────────────────────────────────────
// Detailed Findings
// ─────────────────────────────────────────────

log("\n\n" + "═".repeat(64));
log("📋 2. Detailed Findings（每组 Top 3 问题）");
sep("═");

for (const r of allGroupResults) {
  log(`\n▶ 组 ${r.label}`);
  for (const pr of r.problemResults) {
    const p = pr.problem;
    log(`\n  问题 ${pr.index}: [${p.severity.toUpperCase()}] ${p.title}`);
    log(`    原文引用: ${pr.assessment.citeCheck.matchedQuotes.length > 0 ? pr.assessment.citeCheck.matchedQuotes.join(", ") : "❌ 无"}`);
    log(`    问题说明: ${p.description}`);
    // 找改写示例
    const eg = p.details.find(d => /→|should be|consider|recommend/i.test(d));
    if (eg) log(`    改写示例: ${eg}`);
  }
}

// ─────────────────────────────────────────────
// Failure Cases
// ─────────────────────────────────────────────

const failures = allGroupResults.flatMap(r =>
  r.problemResults.filter(p => !p.assessment.pass).map(p => ({ group: r.label, ...p }))
);

if (failures.length > 0) {
  log("\n\n" + "═".repeat(64));
  log("❌ 3. Failure Cases");
  sep("═");
  for (const f of failures) {
    log(`\n  组: ${f.group}`);
    log(`  问题: [${f.problem.severity}] ${f.problem.title}`);
    log(`  失败原因: ${f.assessment.issues.join(", ")}`);
    log(`  description: ${f.problem.description}`);
    log(`  details: ${f.problem.details.join(" | ")}`);
  }
} else {
  log("\n\n✅ 无 Failure Cases");
}

// ─────────────────────────────────────────────
// Final Verdict
// ─────────────────────────────────────────────

log("\n\n" + "═".repeat(64));
log("🏁 4. Final Verdict");
sep("═");

const passGroups = allGroupResults.filter(r => r.pass).length;
const totalProblems = allGroupResults.flatMap(r => r.problemResults).length;
const citedProblems = allGroupResults.flatMap(r => r.problemResults).filter(p => p.assessment.citeCheck.hasResumeQuote).length;

log(`\n  测试组: ${passGroups}/${allGroupResults.length} 通过`);
log(`  问题条目: ${citedProblems}/${totalProblems} 有原文引用`);

if (globalPass) {
  log("\n  ✅ PASS — P0-4 多样化测试完成，待人工评审");
} else {
  log("\n  ❌ FAIL — P0-4 多样化测试完成，待人工评审");
  log("     部分问题不满足验收标准（见 Failure Cases）");
}

sep("═");
log("注：P0-4 多样化测试完成，待人工评审");
