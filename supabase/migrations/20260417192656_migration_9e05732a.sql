-- Replace trigger to ensure it only blocks authenticated API requests, not backend script
CREATE OR REPLACE FUNCTION prevent_demo_writes()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        IF (SELECT email FROM auth.users WHERE id = auth.uid()) = 'demo@thea-x.com' THEN
            RAISE EXCEPTION 'Demo Mode: Modifications are restricted.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS restrict_demo_user ON %I', t);
        EXECUTE format('CREATE TRIGGER restrict_demo_user BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_demo_writes()', t);
    END LOOP;
END $$;