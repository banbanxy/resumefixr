#!/usr/bin/env node
/**
 * P0-2 / P0-3 问题存在性验证测试
 * P0-2: generateFullSuggestions 是否按 High/Medium/Low 动态生成建议数量
 * P0-3: 是否存在重复建议（同原句或语义相似 >70%）
 * 规则：只测试，不改代码
 */

import { execSync } from "child_process";

const API_KEY = "sk-TQvGvxzcLqw6nwurBjFfycgGO5LMPschOfhplMj03DmSjxf4";
const BASE_URL = "https://breakout.wenwen-ai.com/v1/chat/completions";
const MODEL = "claude-sonnet-4-6";

// ─── 完整复制 route.ts 的 generateFullSuggestions prompt ──────────

function extractJSON(raw) {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const obj = raw.match(/(\{[\s\S]*\})/);
  if (obj) return obj[1].trim();
  return raw.trim();
}

function callFullSuggestionsAPI(resume, jd) {
  const messages = [
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
6. Group into: Keyword Optimization, Quantified Achievements, Action Verbs, Structure & Clarity.

7. CRITICAL NO-FABRICATION RULE:
   - If original contains NO numbers → rewrite MUST NOT add numbers
   - Only preserve/refine numbers that already exist in original

8. Examples of FORBIDDEN fabrication:
   ❌ "Developed features" → "Developed 15+ features" (no number in original)
   ❌ "Improved performance" → "Improved performance by 40%" (no baseline)

9. Examples of ALLOWED rewrites:
   ✅ "Developed features" → "Developed customer-facing features using React"
   ✅ "Managed 3 engineers" → "Led team of 3 engineers on critical projects" (number exists)`,
    },
  ];

  const payload = JSON.stringify({ model: MODEL, temperature: 0.5, max_tokens: 4000, messages });
  const escaped = payload.replace(/'/g, "'\\''");
  const cmd = `curl -s -X POST "${BASE_URL}" -H "Authorization: Bearer ${API_KEY}" -H "Content-Type: application/json" -d '${escaped}'`;
  const output = execSync(cmd, { timeout: 90000 }).toString();
  const res = JSON.parse(output);
  const content = res.choices[0].message.content;
  const parsed = JSON.parse(extractJSON(content));

  // 完整复制 route.ts 的后处理（no_fabrication 过滤 + totalSuggestions 重算）
  parsed.categories = parsed.categories.map(cat => {
    const validItems = cat.items.filter(item => {
      const originalHasNumber = /\d/.test(item.original);
      const rewriteHasNumber = /\d/.test(item.rewrite);
      if (!originalHasNumber && rewriteHasNumber) {
        console.warn(`  [no_fabrication] Filtered: "${item.original}"`);
        return false;
      }
      return true;
    });
    return { ...cat, items: validItems, count: validItems.length };
  });

  const actualTotal = parsed.categories.reduce((sum, cat) => sum + cat.count, 0);
  if (parsed.summary) parsed.summary.totalSuggestions = actualTotal;

  return parsed;
}

// ─── P0-2: 动态数量规则（来自任务定义）────────────────────────────

const EXPECTED_RANGES = {
  high:   { min: 2, max: 4 },
  medium: { min: 3, max: 6 },
  low:    { min: 5, max: 10 },
};

function checkP02(item, catName) {
  const impact = (item.impact || "").toLowerCase();
  const range = EXPECTED_RANGES[impact];
  // P0-2 是category级别的动态控制，但prompt定义的是 item.impact 字段
  // 这里记录每个 item 的 impact 值，用于后续分析
  return { impact, catName, hasRange: !!range, range };
}

// ─── P0-3: 重复检测（原句匹配 + 简单词重叠）────────────────────────

function normalizeText(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff\s]/g, "").trim();
}

function wordOverlapRate(a, b) {
  const wa = new Set(normalizeText(a).split(/\s+/).filter(w => w.length > 2));
  const wb = new Set(normalizeText(b).split(/\s+/).filter(w => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  const intersection = [...wa].filter(w => wb.has(w));
  return intersection.length / Math.max(wa.size, wb.size);
}

function detectDuplicates(allItems, threshold = 0.7) {
  const duplicates = [];
  for (let i = 0; i < allItems.length; i++) {
    for (let j = i + 1; j < allItems.length; j++) {
      const a = allItems[i];
      const b = allItems[j];

      // 原句完全相同
      if (normalizeText(a.original) === normalizeText(b.original)) {
        duplicates.push({
          type: "完全相同原句",
          item1: { cat: a.cat, original: a.original, rewrite: a.rewrite },
          item2: { cat: b.cat, original: b.original, rewrite: b.rewrite },
          similarity: 1.0,
        });
        continue;
      }

      // 改写语义相似（词重叠 >70%）
      const rewriteSim = wordOverlapRate(a.rewrite, b.rewrite);
      if (rewriteSim >= threshold) {
        duplicates.push({
          type: `改写语义相似 (${(rewriteSim * 100).toFixed(0)}%)`,
          item1: { cat: a.cat, original: a.original, rewrite: a.rewrite },
          item2: { cat: b.cat, original: b.original, rewrite: b.rewrite },
          similarity: rewriteSim,
        });
      }
    }
  }
  return duplicates;
}

// ─── 测试组 ─────────────────────────────────────────────────────────

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
    label: "E — 中英文混合/软技能",
    resume: `- 协调跨部门团队完成项目交付
- Led user research and translated findings into actionable insights
- 提高团队沟通效率，减少会议冗余
- Supported internal training sessions to onboard new employees
- 参与制定产品策略，确保市场需求落地`,
    jd: "cross-department coordination, user research, team communication, training, product strategy",
  },
];

// ─── 主测试逻辑 ──────────────────────────────────────────────────────

function log(s) { process.stdout.write(s + "\n"); }
function sep(c = "─", n = 65) { log(c.repeat(n)); }

log("╔═══════════════════════════════════════════════════════════════╗");
log("║  P0-2 / P0-3 问题存在性验证测试                              ║");
log("║  P0-2: 动态建议数量  |  P0-3: 重复建议去重                   ║");
log("╚═══════════════════════════════════════════════════════════════╝");

const allGroupData = [];

for (const group of GROUPS) {
  log("\n" + "═".repeat(65));
  log(`📋 测试组 ${group.label}`);
  sep("═");

  let result;
  try {
    result = callFullSuggestionsAPI(group.resume, group.jd);
  } catch (e) {
    log(`❌ API 失败: ${e.message}`);
    allGroupData.push({ ...group, error: e.message, categories: [], allItems: [], duplicates: [] });
    continue;
  }

  log(`\n  totalSuggestions: ${result.summary?.totalSuggestions} | estimatedImpact: ${result.summary?.estimatedImpact}`);
  log(`  分类数: ${result.categories?.length}`);

  // 收集所有 items（带分类标记）
  const allItems = [];
  const impactCounts = { high: 0, medium: 0, low: 0, unknown: 0 };
  const p02Violations = [];

  for (const cat of (result.categories || [])) {
    log(`\n  ── 分类: "${cat.name}" (${cat.count} 条)`);
    for (const item of (cat.items || [])) {
      const impact = (item.impact || "unknown").toLowerCase();
      impactCounts[impact] = (impactCounts[impact] || 0) + 1;
      allItems.push({ ...item, cat: cat.name });

      log(`\n    [${impact.toUpperCase()}] original: "${item.original}"`);
      log(`           rewrite: "${item.rewrite}"`);
      log(`           keyword_source: ${item.keyword_source}`);
      log(`           why_it_works.jd_requirement: ${item.why_it_works?.jd_requirement}`);
    }
  }

  // ── P0-2 分析：按 impact 级别检查每个 category 的数量分布 ──
  log(`\n  ── P0-2 建议数量分析`);
  log(`     impact 分布: high=${impactCounts.high} | medium=${impactCounts.medium} | low=${impactCounts.low}`);

  // P0-2 的真正检查：每个 category 内按 impact 分组，看数量是否在预期范围内
  for (const cat of (result.categories || [])) {
    const catByImpact = {};
    for (const item of cat.items) {
      const impact = (item.impact || "unknown").toLowerCase();
      catByImpact[impact] = (catByImpact[impact] || 0) + 1;
    }
    const catTotal = cat.items.length;
    log(`     [${cat.name}] total=${catTotal} | ${Object.entries(catByImpact).map(([k,v])=>`${k}:${v}`).join(", ")}`);

    // 检查：category 总数是否合理（prompt没有按 High/Medium/Low 分类规定数量）
    // 实际检查：是否存在某 impact 级别数量不符合预期范围
    for (const [impact, count] of Object.entries(catByImpact)) {
      const range = EXPECTED_RANGES[impact];
      if (range && (count < range.min || count > range.max)) {
        p02Violations.push({
          cat: cat.name,
          impact,
          count,
          expected: `${range.min}–${range.max}`,
        });
        log(`     ⚠️  P0-2 违规: ${cat.name} 中 impact=${impact} 有 ${count} 条 (预期 ${range.min}–${range.max})`);
      }
    }
  }

  // ── P0-3 重复检测 ──
  log(`\n  ── P0-3 重复检测（阈值 70% 词重叠）`);
  const duplicates = detectDuplicates(allItems);
  if (duplicates.length === 0) {
    log(`     ✅ 未发现重复条目`);
  } else {
    log(`     ❌ 发现 ${duplicates.length} 组重复：`);
    for (const dup of duplicates) {
      log(`     [${dup.type}]`);
      log(`       ① [${dup.item1.cat}] "${dup.item1.original}" → "${dup.item1.rewrite}"`);
      log(`       ② [${dup.item2.cat}] "${dup.item2.original}" → "${dup.item2.rewrite}"`);
      log(`       相似度: ${(dup.similarity * 100).toFixed(0)}%`);
    }
  }

  allGroupData.push({
    ...group,
    result,
    allItems,
    impactCounts,
    p02Violations,
    duplicates,
  });
}

// ─── 汇总报告 ────────────────────────────────────────────────────────

log("\n\n" + "═".repeat(65));
log("📊 1. Test Summary");
sep("═");

let hasP02Problem = false;
let hasP03Problem = false;
const allFailures = [];

for (const g of allGroupData) {
  if (g.error) {
    log(`\n▶ 组 ${g.label}: ❌ API错误`);
    continue;
  }
  const total = g.result?.summary?.totalSuggestions || 0;
  const p02 = g.p02Violations?.length || 0;
  const p03 = g.duplicates?.length || 0;
  if (p02 > 0) hasP02Problem = true;
  if (p03 > 0) hasP03Problem = true;

  log(`\n▶ 组 ${g.label}`);
  log(`   建议总数: ${total} | high:${g.impactCounts?.high||0} medium:${g.impactCounts?.medium||0} low:${g.impactCounts?.low||0}`);
  log(`   P0-2 数量违规: ${p02 > 0 ? `❌ ${p02} 处` : "✅ 无"}`);
  log(`   P0-3 重复建议: ${p03 > 0 ? `❌ ${p03} 组` : "✅ 无"}`);

  if (p02 > 0) allFailures.push(...g.p02Violations.map(v => ({ type: "P0-2", group: g.label, ...v })));
  if (p03 > 0) allFailures.push(...g.duplicates.map(d => ({ type: "P0-3", group: g.label, ...d })));
}

// ─── Detailed Findings ───────────────────────────────────────────────

log("\n\n" + "═".repeat(65));
log("📋 2. Detailed Findings — 每组建议完整列表（摘要）");
sep("═");

for (const g of allGroupData) {
  if (g.error) continue;
  log(`\n▶ 组 ${g.label}`);
  for (const cat of (g.result?.categories || [])) {
    log(`  [${cat.name}] (${cat.count} 条)`);
    for (const item of cat.items) {
      const dup = g.duplicates?.some(d =>
        d.item1.original === item.original || d.item2.original === item.original
      ) ? " ⚠️DUPLICATE" : "";
      log(`    [${item.impact?.toUpperCase()}] "${item.original}"${dup}`);
      log(`       → "${item.rewrite}"`);
    }
  }
}

// ─── Failure Cases ───────────────────────────────────────────────────

if (allFailures.length > 0) {
  log("\n\n" + "═".repeat(65));
  log("❌ 3. Failure Cases");
  sep("═");
  for (const f of allFailures) {
    log(`\n  [${f.type}] 组 ${f.group}`);
    if (f.type === "P0-2") {
      log(`    分类: ${f.cat} | impact: ${f.impact} | 实际数量: ${f.count} | 预期: ${f.expected}`);
    } else {
      log(`    类型: ${f.type_} || f.type`);
      log(`    ① [${f.item1?.cat}] "${f.item1?.original}" → "${f.item1?.rewrite}"`);
      log(`    ② [${f.item2?.cat}] "${f.item2?.original}" → "${f.item2?.rewrite}"`);
      log(`    相似度: ${f.similarity ? (f.similarity * 100).toFixed(0) + "%" : "—"}`);
    }
  }
} else {
  log("\n\n✅ 无 Failure Cases");
}

// ─── Final Verdict ───────────────────────────────────────────────────

log("\n\n" + "═".repeat(65));
log("🏁 4. Final Verdict");
sep("═");

log(`\n  P0-2（动态建议数量）: ${hasP02Problem ? "❌ 问题存在" : "✅ 未发现问题"}`);
log(`  P0-3（重复建议去重）: ${hasP03Problem ? "❌ 问题存在" : "✅ 未发现问题"}`);

const globalVerdict = hasP02Problem || hasP03Problem ? "FAIL" : "PASS";
log(`\n  总体: ${globalVerdict === "PASS" ? "✅ PASS" : "❌ FAIL"}`);

log("\n  P0-2 / P0-3 问题存在性验证完成，待人工评审");
sep("═");
