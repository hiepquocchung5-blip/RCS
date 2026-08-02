CREATE TABLE stock_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_email TEXT NOT NULL,
  shares_count NUMERIC NOT NULL DEFAULT 0,
  price_per_share NUMERIC NOT NULL DEFAULT 32000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('income', 'outcome', 'expense')),
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial shares for founders
INSERT INTO stock_shares (founder_email, shares_count, price_per_share) VALUES
  ('filip@risecorestudio.com', 5, 32000),
  ('shayy@risecorestudio.com', 2, 32000),
  ('paihtookhant@risecorestudio.com', 1, 32000);
