CREATE TABLE IF NOT EXISTS accounting_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  account_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  tax_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payment', 'receipt', 'journal')),
  payee TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS liquidations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  submitted_by TEXT NOT NULL,
  advance_amount NUMERIC NOT NULL DEFAULT 0,
  actual_amount NUMERIC NOT NULL DEFAULT 0,
  purpose TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE accounting_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON accounting_transactions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON vouchers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE liquidations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON liquidations FOR ALL USING (true) WITH CHECK (true);