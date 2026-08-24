-- Descrição, link, anexos e visibilidade da campanha (valor fixo)
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS campaign_link text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS attachment_urls jsonb NOT NULL DEFAULT '[]';

COMMENT ON COLUMN public.campaigns.description IS 'Breve descrição da campanha para os influenciadores.';
COMMENT ON COLUMN public.campaigns.campaign_link IS 'Link da campanha para enviar aos influenciadores (acesso às informações).';
COMMENT ON COLUMN public.campaigns.is_public IS 'Se true, influenciadores podem ver detalhes; se false, só o dono e admin.';
COMMENT ON COLUMN public.campaigns.attachment_urls IS 'URLs de anexos (PDF, imagens) em formato JSON array de strings.';
