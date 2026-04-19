ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_start_date date;

CREATE OR REPLACE FUNCTION get_super_admin_addon_users()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', p.email,
      'assigned_module', p.assigned_module,
      'assigned_modules', p.assigned_modules,
      'company_name', c.name,
      'company_id', c.id,
      'start_date', COALESCE(p.subscription_start_date, p.created_at::date),
      'end_date', p.subscription_end_date,
      'gm_plan', (SELECT plan FROM subscriptions s WHERE s.user_id = c.user_id AND status IN ('active', 'trialing') ORDER BY created_at DESC LIMIT 1),
      'gm_billing_cycle', (SELECT CASE WHEN amount > 1000 THEN 'annual' ELSE 'monthly' END FROM subscriptions s WHERE s.user_id = c.user_id AND status IN ('active', 'trialing') ORDER BY created_at DESC LIMIT 1)
    )
  )
  INTO result
  FROM profiles p
  JOIN company_settings c ON p.company_id = c.id
  WHERE p.assigned_module != 'GM' AND p.assigned_module IS NOT NULL;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_addon_user_dates(
  p_profile_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET 
    subscription_start_date = p_start_date,
    subscription_end_date = p_end_date
  WHERE id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;