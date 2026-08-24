-- Adiciona coluna briefing em partnership_proposals para regras da campanha / briefing da empresa
ALTER TABLE public.partnership_proposals
  ADD COLUMN IF NOT EXISTS briefing text;

COMMENT ON COLUMN public.partnership_proposals.briefing IS 'Regras da campanha / briefing escrito pela empresa ao sugerir valor ou responder ao influencer.';
