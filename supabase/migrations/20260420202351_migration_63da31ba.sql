DROP FUNCTION IF EXISTS public.get_super_admin_addon_users();

CREATE OR REPLACE FUNCTION public.get_super_admin_addon_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_users jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', p.email,
      'is_addon', p.is_addon,
      'company_id', p.company_id,
      'company_name', cs.name,
      'assigned_module', p.assigned_module,
      'assigned_modules', p.assigned_modules,
      'start_date', p.subscription_start_date,
      'end_date', p.subscription_end_date,
      'gm_plan', s.plan,
      'gm_billing_cycle', CASE WHEN s.amount > 1000 THEN 'annual' ELSE 'monthly' END
    )
  ), '[]'::jsonb)
  INTO v_users
  FROM profiles p
  JOIN company_settings cs ON cs.id = p.company_id
  JOIN profiles gm ON gm.id = cs.user_id
  LEFT JOIN (
    SELECT DISTINCT ON (user_id) user_id, plan, amount
    FROM subscriptions
    ORDER BY user_id, created_at DESC
  ) s ON s.user_id = gm.id
  WHERE p.id != gm.id;

  RETURN v_users;
END;
$function$;