-- Propostas de campanha fixa: empresa registra intenção de negociar valor fixo com influencers (taxa única de conexão)
CREATE TABLE IF NOT EXISTS public.campaign_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_proposals_company ON public.campaign_proposals(company_id);
CREATE INDEX IF NOT EXISTS idx_campaign_proposals_created ON public.campaign_proposals(created_at);

ALTER TABLE public.campaign_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company owners can insert campaign proposals for own company"
  ON public.campaign_proposals FOR INSERT
  WITH CHECK (auth.uid() = from_user_id AND public.is_company_owner(auth.uid(), company_id));

CREATE POLICY "Company owners and admins can read campaign proposals"
  ON public.campaign_proposals FOR SELECT
  USING (
    public.is_company_owner(auth.uid(), company_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );
