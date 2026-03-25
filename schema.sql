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
