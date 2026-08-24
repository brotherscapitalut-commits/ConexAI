-- Lista de influencers salvos pelo anunciante (para oferta direta inteligente)
CREATE TABLE IF NOT EXISTS public.favorite_influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, influencer_id)
);

CREATE INDEX IF NOT EXISTS idx_favorite_influencers_company ON public.favorite_influencers(company_id);

ALTER TABLE public.favorite_influencers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company can manage own favorite_influencers"
  ON public.favorite_influencers FOR ALL
  USING (public.is_company_owner(auth.uid(), company_id));
