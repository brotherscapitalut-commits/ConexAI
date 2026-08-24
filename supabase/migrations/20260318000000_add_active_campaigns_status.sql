-- Status em active_campaigns: ativas (tela inicial), rascunho, lixeira
ALTER TABLE public.active_campaigns
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'draft', 'trashed'));

COMMENT ON COLUMN public.active_campaigns.status IS 'active = visível na tela inicial; draft = rascunho; trashed = na lixeira.';
