CREATE TABLE company_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Thea-X Construction',
  address text,
  tax_id text,
  website text,
  logo text,
  currency text DEFAULT 'AED',
  theme_color text DEFAULT 'blue',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- GM users can read and write their own company settings
CREATE POLICY "Users can manage their own company settings" 
  ON company_settings 
  FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Regular users can read the company settings of their GM (assuming we'll need to link them eventually)
-- For now, we'll allow public read so invited users can see the company info
CREATE POLICY "Public read for company settings" 
  ON company_settings 
  FOR SELECT 
  USING (true);