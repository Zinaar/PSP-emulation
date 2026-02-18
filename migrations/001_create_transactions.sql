CREATE TABLE IF NOT EXISTS transactions (
  id                  UUID PRIMARY KEY,
  order_id            VARCHAR(255) NOT NULL,
  amount              INTEGER NOT NULL,
  currency            VARCHAR(3) NOT NULL,
  card_number         VARCHAR(20) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'CREATED',
  psp_transaction_id  VARCHAR(255),
  final_amount        INTEGER,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up transactions by PSP transaction ID (webhook processing)
CREATE INDEX IF NOT EXISTS idx_transactions_psp_id ON transactions(psp_transaction_id);
