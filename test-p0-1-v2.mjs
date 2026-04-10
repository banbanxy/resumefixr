#!/usr/bin/env node
/**
 * P0-1 no_fabrication 验收测试脚本 v2
 * 使用 curl 直接调用 API（绕过 OpenAI SDK baseURL 路径问题）
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

// 完整复制 route.ts 的 extractJSON 逻辑
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

// 完整复制 route.ts 的过滤逻辑
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

// 使用 curl 调用 API
function callAPI(messages, temperature = 0.7) {
  const payload = JSON.stringify({
    model: MODEL,
    temperature,
    messages,
  });

  const cmd = `curl -s -X POST "${BASE_URL}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d '${payload.replace(/'/g, "'\\''")}'`;

  const output = execSync(cmd, { timeout: 60000 }).toString();
  const parsed = JSON.parse(output);
  return parsed.choices[0].message.content;
}

// 完整复制 route.ts 的 generatePreview prompt
function callRewriteAPI(bullets) {
  const resume = bullets.map(b => `- ${b}`).join("\n");

  const content = callAPI([
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
  ]);

  const parsed = JSON.parse(extractJSON(content));
  return parsed.examples || [];
}

// ─────────────────────────────────────────────
// 测试组定义
// ─────────────────────────────────────────────

const GROUPS = {
  A: {
    label: "A（无数字原文）",
    bullets: [
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
    ],
    noNewNumbers: true,
    preserveNumbers: false,
  },
  B: {
    label: "B（有数字原文）",
    bullets: [
      "Managed 3 engineers",
      "Reduced load time by 20%",
      "Served 500 customers monthly",
      "Built 12 reporting dashboards",
      "Processed 200 invoices per week",
    ],
    noNewNumbers: false,
    preserveNumbers: true,
  },
  C: {
    label: "C（边界诱发样本）",
    bullets: [
      "Improved efficiency",
      "Supported operations",
      "Built features for customers",
      "Contributed to reporting",
      "Worked with stakeholders",
    ],
    noNewNumbers: true,
    preserveNumbers: false,
  },
};

// 汇总数据
const allResults = {};

function printLine(char = "─", len = 60) {
  console.log(char.repeat(len));
}

async function runGroupTest(groupKey, group) {
  console.log(`\n${printLine("═") || ""}${"═".repeat(60)}`);
  console.log(`📋 测试组 ${group.label}（共 ${group.bullets.length} 个 bullet）`);
  printLine("═");

  const BATCH_SIZE = 5;
  const batchResults = [];

  for (let i = 0; i < group.bullets.length; i += BATCH_SIZE) {
    const batch = group.bullets.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    console.log(`\n  [批次 ${batchNum}] bullet ${i + 1}–${Math.min(i + BATCH_SIZE, group.bullets.length)}`);

    try {
      const rawExamples = callRewriteAPI(batch);
      console.log(`  ▸ AI 返回 ${rawExamples.length} 条（过滤前）`);

      for (const ex of rawExamples) {
        const origHasNum = hasNumber(ex.original);
        const imprHasNum = hasNumber(ex.improved);
        const flag = !origHasNum && imprHasNum ? "⚠️ 编造数字" : "✓";
        console.log(`    [${flag}] 原文: "${ex.original}"`);
        console.log(`           改写: "${ex.improved}"`);
      }

      const { filtered, violations } = applyNoFabricationFilter(rawExamples);
      console.log(`  ▸ 过滤后: ${filtered.length} | 被过滤违规: ${violations.length}`);

      if (violations.length > 0) {
        for (const v of violations) {
          console.log(`    [FILTERED] "${v.original}" → "${v.improved}"`);
        }
      }

      batchResults.push({ batch, rawExamples, filtered, violations });
    } catch (err) {
      console.error(`  ❌ 批次失败: ${err.message}`);
      batchResults.push({ batch, rawExamples: [], filtered: [], violations: [], error: err.message });
    }
  }

  allResults[groupKey] = batchResults;
}

// ─────────────────────────────────────────────
// 主逻辑
// ─────────────────────────────────────────────
console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║     P0-1 no_fabrication 验收测试 (v2)                   ║");
console.log("║     只测试，不改代码                                     ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

for (const [key, group] of Object.entries(GROUPS)) {
  runGroupTest(key, group);
}

// ─────────────────────────────────────────────
// 汇总分析
// ─────────────────────────────────────────────
console.log("\n\n" + "═".repeat(60));
console.log("📊 Test Summary");
printLine("═");

let globalPass = true;
const allFailureCases = [];

for (const [groupKey, batchResults] of Object.entries(allResults)) {
  const group = GROUPS[groupKey];
  let totalRaw = 0, totalFiltered = 0, totalViolations = 0;
  const groupFailures = [];

  for (const r of batchResults) {
    totalRaw += r.rawExamples?.length || 0;
    totalFiltered += r.filtered?.length || 0;
    totalViolations += r.violations?.length || 0;

    // A/C 组：检测无数字原文是否出现数字改写（编造）
    if (group.noNewNumbers) {
      for (const ex of (r.rawExamples || [])) {
        if (!hasNumber(ex.original) && hasNumber(ex.improved)) {
          groupFailures.push({
            groupKey,
            original: ex.original,
            improved: ex.improved,
            reason: "无数字原文，改写新增数字（编造）",
            filteredOut: true,  // 根据过滤逻辑，此类会被过滤
            blockedByFilter: r.violations?.some(v => v.original === ex.original && v.improved === ex.improved),
          });
        }
      }
    }

    // B 组：检测原数字是否被篡改
    if (group.preserveNumbers) {
      for (const ex of (r.filtered || [])) {  // 已通过过滤的改写
        const origNums = new Set((ex.original.match(/\d+/g) || []).map(Number));
        const imprNums = (ex.improved.match(/\d+/g) || []).map(Number);

        for (const n of imprNums) {
          if (!origNums.has(n)) {
            groupFailures.push({
              groupKey,
              original: ex.original,
              improved: ex.improved,
              reason: `数字被篡改/新增（原文: [${[...origNums]}], 改写: [${imprNums}]）`,
              filteredOut: false,
            });
            break;
          }
        }
      }
    }
  }

  // 可用性：过滤后输出是否严重缩水
  const usableCount = totalFiltered;
  const drainRate = totalRaw > 0 ? Math.round((totalViolations / totalRaw) * 100) : 0;
  const severelyDrained = totalRaw > 0 && usableCount === 0;

  if (severelyDrained) {
    groupFailures.push({
      groupKey,
      original: "(所有输出)",
      improved: "(全部被过滤)",
      reason: `输出严重缩水：过滤率 ${drainRate}%，可用条数归零`,
      filteredOut: true,
    });
  }

  const groupPass = groupFailures.length === 0;
  if (!groupPass) globalPass = false;
  allFailureCases.push(...groupFailures);

  const status = groupPass ? "✅ PASS" : "❌ FAIL";
  const usability = severelyDrained ? "❌ 严重缩水" : "✅ 正常";

  console.log(`\n▶ 组 ${group.label}`);
  console.log(`  总条数: ${totalRaw} | 过滤后: ${totalFiltered} | 过滤率: ${drainRate}%`);
  console.log(`  编造违规(原始): ${totalViolations} | 可用性: ${usability}`);
  console.log(`  数字编造失败: ${groupFailures.filter(f => f.reason.includes("编造") || f.reason.includes("篡改")).length} 条`);
  console.log(`  组结论: ${status}`);
}

// ─────────────────────────────────────────────
// Detailed Findings
// ─────────────────────────────────────────────
if (allFailureCases.length > 0) {
  console.log("\n\n" + "═".repeat(60));
  console.log("❌ Failure Cases");
  printLine("═");

  for (const f of allFailureCases) {
    console.log(`\n  组: ${GROUPS[f.groupKey].label}`);
    console.log(`  原文: "${f.original}"`);
    console.log(`  错误改写: "${f.improved}"`);
    console.log(`  失败原因: ${f.reason}`);
    console.log(`  是否被过滤: ${f.filteredOut ? "✅ 是（过滤生效）" : "❌ 否（过滤未拦截）"}`);
  }
}

// ─────────────────────────────────────────────
// Final Verdict
// ─────────────────────────────────────────────
console.log("\n\n" + "═".repeat(60));
console.log("🏁 Final Verdict");
printLine("═");

if (globalPass) {
  console.log("✅  PASS — P0-1 可以关闭");
} else {
  const unblocked = allFailureCases.filter(f => !f.filteredOut);
  const drained = allFailureCases.filter(f => f.reason.includes("缩水"));

  console.log("❌  FAIL — P0-1 不能关闭");
  if (unblocked.length > 0) {
    console.log(`  → ${unblocked.length} 条编造数字未被过滤拦截`);
  }
  if (drained.length > 0) {
    console.log(`  → 输出严重缩水，影响可用性`);
  }
}
printLine("═");
