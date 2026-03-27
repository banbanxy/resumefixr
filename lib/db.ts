// Cloudflare D1 数据库适配
// 在 Cloudflare Pages 环境中，通过 request 上下文获取 D1 binding

// 最小 D1 类型定义（避免引入完整 @cloudflare/workers-types）
interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = any>(): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = any>(): Promise<D1Result<T>>;
}

interface D1Result<T = any> {
  results?: T[];
  success: boolean;
  meta?: any;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = any>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
}

export interface Env {
  DB: D1Database;
}

export function getDB(request: Request): D1Database {
  // @ts-ignore - Cloudflare Workers 环境变量
  const env = (request as any).env as Env;
  if (!env?.DB) {
    throw new Error("D1 database not bound. Check wrangler.toml configuration.");
  }
  return env.DB;
}

// 初始化数据库表结构（需要在 D1 控制台或 wrangler 中执行）
export const INIT_SQL = `
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  resume_text TEXT NOT NULL,
  job_description TEXT NOT NULL,
  diagnostics TEXT,
  preview_examples TEXT,
  is_paid INTEGER DEFAULT 0,
  paypal_txn_id TEXT,
  amount_paid REAL,
  full_suggestions TEXT,
  email TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_paypal_txn ON submissions(paypal_txn_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON submissions(created_at);
`;
