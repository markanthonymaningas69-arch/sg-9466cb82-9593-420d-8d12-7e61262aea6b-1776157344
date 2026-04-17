-- This will cleanly drop the function and CASCADE automatically drops all 30+ dependent triggers across all tables
DROP FUNCTION IF EXISTS prevent_demo_writes() CASCADE;