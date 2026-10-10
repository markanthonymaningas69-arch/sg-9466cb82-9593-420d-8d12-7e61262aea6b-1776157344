-- Create budget_plans table
CREATE TABLE IF NOT EXISTS budget_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  total_budget numeric(15,2) NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  company_id uuid NOT NULL DEFAULT auth_company_id() REFERENCES company_settings(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create budget_categories table
CREATE TABLE IF NOT EXISTS budget_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_plan_id uuid NOT NULL REFERENCES budget_plans(id) ON DELETE CASCADE,
  category_name text NOT NULL,
  allocated_amount numeric(15,2) NOT NULL DEFAULT 0,
  company_id uuid NOT NULL DEFAULT auth_company_id() REFERENCES company_settings(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create budget_expenses table
CREATE TABLE IF NOT EXISTS budget_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_category_id uuid NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  budget_plan_id uuid NOT NULL REFERENCES budget_plans(id) ON DELETE CASCADE,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  amount numeric(15,2) NOT NULL,
  vendor text,
  receipt_number text,
  notes text,
  company_id uuid NOT NULL DEFAULT auth_company_id() REFERENCES company_settings(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE budget_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for budget_plans
CREATE POLICY "tenant_isolation_budget_plans" ON budget_plans
  FOR ALL USING (company_id = auth_company_id())
  WITH CHECK (company_id = auth_company_id());

-- RLS Policies for budget_categories
CREATE POLICY "tenant_isolation_budget_categories" ON budget_categories
  FOR ALL USING (company_id = auth_company_id())
  WITH CHECK (company_id = auth_company_id());

-- RLS Policies for budget_expenses
CREATE POLICY "tenant_isolation_budget_expenses" ON budget_expenses
  FOR ALL USING (company_id = auth_company_id())
  WITH CHECK (company_id = auth_company_id());

-- Create indexes
CREATE INDEX idx_budget_plans_project ON budget_plans(project_id);
CREATE INDEX idx_budget_plans_company ON budget_plans(company_id);
CREATE INDEX idx_budget_categories_plan ON budget_categories(budget_plan_id);
CREATE INDEX idx_budget_expenses_category ON budget_expenses(budget_category_id);
CREATE INDEX idx_budget_expenses_plan ON budget_expenses(budget_plan_id);
CREATE INDEX idx_budget_expenses_date ON budget_expenses(expense_date DESC);