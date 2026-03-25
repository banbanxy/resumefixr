import OpenAI from "openai";

// 懒加载，避免 build 时报错
let _ai: OpenAI | null = null;

export function getAI(): OpenAI {
  if (!_ai) {
    _ai = new OpenAI({
      apiKey: process.env.WENWEN_API_KEY!,
      baseURL: process.env.WENWEN_BASE_URL!,
    });
  }
  return _ai;
}

export const MODEL = () => process.env.WENWEN_MODEL || "claude-sonnet-4-6";
