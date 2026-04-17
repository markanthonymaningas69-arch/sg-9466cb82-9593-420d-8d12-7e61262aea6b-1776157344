DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'projects', 'personnel', 'purchases', 'vouchers', 'inventory',
        'suppliers', 'bill_of_materials', 'accounting_transactions',
        'liquidations', 'site_requests', 'deliveries', 'cash_advance_requests',
        'payroll', 'leave_requests', 'site_attendance', 'material_consumption',
        'bom_scope_of_work', 'bom_materials', 'bom_labor', 'bom_indirect_costs',
        'bom_progress_updates', 'personnel_visas'
    ];
    master_tables text[] := ARRAY['master_items', 'master_scopes'];
    pol record;
BEGIN
    -- 1. Helper function to securely get the current user's company_id
    CREATE OR REPLACE FUNCTION public.auth_company_id()
    RETURNS uuid AS $func$
      SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
    $func$ LANGUAGE sql STABLE SECURITY DEFINER;

    -- 2. Trigger function to automatically stamp company_id on new rows
    CREATE OR REPLACE FUNCTION public.trigger_set_company_id()
    RETURNS trigger AS $func$
    BEGIN
        IF NEW.company_id IS NULL THEN
            NEW.company_id := public.auth_company_id();
        END IF;
        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 3. Apply strict multi-tenant isolation to all operational tables
    FOREACH t IN ARRAY tables
    LOOP
        -- Add the tracking column
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_settings(id) ON DELETE CASCADE;', t);
        
        -- Backfill any existing records to the first available company so they don't disappear
        EXECUTE format('UPDATE public.%I SET company_id = (SELECT id FROM public.company_settings LIMIT 1) WHERE company_id IS NULL;', t);

        -- Attach the auto-stamping trigger
        EXECUTE format('DROP TRIGGER IF EXISTS ensure_company_id ON public.%I;', t);
        EXECUTE format('CREATE TRIGGER ensure_company_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trigger_set_company_id();', t);

        -- Enable Row Level Security
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

        -- Drop old insecure policies
        FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, t);
        END LOOP;

        -- Create the definitive strict Multi-Tenant isolation policy
        EXECUTE format('CREATE POLICY "tenant_isolation" ON public.%I FOR ALL USING (company_id = public.auth_company_id()) WITH CHECK (company_id = public.auth_company_id());', t);
    END LOOP;

    -- 4. Apply to master templates (allows users to read global presets, but writes are isolated to their company)
    FOREACH t IN ARRAY master_tables
    LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_settings(id) ON DELETE CASCADE;', t);
        
        EXECUTE format('DROP TRIGGER IF EXISTS ensure_company_id ON public.%I;', t);
        EXECUTE format('CREATE TRIGGER ensure_company_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trigger_set_company_id();', t);

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

        FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, t);
        END LOOP;

        -- Global reads allowed for predefined master catalogs
        EXECUTE format('CREATE POLICY "tenant_isolation" ON public.%I FOR ALL USING (company_id = public.auth_company_id() OR company_id IS NULL) WITH CHECK (company_id = public.auth_company_id());', t);
    END LOOP;
    
    -- 5. Secure Company Settings
    DROP POLICY IF EXISTS "anon_all_company_settings" ON public.company_settings;
    CREATE POLICY "tenant_isolation_company" ON public.company_settings FOR ALL USING (id = public.auth_company_id() OR user_id = auth.uid());
    
    -- 6. Secure Profiles visibility (Users can only see coworkers in their own company)
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
    CREATE POLICY "tenant_isolation_profiles_select" ON public.profiles FOR SELECT USING (company_id = public.auth_company_id() OR id = auth.uid());
    
    -- 7. Secure Invite Codes
    DROP POLICY IF EXISTS "Allow all invite_codes" ON public.invite_codes;
    CREATE POLICY "tenant_isolation_invites" ON public.invite_codes FOR ALL USING (company_id = public.auth_company_id() OR company_id IS NULL);
    
END $$;