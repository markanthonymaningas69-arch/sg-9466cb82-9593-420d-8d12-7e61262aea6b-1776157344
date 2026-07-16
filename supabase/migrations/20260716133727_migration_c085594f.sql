-- Add unit_cost column to material_consumption table if it doesn't exist
ALTER TABLE material_consumption 
ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10, 2);