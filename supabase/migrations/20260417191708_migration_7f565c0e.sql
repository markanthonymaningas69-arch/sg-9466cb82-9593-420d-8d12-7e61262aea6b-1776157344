DO $$
DECLARE
    v_user_id uuid := 'd0000000-0000-0000-0000-000000000000';
    v_comp_id uuid := 'd0000000-0000-0000-0000-000000000002';
    v_proj_id uuid := 'd0000000-0000-0000-0000-000000000001';
    v_bom_id uuid := 'd0000000-0000-0000-0000-000000000003';
BEGIN
    -- Enable pgcrypto for password hashing
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    -- 1. Create Auth User FIRST (to satisfy foreign key)
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'demo@thea-x.com', crypt('Demo1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo GM"}', now(), now(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, id)
    VALUES (v_user_id, v_user_id, format('{"sub":"%s","email":"%s"}', v_user_id, 'demo@thea-x.com')::jsonb, 'email', now(), now(), gen_random_uuid())
    ON CONFLICT (provider_id, provider) DO NOTHING;

    -- 2. Create or Update Profile
    INSERT INTO public.profiles (id, email, full_name, assigned_module)
    VALUES (v_user_id, 'demo@thea-x.com', 'Demo GM', 'GM')
    ON CONFLICT (id) DO UPDATE SET full_name = 'Demo GM', assigned_module = 'GM';

    -- 3. Create Company Settings
    INSERT INTO public.company_settings (id, user_id, name, currency, theme_color)
    VALUES (v_comp_id, v_user_id, 'G+1 Villa Construction LLC', 'AED', 'blue')
    ON CONFLICT (id) DO UPDATE SET name = 'G+1 Villa Construction LLC';

    -- 4. Link Profile to Company
    UPDATE public.profiles SET company_id = v_comp_id WHERE id = v_user_id;

    -- 5. Delete existing project to prevent duplicate errors
    DELETE FROM public.projects WHERE id = v_proj_id;

    -- 6. Insert Project
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'company_id') THEN
        INSERT INTO public.projects (id, name, client, location, start_date, end_date, budget, spent, status, company_id)
        VALUES (v_proj_id, 'G+1 Villa Sample Project', 'Emaar Properties', 'Internet City, Dubai, UAE', '2026-02-01', '2026-04-30', 2500000, 1875000, 'active', v_comp_id);
    ELSE
        INSERT INTO public.projects (id, name, client, location, start_date, end_date, budget, spent, status)
        VALUES (v_proj_id, 'G+1 Villa Sample Project', 'Emaar Properties', 'Internet City, Dubai, UAE', '2026-02-01', '2026-04-30', 2500000, 1875000, 'active');
    END IF;

    -- 7. BOM
    DELETE FROM public.bill_of_materials WHERE project_id = v_proj_id;
    INSERT INTO public.bill_of_materials (id, project_id, bom_number, title, status, total_direct_cost, grand_total)
    VALUES (v_bom_id, v_proj_id, 'BOM-2026-001', 'Master BOM for G+1 Villa', 'approved', 2000000, 2500000);

    -- 8. Scopes
    DELETE FROM public.bom_scope_of_work WHERE bom_id = v_bom_id;
    INSERT INTO public.bom_scope_of_work (id, bom_id, name, order_number, completion_percentage, status, subtotal) VALUES
    ('d0000000-0000-0000-0000-000000000010', v_bom_id, 'Mobilization & Site Prep', 1, 100, 'completed', 50000),
    ('d0000000-0000-0000-0000-000000000011', v_bom_id, 'Earthworks & Excavation', 2, 100, 'completed', 150000),
    ('d0000000-0000-0000-0000-000000000012', v_bom_id, 'Structural Works (Concrete & Steel)', 3, 100, 'completed', 800000),
    ('d0000000-0000-0000-0000-000000000013', v_bom_id, 'Masonry & Blockworks', 4, 80, 'in_progress', 300000),
    ('d0000000-0000-0000-0000-000000000014', v_bom_id, 'MEP (Mechanical, Electrical, Plumbing)', 5, 50, 'in_progress', 400000),
    ('d0000000-0000-0000-0000-000000000015', v_bom_id, 'Finishing & Painting', 6, 10, 'in_progress', 300000);

    -- 9. Personnel
    DELETE FROM public.personnel WHERE project_id = v_proj_id;
    INSERT INTO public.personnel (id, name, role, email, status, hire_date, daily_rate, project_id) VALUES
    ('d0000000-0000-0000-0000-000000000020', 'Ahmed Hassan', 'Project Manager', 'ahmed@demo.com', 'active', '2026-01-15', 500, v_proj_id),
    ('d0000000-0000-0000-0000-000000000021', 'John Davis', 'Site Engineer', 'john@demo.com', 'active', '2026-01-20', 300, v_proj_id),
    ('d0000000-0000-0000-0000-000000000022', 'Ravi Kumar', 'Foreman', 'ravi@demo.com', 'active', '2026-01-25', 150, v_proj_id),
    ('d0000000-0000-0000-0000-000000000023', 'Mohammed Ali', 'Mason', 'm.ali@demo.com', 'active', '2026-02-01', 100, v_proj_id),
    ('d0000000-0000-0000-0000-000000000024', 'Suresh Patel', 'Electrician', 'suresh@demo.com', 'active', '2026-02-15', 120, v_proj_id);

    -- 10. Vouchers
    DELETE FROM public.vouchers WHERE project_id = v_proj_id;
    INSERT INTO public.vouchers (voucher_number, date, type, payee, amount, description, status, project_id) VALUES
    ('PV-2026-001', '2026-02-10', 'payment', 'Emirates Steel', 250000, 'Steel Rebars Payment', 'approved', v_proj_id),
    ('PV-2026-002', '2026-03-05', 'payment', 'Cemex Concrete', 180000, 'Ready-mix Concrete Batch', 'approved', v_proj_id),
    ('RV-2026-001', '2026-02-01', 'receipt', 'Emaar Properties', 500000, 'Mobilization Advance Payment', 'approved', v_proj_id);

    -- 11. Accounting Transactions
    DELETE FROM public.accounting_transactions WHERE project_id = v_proj_id;
    INSERT INTO public.accounting_transactions (project_id, date, description, account_name, type, category, amount) VALUES
    (v_proj_id, '2026-02-01', 'Advance Payment', 'Cash in Bank', 'credit', 'Revenue', 500000),
    (v_proj_id, '2026-02-10', 'Steel Purchase', 'Materials', 'debit', 'COGS', 250000),
    (v_proj_id, '2026-03-05', 'Concrete Delivery', 'Materials', 'debit', 'COGS', 180000);

    -- 12. Inventory
    DELETE FROM public.inventory WHERE project_id = v_proj_id;
    INSERT INTO public.inventory (name, category, quantity, unit, unit_cost, project_id) VALUES
    ('Portland Cement', 'Materials', 500, 'bags', 25, v_proj_id),
    ('Steel Rebars 12mm', 'Materials', 2000, 'kg', 3, v_proj_id),
    ('Ceramic Tiles 60x60', 'Finishes', 1000, 'sqm', 45, v_proj_id);

    -- 13. Purchases
    DELETE FROM public.purchases WHERE project_id = v_proj_id;
    INSERT INTO public.purchases (order_number, supplier, item_name, category, quantity, unit, unit_cost, destination_type, project_id, status) VALUES
    ('PO-2026-001', 'Emirates Steel', 'Steel Rebars 12mm', 'Materials', 10000, 'kg', 3, 'project_warehouse', v_proj_id, 'received'),
    ('PO-2026-002', 'Cemex', 'Ready-mix Concrete', 'Materials', 500, 'cbm', 350, 'project_warehouse', v_proj_id, 'received');

END $$;