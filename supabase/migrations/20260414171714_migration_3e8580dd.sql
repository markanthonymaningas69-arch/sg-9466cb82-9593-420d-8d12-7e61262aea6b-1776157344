ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

DROP FUNCTION IF EXISTS assign_user_module(uuid, text);

CREATE OR REPLACE FUNCTION assign_user_module(p_user_id uuid, p_module text, p_project_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, assigned_module, assigned_project_id, updated_at)
  VALUES (p_user_id, p_module, p_project_id, now())
  ON CONFLICT (id) DO UPDATE
  SET assigned_module = EXCLUDED.assigned_module,
      assigned_project_id = COALESCE(EXCLUDED.assigned_project_id, profiles.assigned_project_id),
      updated_at = EXCLUDED.updated_at;
END;
$$;