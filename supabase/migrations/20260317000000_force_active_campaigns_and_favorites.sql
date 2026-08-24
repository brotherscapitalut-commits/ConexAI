-- Migração forçada: garante active_campaigns e favorite_influencers (elimina erro de imagens/tabelas)
-- Execute: npx supabase db push  ou  npx supabase migration up

-- 1) active_campaigns (id, company_id, title, description, budget_per_influencer, slots_available, created_at)
CREATE TABLE IF NOT EXISTS public.active_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  budget_per_influencer numeric NOT NULL CHECK (budget_per_influencer >= 0),
  slots_available integer NOT NULL CHECK (slots_available > 0) DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_active_campaigns_company ON public.active_campaigns(company_id);

ALTER TABLE public.active_campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'active_campaigns' AND policyname = 'Company can manage own active_campaigns') THEN
    CREATE POLICY "Company can manage own active_campaigns" ON public.active_campaigns FOR ALL USING (public.is_company_owner(auth.uid(), company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'active_campaigns' AND policyname = 'Anyone can read active_campaigns (listagem)') THEN
    CREATE POLICY "Anyone can read active_campaigns (listagem)" ON public.active_campaigns FOR SELECT USING (true);
  END IF;
END $$;

-- 2) favorite_influencers (company_id, influencer_id)
CREATE TABLE IF NOT EXISTS public.favorite_influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, influencer_id)
);

CREATE INDEX IF NOT EXISTS idx_favorite_influencers_company ON public.favorite_influencers(company_id);

ALTER TABLE public.favorite_influencers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'favorite_influencers' AND policyname = 'Company can manage own favorite_influencers') THEN
    CREATE POLICY "Company can manage own favorite_influencers" ON public.favorite_influencers FOR ALL USING (public.is_company_owner(auth.uid(), company_id));
  END IF;
END $$;
