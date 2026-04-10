import OpenAI from "openai";

// 懒加载，避免 build 时报错
let _ai: OpenAI | null = null;

/**
 * 确保 baseURL 以 /v1 结尾。
 * OpenAI SDK 要求 baseURL 包含完整路径前缀，
 * 若环境变量只配置了域名（如 https://example.com），
 * 自动补全为 https://example.com/v1，避免请求打到 HTML 首页。
 */
function normalizeBaseURL(url: string): string {
  const cleaned = url.replace(/\/+$/, ""); // 去掉末尾斜杠
  if (cleaned.endsWith("/v1")) return cleaned;
  return cleaned + "/v1";
}

export function getAI(): OpenAI {
  if (!_ai) {
    const rawURL = process.env.WENWEN_BASE_URL!;
    _ai = new OpenAI({
      apiKey: process.env.WENWEN_API_KEY!,
      baseURL: normalizeBaseURL(rawURL),
      // ⚠️ 强制使用 Web Fetch API，避免 OpenAI SDK 在 Cloudflare Workers
      // 环境下回退到 Node.js http 模块（nodejs_compat 的 http 实现
      // 对出站 TLS 连接有限制，导致 "Connection error"）。
      // globalThis.fetch 在 Workers 里是原生 Fetch API，无此限制。
      fetch: (url, init) => globalThis.fetch(url as string, init),
    });
  }
  return _ai;
}

export const MODEL = () => process.env.WENWEN_MODEL || "claude-sonnet-4-6";
