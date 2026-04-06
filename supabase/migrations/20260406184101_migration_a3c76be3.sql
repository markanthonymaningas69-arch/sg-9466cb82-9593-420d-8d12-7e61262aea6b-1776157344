-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  location TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  budget DECIMAL(15,2) NOT NULL,
  spent DECIMAL(15,2) DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('planning', 'active', 'on-hold', 'completed', 'cancelled')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Site Personnel table
CREATE TABLE personnel (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  hourly_rate DECIMAL(10,2),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'on-leave')),
  hire_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Accounting Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'payroll', 'materials', 'equipment')),
  category TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL,
  reference_number TEXT,
  vendor TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Warehouse Inventory table
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('materials', 'tools', 'equipment', 'safety')),
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  reorder_level INTEGER DEFAULT 10,
  location TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  last_restocked DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired')),
  start_date DATE NOT NULL,
  end_date DATE,
  amount DECIMAL(10,2) NOT NULL,
  features JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (T2 - Public read, authenticated write)
CREATE POLICY "public_read_projects" ON projects FOR SELECT USING (true);
CREATE POLICY "auth_insert_projects" ON projects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_projects" ON projects FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_projects" ON projects FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "public_read_personnel" ON personnel FOR SELECT USING (true);
CREATE POLICY "auth_insert_personnel" ON personnel FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_personnel" ON personnel FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_personnel" ON personnel FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "public_read_transactions" ON transactions FOR SELECT USING (true);
CREATE POLICY "auth_insert_transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_transactions" ON transactions FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_transactions" ON transactions FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "public_read_inventory" ON inventory FOR SELECT USING (true);
CREATE POLICY "auth_insert_inventory" ON inventory FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_inventory" ON inventory FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_inventory" ON inventory FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "public_read_subscriptions" ON subscriptions FOR SELECT USING (true);
CREATE POLICY "auth_insert_subscriptions" ON subscriptions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_subscriptions" ON subscriptions FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Insert sample data
INSERT INTO projects (name, client, location, budget, spent, status, start_date, description) VALUES
('Downtown Office Complex', 'Metro Corp', 'New York, NY', 2500000.00, 1875000.00, 'active', '2025-01-15', 'Modern 12-story office building'),
('Harbor Bridge Renovation', 'City Council', 'San Francisco, CA', 3800000.00, 950000.00, 'active', '2025-02-01', 'Historic bridge restoration'),
('Residential Tower Phase 2', 'Sunrise Developers', 'Miami, FL', 5200000.00, 260000.00, 'planning', '2025-04-01', '25-story residential complex'),
('Industrial Warehouse', 'LogiHub Inc', 'Dallas, TX', 1200000.00, 1200000.00, 'completed', '2024-06-01', 'Storage and distribution facility');

INSERT INTO personnel (name, role, email, phone, hourly_rate, status, hire_date) VALUES
('John Martinez', 'Project Manager', 'j.martinez@construction.com', '555-0101', 85.00, 'active', '2023-03-15'),
('Sarah Chen', 'Site Supervisor', 's.chen@construction.com', '555-0102', 72.50, 'active', '2023-06-20'),
('Michael Brown', 'Structural Engineer', 'm.brown@construction.com', '555-0103', 95.00, 'active', '2024-01-10'),
('Lisa Rodriguez', 'Safety Officer', 'l.rodriguez@construction.com', '555-0104', 68.00, 'active', '2024-02-28'),
('David Kim', 'Electrician', 'd.kim@construction.com', '555-0105', 62.50, 'active', '2023-09-15'),
('Emily Watson', 'Crane Operator', 'e.watson@construction.com', '555-0106', 58.00, 'on-leave', '2023-11-01');

INSERT INTO transactions (project_id, type, category, amount, description, date, vendor) VALUES
((SELECT id FROM projects WHERE name = 'Downtown Office Complex'), 'expense', 'Materials', -125000.00, 'Steel beams and structural materials', '2025-03-15', 'SteelCo Suppliers'),
((SELECT id FROM projects WHERE name = 'Downtown Office Complex'), 'expense', 'Payroll', -85000.00, 'March payroll for site crew', '2025-03-31', NULL),
((SELECT id FROM projects WHERE name = 'Harbor Bridge Renovation'), 'expense', 'Equipment', -45000.00, 'Heavy machinery rental', '2025-03-10', 'EquipRent Inc'),
((SELECT id FROM projects WHERE name = 'Downtown Office Complex'), 'income', 'Payment', 500000.00, 'Client milestone payment', '2025-03-20', 'Metro Corp'),
((SELECT id FROM projects WHERE name = 'Residential Tower Phase 2'), 'expense', 'Materials', -60000.00, 'Concrete and cement', '2025-03-25', 'BuildMart'),
((SELECT id FROM projects WHERE name = 'Harbor Bridge Renovation'), 'expense', 'Materials', -38000.00, 'Bridge cables and anchors', '2025-03-28', 'Cable Systems Ltd');

INSERT INTO inventory (name, category, quantity, unit, unit_cost, reorder_level, location) VALUES
('Portland Cement (50kg bags)', 'materials', 450, 'bags', 12.50, 100, 'Warehouse A'),
('Steel Rebar (#4)', 'materials', 2800, 'pieces', 8.75, 500, 'Warehouse A'),
('Safety Helmets', 'safety', 85, 'units', 22.00, 20, 'Site Office'),
('Power Drills', 'tools', 24, 'units', 185.00, 5, 'Tool Storage'),
('Concrete Mixer', 'equipment', 6, 'units', 3500.00, 2, 'Equipment Yard'),
('Scaffolding Sections', 'materials', 180, 'sections', 95.00, 30, 'Warehouse B'),
('Safety Harnesses', 'safety', 42, 'units', 68.00, 15, 'Site Office'),
('Circular Saws', 'tools', 15, 'units', 220.00, 3, 'Tool Storage');