-- Add indexes on blocks table for efficient coordinate-based queries
CREATE INDEX IF NOT EXISTS idx_blocks_xy ON public.blocks (x, y);
CREATE INDEX IF NOT EXISTS idx_blocks_company_status ON public.blocks (company_id, status);
CREATE INDEX IF NOT EXISTS idx_blocks_region_status ON public.blocks (region, status);