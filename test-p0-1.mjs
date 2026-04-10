/**
 * P0-1 no_fabrication 验收测试脚本
 * 测试目标：验证 AI 改写是否编造数字，以及后处理过滤是否正常工作
 * 规则：只测试，不改代码
 */

import OpenAI from "openai";

const ai = new OpenAI({
  apiKey: "sk-TQvGvxzcLqw6nwurBjFfycgGO5LMPschOfhplMj03DmSjxf4",
  baseURL: "https://breakout.wenwen-ai.com",
});

const MODEL = "claude-sonnet-4-6";
const JD = `
We are looking for a Software Engineer with:
- Experience in web application development
- Team collaboration and leadership skills
- Backend development skills
- Performance optimization experience
`;

// 完整复制 route.ts 的 generatePreview 逻辑（含过滤）
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

// 过滤逻辑：完全复制 route.ts 实现
function applyNoFabricationFilter(examples) {
  const filtered = [];
  const violations = [];

  for (const ex of examples) {
    const originalHasNumber = hasNumber(ex.original);
    const improvedHasNumber = hasNumber(ex.improved);

    if (!originalHasNumber && improvedHasNumber) {
      violations.push(ex);
      console.warn(`  [FILTERED] "${ex.original}" → "${ex.improved}"`);
    } else {
      filtered.push(ex);
    }
  }

  return { filtered, violations };
}

async function callRewriteAPI(bullets, label) {
  const resume = bullets.map(b => `- ${b}`).join("\n");
  
  const res = await ai.chat.completions.create({
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

  const raw = res.choices[0].message.content;
  const parsed = JSON.parse(extractJSON(raw));
  return parsed.examples || [];
}

// ─────────────────────────────────────────────
// 测试组定义
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
// 执行测试
// ─────────────────────────────────────────────

async function runGroupTest(groupName, bullets, expectNoNewNumbers, expectNumbersPreserved) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`测试组 ${groupName}：共 ${bullets.length} 个 bullet`);
  console.log("=".repeat(60));

  // 每次测试取所有 bullet 但 API 只返回 2 条改写
  // 为覆盖更多 bullet，分批测试：每批 5 个
  const BATCH = 5;
  const allResults = [];

  for (let i = 0; i < bullets.length; i += BATCH) {
    const batch = bullets.slice(i, i + BATCH);
    console.log(`\n  [批次 ${Math.floor(i/BATCH)+1}] bullet ${i+1}-${Math.min(i+BATCH, bullets.length)}`);
    
    try {
      const rawExamples = await callRewriteAPI(batch, groupName);
      console.log(`  AI 返回 ${rawExamples.length} 条改写（过滤前）`);

      // 打印原始结果
      for (const ex of rawExamples) {
        console.log(`    原文: "${ex.original}"`);
        console.log(`    改写: "${ex.improved}"`);
        console.log();
      }

      // 应用过滤
      const { filtered, violations } = applyNoFabricationFilter(rawExamples);
      console.log(`  过滤前: ${rawExamples.length} 条 | 过滤后: ${filtered.length} 条 | 违规: ${violations.length} 条`);

      allResults.push({
        batch: batch,
        rawExamples,
        filtered,
        violations,
      });
    } catch (err) {
      console.error(`  ❌ 批次 ${Math.floor(i/BATCH)+1} 失败:`, err.message);
      allResults.push({ batch, rawExamples: [], filtered: [], violations: [], error: err.message });
    }
  }

  return allResults;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     P0-1 no_fabrication 验收测试                        ║");
  console.log("║     只测试，不改代码                                     ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const results = {};

  // 组 A
  results.A = await runGroupTest("A（无数字原文）", GROUP_A, true, false);
  
  // 组 B
  results.B = await runGroupTest("B（有数字原文）", GROUP_B, false, true);
  
  // 组 C
  results.C = await runGroupTest("C（边界诱发样本）", GROUP_C, true, false);

  // ─────────────────────────────────────────────
  // 汇总报告
  // ─────────────────────────────────────────────
  console.log("\n\n" + "═".repeat(60));
  console.log("📊 测试汇总报告");
  console.log("═".repeat(60));

  let globalPass = true;
  const failureCases = [];

  for (const [group, batchResults] of Object.entries(results)) {
    let totalRaw = 0, totalFiltered = 0, totalViolations = 0;
    const groupFailures = [];
    const isNoNumberGroup = group === "A" || group === "C";
    const isNumberGroup = group === "B";

    for (const r of batchResults) {
      totalRaw += r.rawExamples?.length || 0;
      totalFiltered += r.filtered?.length || 0;
      totalViolations += r.violations?.length || 0;

      // A/C 组：过滤前就有数字的改写 = 编造
      if (isNoNumberGroup) {
        for (const ex of (r.rawExamples || [])) {
          if (!hasNumber(ex.original) && hasNumber(ex.improved)) {
            groupFailures.push({
              group,
              original: ex.original,
              improved: ex.improved,
              reason: "无数字原文，改写新增了数字（编造）",
              filteredOut: true,
            });
          }
        }
      }

      // B 组：原数字是否被篡改
      if (isNumberGroup) {
        for (const ex of (r.rawExamples || [])) {
          const origNums = (ex.original.match(/\d+/g) || []).map(Number);
          const imprNums = (ex.improved.match(/\d+/g) || []).map(Number);
          
          // 检查改写中是否出现了原文没有的数字
          for (const n of imprNums) {
            if (!origNums.includes(n)) {
              groupFailures.push({
                group,
                original: ex.original,
                improved: ex.improved,
                reason: `数字被篡改或新增（原文数字: [${origNums}], 改写数字: [${imprNums}]）`,
                filteredOut: false,
              });
              break;
            }
          }
        }
      }
    }

    // 可用性检查：过滤后是否完全删空
    const isUsable = totalFiltered > 0 || totalRaw === 0;
    const drainRate = totalRaw > 0 ? ((totalViolations / totalRaw) * 100).toFixed(0) : 0;

    const groupPass = groupFailures.length === 0 && isUsable;
    if (!groupPass) globalPass = false;
    failureCases.push(...groupFailures);

    console.log(`\n▶ 组 ${group}:`);
    console.log(`  AI 返回总数: ${totalRaw} | 过滤后: ${totalFiltered} | 违规被过滤: ${totalViolations} | 过滤率: ${drainRate}%`);
    console.log(`  可用性: ${isUsable ? "✅ 正常" : "❌ 严重缩水"}`);
    console.log(`  违规编造: ${groupFailures.length === 0 ? "✅ 无编造" : `❌ 发现 ${groupFailures.length} 条违规`}`);
    console.log(`  组结论: ${groupPass ? "✅ PASS" : "❌ FAIL"}`);
  }

  if (failureCases.length > 0) {
    console.log("\n\n" + "═".repeat(60));
    console.log("❌ 失败案例详情");
    console.log("═".repeat(60));
    for (const f of failureCases) {
      console.log(`\n组 ${f.group}:`);
      console.log(`  原文: "${f.original}"`);
      console.log(`  错误改写: "${f.improved}"`);
      console.log(`  失败原因: ${f.reason}`);
      console.log(`  是否被过滤: ${f.filteredOut ? "是（过滤机制有效）" : "否（过滤机制未拦截）"}`);
    }
  }

  console.log("\n\n" + "═".repeat(60));
  console.log("🏁 最终结论");
  console.log("═".repeat(60));
  
  if (globalPass) {
    console.log("✅ PASS — P0-1 可以关闭");
  } else {
    // 检查失败原因
    const unfiltered = failureCases.filter(f => !f.filteredOut);
    const numberTampering = failureCases.filter(f => f.group === "B");
    
    console.log("❌ FAIL — P0-1 不能关闭");
    console.log("\n失败原因分析:");
    if (unfiltered.length > 0) {
      console.log(`  - ${unfiltered.length} 条编造数字未被过滤机制拦截`);
    }
    if (numberTampering.length > 0) {
      console.log(`  - ${numberTampering.length} 条有数字原文被篡改`);
    }
  }
  console.log("═".repeat(60));
}

main().catch(console.error);
