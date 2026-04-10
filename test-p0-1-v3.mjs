#!/usr/bin/env node
/**
 * P0-1 no_fabrication 验收测试 v3 - 多轮高覆盖率
 * 每组重复调用 3 次，增加样本覆盖率
 * 重点：B 组数字篡改检测
 */

import { execSync } from "child_process";

const API_KEY = "sk-TQvGvxzcLqw6nwurBjFfycgGO5LMPschOfhplMj03DmSjxf4";
const BASE_URL = "https://breakout.wenwen-ai.com/v1/chat/completions";
const MODEL = "claude-sonnet-4-6";

const JD = `We are looking for a Software Engineer with:
- Experience in web application development
- Team collaboration and leadership skills
- Backend development skills
- Performance optimization experience`;

function extractJSON(raw) {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = raw.match(/(\{[\s\S]*\})/);
  if (objMatch) return objMatch[1].trim();
  return raw.trim();
}

function hasNumber(str) {
  return /\d/.test(str);
}

function applyNoFabricationFilter(examples) {
  const filtered = [];
  const violations = [];
  for (const ex of examples) {
    const originalHasNumber = hasNumber(ex.original);
    const improvedHasNumber = hasNumber(ex.improved);
    if (!originalHasNumber && improvedHasNumber) {
      violations.push(ex);
    } else {
      filtered.push(ex);
    }
  }
  return { filtered, violations };
}

function callAPI(bullets) {
  const resume = bullets.map(b => `- ${b}`).join("\n");
  const payload = JSON.stringify({
    model: MODEL,
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
${JD}

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
  });

  // Escape single quotes for shell
  const escaped = payload.replace(/'/g, "'\\''");
  const cmd = `curl -s -X POST "${BASE_URL}" -H "Authorization: Bearer ${API_KEY}" -H "Content-Type: application/json" -d '${escaped}'`;
  const output = execSync(cmd, { timeout: 60000 }).toString();
  const res = JSON.parse(output);
  const content = res.choices[0].message.content;
  const parsed = JSON.parse(extractJSON(content));
  return parsed.examples || [];
}

// ─────────────────────────────────────────────
const GROUP_A = [
  "Built web applications",
  "Managed team communication",
  "Improved system performance",
  "Developed internal tools",
  "Led product collaboration",
  "Created user-facing features",
  "Supported cross-functional teams",
  "Worked on backend services",
  "Handled customer requests",
  "Optimized internal workflows",
];

const GROUP_B = [
  "Managed 3 engineers",
  "Reduced load time by 20%",
  "Served 500 customers monthly",
  "Built 12 reporting dashboards",
  "Processed 200 invoices per week",
];

const GROUP_C = [
  "Improved efficiency",
  "Supported operations",
  "Built features for customers",
  "Contributed to reporting",
  "Worked with stakeholders",
];

// ─────────────────────────────────────────────
const ROUNDS = 3;  // 每组运行3轮，增加覆盖

function log(msg) { process.stdout.write(msg + "\n"); }
function sep(c = "─", n = 60) { log(c.repeat(n)); }

log("╔══════════════════════════════════════════════════════════╗");
log("║     P0-1 no_fabrication 验收测试 v3（多轮高覆盖）       ║");
log(`║     每组 ${ROUNDS} 轮 × 2条 = ~${ROUNDS*2} 条样本覆盖                        ║`);
log("╚══════════════════════════════════════════════════════════╝");

const report = {
  A: { raw: [], filtered: [], violations: [], failures: [] },
  B: { raw: [], filtered: [], violations: [], failures: [] },
  C: { raw: [], filtered: [], violations: [], failures: [] },
};

// ─────────────────────────────────────────────
// 组 A：无数字原文
// ─────────────────────────────────────────────
log("\n" + "═".repeat(60));
log("📋 组 A — 无数字原文（10 bullet，运行 3 轮）");
sep("═");

for (let round = 1; round <= ROUNDS; round++) {
  // 每轮随机取5个 bullet（交替前半/后半）
  const batch = round <= 2 ? GROUP_A.slice((round-1)*5, round*5) : GROUP_A.slice(2, 7);
  log(`\n  [轮 ${round}] 使用 bullet: ${batch.slice(0,3).map(b=>`"${b}"`).join(", ")}...`);
  try {
    const raw = callAPI(batch);
    report.A.raw.push(...raw);
    log(`  AI 返回 ${raw.length} 条：`);
    for (const ex of raw) {
      const origNum = hasNumber(ex.original);
      const imprNum = hasNumber(ex.improved);
      const flag = !origNum && imprNum ? "⚠️ 编造数字" : "✓";
      log(`    [${flag}] "${ex.original}" → "${ex.improved}"`);
      if (!origNum && imprNum) {
        report.A.failures.push({ original: ex.original, improved: ex.improved, reason: "无数字原文，改写新增数字（编造）" });
      }
    }
    const { filtered, violations } = applyNoFabricationFilter(raw);
    report.A.filtered.push(...filtered);
    report.A.violations.push(...violations);
    log(`  过滤后: ${filtered.length} | 违规: ${violations.length}`);
  } catch(e) {
    log(`  ❌ 失败: ${e.message}`);
  }
}

// ─────────────────────────────────────────────
// 组 B：有数字原文 - 重点验证数字是否被篡改
// ─────────────────────────────────────────────
log("\n" + "═".repeat(60));
log("📋 组 B — 有数字原文（5 bullet，运行 3 轮，重点验证不篡改）");
sep("═");

for (let round = 1; round <= ROUNDS; round++) {
  log(`\n  [轮 ${round}]`);
  try {
    const raw = callAPI(GROUP_B);
    report.B.raw.push(...raw);
    log(`  AI 返回 ${raw.length} 条：`);
    for (const ex of raw) {
      const origNums = (ex.original.match(/\d+/g) || []).map(Number);
      const imprNums = (ex.improved.match(/\d+/g) || []).map(Number);
      
      // 检查改写中出现的数字是否都在原文中存在
      const newNums = imprNums.filter(n => !origNums.includes(n));
      const flag = newNums.length > 0 ? `⚠️ 新数字[${newNums}]` : "✓";
      log(`    [${flag}] "${ex.original}"`);
      log(`           → "${ex.improved}"`);
      log(`           原文数字: [${origNums}]  改写数字: [${imprNums}]`);
      
      if (newNums.length > 0) {
        report.B.failures.push({
          original: ex.original,
          improved: ex.improved,
          reason: `数字被篡改/新增（原文: [${origNums}], 改写: [${imprNums}], 新增: [${newNums}]）`,
        });
      }
    }
    const { filtered, violations } = applyNoFabricationFilter(raw);
    report.B.filtered.push(...filtered);
    report.B.violations.push(...violations);
    log(`  过滤后: ${filtered.length} | 违规: ${violations.length}`);
  } catch(e) {
    log(`  ❌ 失败: ${e.message}`);
  }
}

// ─────────────────────────────────────────────
// 组 C：边界诱发样本
// ─────────────────────────────────────────────
log("\n" + "═".repeat(60));
log("📋 组 C — 边界诱发样本（5 bullet，运行 3 轮）");
sep("═");

for (let round = 1; round <= ROUNDS; round++) {
  log(`\n  [轮 ${round}]`);
  try {
    const raw = callAPI(GROUP_C);
    report.C.raw.push(...raw);
    log(`  AI 返回 ${raw.length} 条：`);
    for (const ex of raw) {
      const origNum = hasNumber(ex.original);
      const imprNum = hasNumber(ex.improved);
      const flag = !origNum && imprNum ? "⚠️ 编造数字" : "✓";
      log(`    [${flag}] "${ex.original}" → "${ex.improved}"`);
      if (!origNum && imprNum) {
        report.C.failures.push({ original: ex.original, improved: ex.improved, reason: "边界样本：改写新增数字（编造）" });
      }
    }
    const { filtered, violations } = applyNoFabricationFilter(raw);
    report.C.filtered.push(...filtered);
    report.C.violations.push(...violations);
    log(`  过滤后: ${filtered.length} | 违规: ${violations.length}`);
  } catch(e) {
    log(`  ❌ 失败: ${e.message}`);
  }
}

// ─────────────────────────────────────────────
// 最终汇总报告
// ─────────────────────────────────────────────
log("\n\n" + "═".repeat(60));
log("📊 Test Summary");
sep("═");

let globalPass = true;
const allFailures = [];

for (const [key, label, noNewNums, checkPreserve] of [
  ["A", "A（无数字原文）", true, false],
  ["B", "B（有数字原文）", false, true],
  ["C", "C（边界诱发样本）", true, false],
]) {
  const r = report[key];
  const totalRaw = r.raw.length;
  const totalFiltered = r.filtered.length;
  const totalViolations = r.violations.length;
  const fabrications = r.failures.length;
  const drainRate = totalRaw > 0 ? Math.round((totalViolations / totalRaw) * 100) : 0;
  const severelyDrained = totalRaw > 0 && totalFiltered === 0;

  const groupPass = fabrications === 0 && !severelyDrained;
  if (!groupPass) globalPass = false;
  allFailures.push(...r.failures);

  log(`\n▶ 组 ${label}`);
  log(`  总样本: ${totalRaw} | 过滤后可用: ${totalFiltered} | 被过滤: ${totalViolations} | 过滤率: ${drainRate}%`);
  log(`  数字编造/篡改案例: ${fabrications} 条`);
  log(`  可用性: ${severelyDrained ? "❌ 严重缩水" : "✅ 正常"}`);
  log(`  组结论: ${groupPass ? "✅ PASS" : "❌ FAIL"}`);
}

// Failure cases
if (allFailures.length > 0) {
  log("\n\n" + "═".repeat(60));
  log("❌ Failure Cases（详情）");
  sep("═");
  for (const f of allFailures) {
    log(`\n  原文: "${f.original}"`);
    log(`  错误改写: "${f.improved}"`);
    log(`  失败原因: ${f.reason}`);
  }
}

// Final Verdict
log("\n\n" + "═".repeat(60));
log("🏁 Final Verdict");
sep("═");

if (globalPass) {
  log("✅  PASS — P0-1 可以关闭");
  log(`   无数字样本中编造数字：0 次`);
  log(`   有数字样本中数字篡改：0 次`);
  log(`   过滤后输出可用性：正常`);
} else {
  const unblocked = allFailures.filter(f => !f.filteredOut);
  log("❌  FAIL — P0-1 不能关闭");
  log(`   编造/篡改案例总数: ${allFailures.length}`);
  log(`   未被过滤机制拦截: ${unblocked.length}`);
}
sep("═");
