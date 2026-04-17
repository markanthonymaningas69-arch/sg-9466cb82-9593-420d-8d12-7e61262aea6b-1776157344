-- Create Trigger to block modifications for the demo user
CREATE OR REPLACE FUNCTION prevent_demo_writes() RETURNS trigger AS $BODY$
DECLARE
    v_email text;
BEGIN
    BEGIN
        v_email := current_setting('request.jwt.claims', true)::json->>'email';
    EXCEPTION WHEN OTHERS THEN
        v_email := NULL;
    END;
    
    IF v_email = 'demo@thea-x.com' THEN
        RAISE EXCEPTION 'Demo Mode Activated: Read-only access. Modifications are disabled for the demo environment.';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$BODY$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to all tables
DO $T$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_prevent_demo_writes ON %I', t);
        EXECUTE format('CREATE TRIGGER trg_prevent_demo_writes BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_demo_writes()', t);
    END LOOP;
END $T$;