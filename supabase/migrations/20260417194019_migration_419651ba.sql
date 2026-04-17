-- Delete scopes and BOM
DELETE FROM bom_scope_of_work WHERE bom_id IN (SELECT id FROM bill_of_materials WHERE project_id = 'd0000000-0000-0000-0000-000000000001');
DELETE FROM bill_of_materials WHERE project_id = 'd0000000-0000-0000-0000-000000000001';

-- Delete personnel and attendance
DELETE FROM site_attendance WHERE personnel_id IN (SELECT id FROM personnel WHERE project_id = 'd0000000-0000-0000-0000-000000000001');
DELETE FROM personnel WHERE project_id = 'd0000000-0000-0000-0000-000000000001';

-- Delete accounting, warehouse, purchasing
DELETE FROM purchases WHERE project_id = 'd0000000-0000-0000-0000-000000000001';
DELETE FROM vouchers WHERE project_id = 'd0000000-0000-0000-0000-000000000001';
DELETE FROM inventory WHERE project_id = 'd0000000-0000-0000-0000-000000000001';

-- Delete the project
DELETE FROM projects WHERE id = 'd0000000-0000-0000-0000-000000000001';

-- Detach and delete the demo user and company
UPDATE profiles SET company_id = NULL WHERE id = 'd0000000-0000-0000-0000-000000000000';
DELETE FROM company_settings WHERE user_id = 'd0000000-0000-0000-0000-000000000000';
DELETE FROM profiles WHERE id = 'd0000000-0000-0000-0000-000000000000';
DELETE FROM auth.identities WHERE user_id = 'd0000000-0000-0000-0000-000000000000';
DELETE FROM auth.users WHERE id = 'd0000000-0000-0000-0000-000000000000';

-- Confirm the trigger is gone
DROP FUNCTION IF EXISTS prevent_demo_writes() CASCADE;