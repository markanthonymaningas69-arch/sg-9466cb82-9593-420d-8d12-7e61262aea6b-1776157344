-- Fix personnel policies to allow anonymous operations
DROP POLICY IF EXISTS "auth_insert_personnel" ON personnel;
DROP POLICY IF EXISTS "auth_update_personnel" ON personnel;
DROP POLICY IF EXISTS "auth_delete_personnel" ON personnel;

CREATE POLICY "anon_insert" ON personnel FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON personnel FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON personnel FOR DELETE USING (true);

-- Create comprehensive HR tables
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  hours_worked NUMERIC(5,2) DEFAULT 0,
  overtime_hours NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half-day', 'on-leave')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('sick', 'vacation', 'personal', 'emergency', 'unpaid')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT,
  approved_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  certification_name TEXT NOT NULL,
  issuing_organization TEXT,
  issue_date DATE,
  expiry_date DATE,
  certificate_number TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended')),
  document_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  regular_hours NUMERIC(10,2) DEFAULT 0,
  overtime_hours NUMERIC(10,2) DEFAULT 0,
  hourly_rate NUMERIC(10,2) NOT NULL,
  gross_pay NUMERIC(15,2) NOT NULL,
  deductions NUMERIC(15,2) DEFAULT 0,
  net_pay NUMERIC(15,2) NOT NULL,
  payment_date DATE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'check', 'bank-transfer', 'mobile-money')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'paid')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  training_title TEXT NOT NULL,
  training_type TEXT CHECK (training_type IN ('safety', 'technical', 'management', 'compliance', 'other')),
  trainer TEXT,
  training_date DATE NOT NULL,
  duration_hours NUMERIC(5,2),
  completion_status TEXT NOT NULL DEFAULT 'scheduled' CHECK (completion_status IN ('scheduled', 'completed', 'cancelled', 'failed')),
  score NUMERIC(5,2),
  certificate_issued BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for new tables
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;

-- Public read, anonymous write policies for all HR tables
CREATE POLICY "public_read" ON attendance FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON attendance FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON attendance FOR DELETE USING (true);

CREATE POLICY "public_read" ON leave_requests FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON leave_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON leave_requests FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON leave_requests FOR DELETE USING (true);

CREATE POLICY "public_read" ON certifications FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON certifications FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON certifications FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON certifications FOR DELETE USING (true);

CREATE POLICY "public_read" ON payroll FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON payroll FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON payroll FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON payroll FOR DELETE USING (true);

CREATE POLICY "public_read" ON training_records FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON training_records FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON training_records FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON training_records FOR DELETE USING (true);

-- Add indexes for better performance
CREATE INDEX idx_attendance_personnel ON attendance(personnel_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_leave_personnel ON leave_requests(personnel_id);
CREATE INDEX idx_leave_status ON leave_requests(status);
CREATE INDEX idx_cert_personnel ON certifications(personnel_id);
CREATE INDEX idx_payroll_personnel ON payroll(personnel_id);
CREATE INDEX idx_training_personnel ON training_records(personnel_id);