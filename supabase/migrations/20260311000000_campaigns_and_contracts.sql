-- Campanhas: valor fixo depositado e congelado até conclusão
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',           -- rascunho
    'collecting_interest', -- empresa adiciona influencers à lista, sem cobrança
    'funded',          -- valor depositado e congelado
    'active',          -- em execução
    'completed',       -- concluída
    'cancelled'
  )),
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_company ON public.campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON public.campaigns(owner_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company owners can manage own campaigns"
  ON public.campaigns FOR ALL
  USING (auth.uid() = owner_id);

-- Lista de interesse: influencers adicionados à campanha (antes de qualquer cobrança)
CREATE TABLE IF NOT EXISTS public.campaign_influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, influencer_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_influencers_campaign ON public.campaign_influencers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_influencers_influencer ON public.campaign_influencers(influencer_id);

ALTER TABLE public.campaign_influencers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campaign owners can manage campaign_influencers"
  ON public.campaign_influencers FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.owner_id = auth.uid())
  );

CREATE POLICY "Influencers can view own campaign_influencers"
  ON public.campaign_influencers FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.influencers i WHERE i.id = influencer_id AND i.owner_id = auth.uid())
  );

COMMENT ON TABLE public.campaigns IS 'Campanhas com valor fixo; depósito fica congelado até conclusão.';
COMMENT ON TABLE public.campaign_influencers IS 'Lista de interesse: influencers na campanha (sem cobrança até depósito).';
