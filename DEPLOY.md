# 部署说明 - 修复 522 错误

## 问题根因
使用了 `better-sqlite3`（Node.js 原生模块），Cloudflare Workers 不支持。

## 已完成的修复
✅ 移除 `better-sqlite3` 依赖
✅ 改用 Cloudflare D1 数据库
✅ 更新所有 API 路由

## 部署前必须执行的步骤

### 1. 创建 D1 数据库

```bash
# 登录 Cloudflare
npx wrangler login

# 创建 D1 数据库
npx wrangler d1 create resumefixr
```

输出示例：
```
✅ Successfully created DB 'resumefixr'
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. 更新 wrangler.toml

将输出的 `database_id` 替换到 `wrangler.toml` 第 9 行：

```toml
[[d1_databases]]
binding = "DB"
database_name = "resumefixr"
database_id = "你的实际database_id"  # 替换这里
```

### 3. 初始化数据库表结构

```bash
npx wrangler d1 execute resumefixr --remote --command "
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
"
```

### 4. 重新安装依赖

```bash
npm install
```

### 5. 构建并部署

```bash
npm run build
npx @cloudflare/next-on-pages
```

### 6. 推送到 Git

```bash
git add .
git commit -m "fix: replace better-sqlite3 with Cloudflare D1 to resolve 522 error"
git push
```

## 验证步骤

部署后：

1. 访问首页：`https://your-domain.com`
   - 预期：看到表单（不是 522）

2. 测试分析功能：
   - 填写简历和职位描述
   - 点击 "Analyze My Resume"
   - 预期：跳转到结果页（不是 522）

3. 检查 Cloudflare Pages 日志：
   - 登录 Cloudflare Dashboard
   - Pages → resumefixr → Logs
   - 确认无错误

## 如果仍然 522

检查 Cloudflare Pages 环境变量是否配置：
- `WENWEN_API_KEY`
- `WENWEN_BASE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_PAYPAL_EMAIL`
- `NEXT_PUBLIC_SITE_URL`
