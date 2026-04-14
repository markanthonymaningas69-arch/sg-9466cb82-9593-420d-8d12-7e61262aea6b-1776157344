-- Add array columns for multiple project assignments
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_project_ids UUID[] DEFAULT '{}';
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS project_ids UUID[] DEFAULT '{}';

-- Update the RPC function to handle arrays
CREATE OR REPLACE FUNCTION assign_user_module(p_user_id uuid, p_module text, p_project_ids uuid[] DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, assigned_module, assigned_project_ids, updated_at)
  VALUES (p_user_id, p_module, p_project_ids, now())
  ON CONFLICT (id) DO UPDATE
  SET assigned_module = EXCLUDED.assigned_module,
      assigned_project_ids = COALESCE(EXCLUDED.assigned_project_ids, profiles.assigned_project_ids),
      updated_at = EXCLUDED.updated_at;
END;
$$;