ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_modules text[] DEFAULT '{}'::text[];
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS modules text[] DEFAULT '{}'::text[];

UPDATE profiles SET assigned_modules = ARRAY[assigned_module] WHERE assigned_module IS NOT NULL AND (assigned_modules IS NULL OR assigned_modules = '{}'::text[]);
UPDATE invite_codes SET modules = ARRAY[module] WHERE module IS NOT NULL AND (modules IS NULL OR modules = '{}'::text[]);

CREATE OR REPLACE FUNCTION public.assign_user_module(
  p_user_id uuid, 
  p_module text, 
  p_project_ids uuid[] DEFAULT '{}'::uuid[],
  p_modules text[] DEFAULT '{}'::text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, assigned_module, assigned_project_ids, assigned_modules, updated_at)
  VALUES (p_user_id, p_module, p_project_ids, p_modules, NOW())
  ON CONFLICT (id) DO UPDATE 
  SET assigned_module = EXCLUDED.assigned_module,
      assigned_project_ids = EXCLUDED.assigned_project_ids,
      assigned_modules = EXCLUDED.assigned_modules,
      updated_at = EXCLUDED.updated_at;
END;
$$;