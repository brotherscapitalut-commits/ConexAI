-- Saldo de créditos da empresa para pagar influencers (custo por clique / campanhas)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS influencer_credits_balance numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.companies.influencer_credits_balance IS 'Saldo em R$ para comissões de influencers (cliques e campanhas fixas).';

-- Receitas da plataforma: 30% de cada interação (70% vai para o influencer)
CREATE TABLE IF NOT EXISTS public.platform_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  interaction_id uuid REFERENCES public.interactions(id) ON DELETE SET NULL,
  amount_platform numeric NOT NULL DEFAULT 0,
  amount_influencer numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_revenue_company ON public.platform_revenue(company_id);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_user ON public.platform_revenue(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_created ON public.platform_revenue(created_at);

ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read platform_revenue"
  ON public.platform_revenue FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert platform_revenue"
  ON public.platform_revenue FOR INSERT
  WITH CHECK (true);

-- Influencers podem ler suas próprias linhas (total gerado)
CREATE POLICY "Users can read own platform_revenue"
  ON public.platform_revenue FOR SELECT
  USING (auth.uid() = user_id);

-- Valor por clique em R$ (empresa paga; 70% influencer, 30% plataforma)
-- Trigger: a cada nova interaction, registra a fatia da plataforma e do influencer
CREATE OR REPLACE FUNCTION public.on_interaction_record_revenue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  valor_clique numeric := 0.5;
  parte_influencer numeric := valor_clique * 0.7;
  parte_plataforma numeric := valor_clique * 0.3;
BEGIN
  INSERT INTO public.platform_revenue (company_id, user_id, interaction_id, amount_platform, amount_influencer)
  VALUES (NEW.company_id, NEW.user_id, NEW.id, parte_plataforma, parte_influencer);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_interaction_revenue ON public.interactions;
CREATE TRIGGER trigger_interaction_revenue
  AFTER INSERT ON public.interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_interaction_record_revenue();

-- Ranking de influencers por Total Gerado (para empresas verem os parceiros mais valiosos)
CREATE OR REPLACE FUNCTION public.get_influencer_ranking(limit_count int DEFAULT 10)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  total_generated numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.user_id,
    COALESCE(p.display_name, 'Influencer')::text AS display_name,
    COALESCE(SUM(pr.amount_influencer), 0)::numeric AS total_generated
  FROM public.platform_revenue pr
  LEFT JOIN public.profiles p ON p.user_id = pr.user_id
  WHERE pr.user_id IS NOT NULL
  GROUP BY pr.user_id, p.display_name
  ORDER BY total_generated DESC
  LIMIT limit_count;
END;
$$;
