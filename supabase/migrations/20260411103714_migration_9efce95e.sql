ALTER TABLE bom_scope_of_work ADD COLUMN IF NOT EXISTS completion_percentage numeric(5,2) DEFAULT 0;
ALTER TABLE bom_scope_of_work ADD COLUMN IF NOT EXISTS status text DEFAULT 'not_started';

ALTER TABLE progress_updates ADD COLUMN IF NOT EXISTS bom_scope_id uuid REFERENCES bom_scope_of_work(id) ON DELETE CASCADE;
ALTER TABLE progress_updates ADD COLUMN IF NOT EXISTS percentage_completed numeric(5,2);