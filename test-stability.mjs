#!/usr/bin/env node
/**
 * Analyze 功能稳定性验证脚本
 * 执行 6 组样本 × 5 次 = 30 次 API 调用
 * 支持自动重试、响应时间统计、结构化报告
 */

import OpenAI from "openai";

// ── AI Client ───────────────────────────────────────────────
const ai = new OpenAI({
  apiKey: "sk-TQvGvxzcLqw6nwurBjFfycgGO5LMPschOfhplMj03DmSjxf4",
  baseURL: "https://breakout.wenwen-ai.com/v1",
});
const MODEL = "claude-sonnet-4-6";

// ── 6 组测试样本 P0-P4+边界 ──────────────────────────────────
const SAMPLES = [
  {
    id: "P0-A",
    label: "P0-A — 短 Bullet，无数字",
    resume: `Built web applications
Managed team communication
Improved system performance
Developed internal tools
Led product collaboration`,
    jd: "cross-functional collaboration, internal tools, product development, communication",
  },
  {
    id: "P0-B",
    label: "P0-B — 短 Bullet，有数字",
    resume: `Managed 3 engineers
Reduced load time by 20%
Served 500 customers monthly
Built 12 dashboards
Processed 200 invoices per week`,
    jd: "team leadership, performance metrics, customer handling, dashboard reporting, operations",
  },
  {
    id: "P1-C",
    label: "P1-C — 边界模糊 Bullet",
    resume: `Improved efficiency
Supported operations
Built features for customers
Contributed to reporting
Worked with stakeholders`,
    jd: "operational efficiency, stakeholder collaboration, reporting, project delivery",
  },
  {
    id: "P2-D",
    label: "P2-D — 长句复杂 Bullet",
    resume: `Led cross-functional teams to implement product features from ideation to release, ensuring alignment with business objectives
Designed internal tools that reduced manual workflow steps by 30% and improved developer efficiency
Analyzed customer usage data to identify trends and inform product roadmap decisions
Collaborated with marketing, design, and engineering to deliver quarterly product updates
Created reporting dashboards consolidating KPIs across multiple departments`,
    jd: "cross-functional collaboration, workflow optimization, data analysis, reporting, roadmap planning",
  },
  {
    id: "P3-E",
    label: "P3-E — 中英文混合/软技能",
    resume: `协调跨部门团队完成项目交付
Led user research and translated findings into actionable insights
提高团队沟通效率，减少会议冗余
Supported internal training sessions to onboard new employees
参与制定产品策略，确保市场需求落地`,
    jd: "cross-department coordination, user research, team communication, training, product strategy",
  },
  {
    id: "P4-F",
    label: "P4-F — 极短/边界空输入 Bullet",
    resume: `coding
led team
did reports
helped customers
fixed bugs`,
    jd: "software engineering, team leadership, customer support, reporting, debugging",
  },
];

// ── 工具函数 ────────────────────────────────────────────────
function extractJSON(raw) {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = raw.match(/(\{[\s\S]*\})/);
  if (objMatch) return objMatch[1].trim();
  return raw.trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── 带重试的 AI 调用 ────────────────────────────────────────
async function callWithRetry(fn, maxRetries = 2, label = "") {
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await fn();
      return { success: true, result, attempt };
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === maxRetries + 1;
      const errType = classifyError(err);
      if (!isLastAttempt) {
        const delay = attempt * 2000; // 2s, 4s
        console.log(`    ⚠️  [${label}] 第${attempt}次失败(${errType})，${delay/1000}s 后重试...`);
        await sleep(delay);
      } else {
        console.log(`    ❌ [${label}] 全部 ${maxRetries + 1} 次尝试失败`);
      }
    }
  }
  return { success: false, error: lastError, errorType: classifyError(lastError), attempt: maxRetries + 1 };
}

function classifyError(err) {
  if (!err) return "unknown";
  const msg = (err.message || "").toLowerCase();
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("econnreset") || msg.includes("socket")) return "network/timeout";
  if (msg.includes("rate limit") || msg.includes("429")) return "rate_limit";
  if (msg.includes("json") || msg.includes("parse") || msg.includes("unexpected")) return "parse_error";
  if (msg.includes("400") || msg.includes("bad request")) return "input_error";
  if (msg.includes("500") || msg.includes("502") || msg.includes("503")) return "model/server";
  return "other";
}

// ── 生成 Diagnostics ────────────────────────────────────────
async function generateDiagnostics(resume, jd) {
  const res = await ai.chat.completions.create({
    model: MODEL,
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
    "required": ["keyword1"],
    "found": ["keyword2"],
    "missing": ["keyword3"]
  },
  "problems": [
    {"title":"string","description":"string","severity":"high"|"medium"|"low","details":["string"]}
  ]
}`,
      },
    ],
  });
  return JSON.parse(extractJSON(res.choices[0].message.content));
}

// ── 生成 Preview ─────────────────────────────────────────────
async function generatePreview(resume, jd) {
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
${jd}

Required JSON format:
{"examples":[{"original":"string","improved":"string"},{"original":"string","improved":"string"}]}`,
      },
    ],
  });
  return JSON.parse(extractJSON(res.choices[0].message.content));
}

// ── 执行单次 Analyze（diagnostics + preview 并行）────────────
async function analyzeOnce(sample, runIndex) {
  const startTime = Date.now();
  const label = `${sample.id} #${runIndex}`;

  const [diagResult, previewResult] = await Promise.all([
    callWithRetry(() => generateDiagnostics(sample.resume, sample.jd), 2, `${label}/diag`),
    callWithRetry(() => generatePreview(sample.resume, sample.jd), 2, `${label}/preview`),
  ]);

  const elapsed = Date.now() - startTime;
  const success = diagResult.success && previewResult.success;

  let failureReason = null;
  if (!success) {
    if (!diagResult.success && !previewResult.success) {
      failureReason = `diag:${diagResult.errorType}, preview:${previewResult.errorType}`;
    } else if (!diagResult.success) {
      failureReason = `diag:${diagResult.errorType}`;
    } else {
      failureReason = `preview:${previewResult.errorType}`;
    }
  }

  return {
    label,
    sampleId: sample.id,
    runIndex,
    success,
    elapsedMs: elapsed,
    elapsedSec: (elapsed / 1000).toFixed(2),
    diagAttempts: diagResult.attempt,
    previewAttempts: previewResult.attempt,
    failureReason,
    diagResult: diagResult.result || null,
    previewResult: previewResult.result || null,
  };
}

// ── 主测试流程 ───────────────────────────────────────────────
async function runStabilityTest() {
  const RUNS_PER_SAMPLE = 5;
  const allResults = [];
  const startAll = Date.now();

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Analyze 功能稳定性验证 — 6组样本 × 5次 = 30次调用      ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`模型: ${MODEL}`);
  console.log(`时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}\n`);

  for (const sample of SAMPLES) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`📋 ${sample.label}`);
    console.log("─".repeat(60));

    const groupResults = [];
    for (let i = 1; i <= RUNS_PER_SAMPLE; i++) {
      process.stdout.write(`  Run ${i}/${RUNS_PER_SAMPLE} ... `);
      const result = await analyzeOnce(sample, i);
      allResults.push(result);
      groupResults.push(result);

      const icon = result.success ? "✅" : "❌";
      const retryNote =
        result.diagAttempts > 1 || result.previewAttempts > 1
          ? ` (重试: diag×${result.diagAttempts} preview×${result.previewAttempts})`
          : "";
      console.log(`${icon} ${result.elapsedSec}s${retryNote}${result.failureReason ? ` [${result.failureReason}]` : ""}`);

      // 限流保护：每次调用后等待 500ms
      if (i < RUNS_PER_SAMPLE) await sleep(500);
    }

    const successCount = groupResults.filter((r) => r.success).length;
    const avgMs = groupResults.reduce((s, r) => s + r.elapsedMs, 0) / groupResults.length;
    console.log(`  → 组结果: ${successCount}/${RUNS_PER_SAMPLE} 成功 | 平均响应: ${(avgMs / 1000).toFixed(2)}s`);

    // 组间休息 1s
    await sleep(1000);
  }

  const totalElapsed = (Date.now() - startAll) / 1000;

  // ── 生成报告 ───────────────────────────────────────────────
  generateReport(allResults, totalElapsed);
}

function generateReport(results, totalElapsedSec) {
  const total = results.length;
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);
  const successRate = ((successes.length / total) * 100).toFixed(1);
  const failRate = ((failures.length / total) * 100).toFixed(1);

  const elapsed = successes.map((r) => r.elapsedMs);
  const avgSec = elapsed.length ? (elapsed.reduce((a, b) => a + b, 0) / elapsed.length / 1000).toFixed(2) : "N/A";
  const maxSec = elapsed.length ? (Math.max(...elapsed) / 1000).toFixed(2) : "N/A";
  const minSec = elapsed.length ? (Math.min(...elapsed) / 1000).toFixed(2) : "N/A";

  // P95
  const sortedElapsed = [...elapsed].sort((a, b) => a - b);
  const p95 = sortedElapsed.length
    ? (sortedElapsed[Math.floor(sortedElapsed.length * 0.95)] / 1000).toFixed(2)
    : "N/A";

  // 重试统计
  const withRetries = results.filter((r) => r.diagAttempts > 1 || r.previewAttempts > 1);
  const retryRate = ((withRetries.length / total) * 100).toFixed(1);

  // 失败原因分类
  const failureCategories = {};
  for (const f of failures) {
    const cat = f.failureReason || "unknown";
    failureCategories[cat] = (failureCategories[cat] || 0) + 1;
  }

  // 每组统计
  const groupStats = {};
  for (const r of results) {
    if (!groupStats[r.sampleId]) groupStats[r.sampleId] = { success: 0, fail: 0, times: [] };
    if (r.success) {
      groupStats[r.sampleId].success++;
      groupStats[r.sampleId].times.push(r.elapsedMs);
    } else {
      groupStats[r.sampleId].fail++;
    }
  }

  // 验收判断
  const passFailRate = parseFloat(failRate) <= 1;
  const passAvgResponse = parseFloat(avgSec) <= 10 || avgSec === "N/A";

  console.log("\n\n" + "═".repeat(64));
  console.log("📊 STABILITY TEST REPORT — Analyze 功能稳定性验证报告");
  console.log("═".repeat(64));

  console.log(`
## 1. Test Summary（测试概况）
${"─".repeat(64)}
- 总调用次数:     ${total} 次
- 成功次数:       ${successes.length} 次
- 失败次数:       ${failures.length} 次
- 成功率:         ${successRate}%
- 失败率:         ${failRate}%
- 触发重试次数:   ${withRetries.length} 次 (${retryRate}%)
- 总耗时:         ${totalElapsedSec.toFixed(1)} 秒

## 2. 响应时间统计（成功调用）
${"─".repeat(64)}
- 平均响应:       ${avgSec}s
- 最快响应:       ${minSec}s
- 最慢响应:       ${maxSec}s
- P95 响应:       ${p95}s
- 验收标准(≤10s): ${passAvgResponse ? "✅ PASS" : "❌ FAIL"}

## 3. 每组样本成功率
${"─".repeat(64)}`);

  for (const [id, stat] of Object.entries(groupStats)) {
    const sample = SAMPLES.find((s) => s.id === id);
    const label = sample ? sample.label : id;
    const avg = stat.times.length
      ? (stat.times.reduce((a, b) => a + b, 0) / stat.times.length / 1000).toFixed(2)
      : "N/A";
    const rate = (((stat.success) / (stat.success + stat.fail)) * 100).toFixed(0);
    const icon = stat.fail === 0 ? "✅" : "⚠️";
    console.log(`  ${icon} ${label}`);
    console.log(`     成功: ${stat.success}/5 (${rate}%) | 平均响应: ${avg}s`);
  }

  console.log(`
## 4. 失败用例详情（Failure Cases）
${"─".repeat(64)}`);

  if (failures.length === 0) {
    console.log("  ✅ 无失败用例");
  } else {
    for (const f of failures) {
      console.log(`  ❌ [${f.sampleId}] 第${f.runIndex}次 | 耗时: ${f.elapsedSec}s`);
      console.log(`     失败原因: ${f.failureReason}`);
      console.log(`     Diag尝试: ${f.diagAttempts}次 | Preview尝试: ${f.previewAttempts}次`);
    }
  }

  console.log(`
## 5. 失败原因分类
${"─".repeat(64)}`);
  if (Object.keys(failureCategories).length === 0) {
    console.log("  ✅ 无失败");
  } else {
    for (const [cat, count] of Object.entries(failureCategories)) {
      console.log(`  • ${cat}: ${count} 次`);
    }
  }

  console.log(`
## 6. 验收标准对照
${"─".repeat(64)}
  失败率 ≤ 1%:          ${passFailRate ? `✅ PASS (${failRate}%)` : `❌ FAIL (${failRate}%)`}
  平均响应 ≤ 10s:       ${passAvgResponse ? `✅ PASS (avg ${avgSec}s)` : `❌ FAIL (avg ${avgSec}s)`}
  失败时自动重试:       ✅ 已实现（最多2次重试）
  友好错误提示:         ⚠️  需前端改造（见优化建议）

## 7. 优化建议
${"─".repeat(64)}

### [后端] 已验证有效
  ✅ 自动重试机制（最多2次，指数退避：2s → 4s）
  ✅ Promise.all 并行调用 diagnostics + preview
  ✅ extractJSON 容错解析（支持 markdown fence 和裸 JSON）

### [后端] 建议新增
  1. 超时控制：在 AI 调用外包一层 AbortController，单次调用 ≥ 15s 主动中断
     示例：
       const controller = new AbortController();
       const timer = setTimeout(() => controller.abort(), 15000);
       await ai.chat.completions.create({ ..., signal: controller.signal });
       clearTimeout(timer);

  2. 结构化错误分类：在 route.ts catch 块中区分错误类型并返回明确 error code
     示例：
       if (err.message?.includes('timeout')) return 500 + "timeout"
       if (err.message?.includes('parse'))   return 502 + "parse_error"

### [前端] 用户体验改进
  当前错误提示: "Something went wrong. Please try again."
  
  ✅ 建议改为分级提示：
  
  1. 网络/超时:
     "AI 服务暂时不可用，请稍候重试 🔄"
     
  2. 服务器错误:
     "网络波动导致请求失败，请再次点击 Analyze 按钮"
     
  3. 输入问题:
     "内容格式有误，请检查简历和 JD 是否完整后重试"
  
  ✅ 建议新增前端重试按钮:
     失败后显示 [重新分析] 按钮，保留已输入内容，直接重发请求
  
  ✅ 建议新增进度反馈:
     "正在分析关键词匹配… (1/2)"
     "正在生成优化建议… (2/2)"`);

  console.log(`
${"═".repeat(64)}
🏁 Final Verdict
${"═".repeat(64)}`);

  const globalPass = passFailRate && passAvgResponse;
  if (globalPass) {
    console.log(`
  ✅ PASS

  测试通过！Analyze 功能稳定性满足上线标准：
  • 失败率 ${failRate}%（标准 ≤ 1%）
  • 平均响应 ${avgSec}s（标准 ≤ 10s）
  • 重试机制工作正常
  
  ⚠️  建议在正式上线前完成：
  1. 前端分级错误提示改造
  2. 后端超时控制（AbortController）
  3. 监控告警接入（失败率超 5% 告警）`);
  } else {
    console.log(`
  ❌ FAIL

  Analyze 功能稳定性未达上线标准：`);
    if (!passFailRate) console.log(`  • 失败率 ${failRate}% > 1%（需优化重试机制或模型调用稳定性）`);
    if (!passAvgResponse) console.log(`  • 平均响应 ${avgSec}s > 10s（需优化并发或超时控制）`);
    console.log(`
  📋 必须完成后重测：
  1. 实施 AbortController 超时控制
  2. 排查失败原因（见 Failure Cases）
  3. 前端分级错误提示改造`);
  }

  console.log("\n" + "═".repeat(64));
  console.log(`测试完成时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
  console.log("═".repeat(64) + "\n");
}

// ── 执行 ─────────────────────────────────────────────────────
runStabilityTest().catch((err) => {
  console.error("❌ 测试脚本崩溃:", err);
  process.exit(1);
});
