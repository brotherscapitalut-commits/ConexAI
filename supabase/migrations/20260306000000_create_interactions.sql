-- Tabela interactions: registro de cliques em blocos (tráfego para Admin)
CREATE TABLE IF NOT EXISTS public.interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  block_x integer,
  block_y integer,
  source text NOT NULL DEFAULT 'mural',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert interactions"
  ON public.interactions FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins and service can read interactions"
  ON public.interactions FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE INDEX idx_interactions_company ON public.interactions(company_id);
CREATE INDEX idx_interactions_created ON public.interactions(created_at);
