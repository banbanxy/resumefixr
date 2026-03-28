// Cloudflare D1 数据库适配
// 生产环境：通过 request 上下文获取 D1 binding
// 本地开发：自动 fallback 到 better-sqlite3

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

// ── 本地 SQLite fallback ───────────────────────────────────────────────────
let _localDB: D1Database | null = null;

function getLocalDB(): D1Database {
  if (_localDB) return _localDB;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const db = new Database("local-dev.sqlite");

  // 初始化表结构
  db.exec(INIT_SQL);

  // 将 better-sqlite3 同步接口包装成 D1 异步接口
  function wrap(query: string, params: any[] = []): D1PreparedStatement {
    const stmt = { query, params: [...params] };
    const api: D1PreparedStatement = {
      bind(...values: any[]) {
        stmt.params = values;
        return api;
      },
      async first<T>(): Promise<T | null> {
        const s = db.prepare(stmt.query);
        return (s.get(...stmt.params) as T) ?? null;
      },
      async run(): Promise<D1Result> {
        const s = db.prepare(stmt.query);
        s.run(...stmt.params);
        return { success: true };
      },
      async all<T>(): Promise<D1Result<T>> {
        const s = db.prepare(stmt.query);
        return { results: s.all(...stmt.params) as T[], success: true };
      },
    };
    return api;
  }

  _localDB = {
    prepare: (query: string) => wrap(query),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async (query: string) => { db.exec(query); return { success: true }; },
  };

  return _localDB;
}

// ── 对外接口 ───────────────────────────────────────────────────────────────
export function getDB(request: Request): D1Database {
  // @ts-ignore - Cloudflare Workers 环境变量
  const env = (request as any).env as Env;
  if (env?.DB) return env.DB;

  // 本地开发模式：使用 SQLite
  if (process.env.NODE_ENV === "development") {
    return getLocalDB();
  }

  throw new Error("D1 database not bound. Check wrangler.toml configuration.");
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
