-- =============================================================================
-- Suíte Admin: tabelas para finanças, saúde do sistema e histórico de IA
-- Executável standalone ou após rebuild_supabase_schema.sql
-- =============================================================================

-- View de inventário do mural (coordenadas ocupadas) para o grid
DROP VIEW IF EXISTS public.mural_inventory;
CREATE VIEW public.mural_inventory AS
  SELECT x, y, company_id FROM public.blocks WHERE status = 'occupied';

-- Preferência: avisos de lances por e-mail (default sim)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_notify_bids boolean NOT NULL DEFAULT true;

-- Receita real da plataforma (taxas, transações)
CREATE TABLE IF NOT EXISTS public.platform_finances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL,
  amount numeric NOT NULL,
  fee_collected numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_finances_created ON public.platform_finances(created_at);
CREATE INDEX IF NOT EXISTS idx_platform_finances_status ON public.platform_finances(status);

-- Equipe administrativa (gestão de admins da ConeXai)
CREATE TABLE IF NOT EXISTS public.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(LOWER(TRIM(email)));

-- Propostas de parceria (company ↔ influencer)
CREATE TABLE IF NOT EXISTS public.partnership_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  influencer_id uuid NULL REFERENCES public.influencers(id) ON DELETE SET NULL,
  to_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  description text NULL,
  delivery_link text NULL,
  suggested_amount numeric NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','counter_offer','accepted','under_review','paid','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NULL
);
CREATE INDEX IF NOT EXISTS idx_partnership_proposals_to_company ON public.partnership_proposals(to_company_id);
CREATE INDEX IF NOT EXISTS idx_partnership_proposals_from_user ON public.partnership_proposals(from_user_id);

-- Logs de saúde da API (monitoramento porta 3001)
CREATE TABLE IF NOT EXISTS public.system_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL DEFAULT 'api',
  status text NOT NULL CHECK (status IN ('ok', 'degraded', 'error')),
  latency integer,
  error_message text,
  page_path text,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email text,
  "timestamp" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_system_health_logs_timestamp ON public.system_health_logs("timestamp");

-- Configurações admin (ex.: modo manutenção)
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT ''
);
INSERT INTO public.admin_settings (key, value) VALUES ('maintenance_mode', 'false')
  ON CONFLICT (key) DO NOTHING;

-- Histórico de sugestões de IA (curadoria matchmaking)
CREATE TABLE IF NOT EXISTS public.ai_matchmaking_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.active_campaigns(id) ON DELETE SET NULL,
  suggested_influencers_ids jsonb NOT NULL DEFAULT '[]',
  suggested_company_ids jsonb NOT NULL DEFAULT '[]',
  fit_score numeric(5,2),
  rationale text,
  search_query text,
  source text NOT NULL DEFAULT 'admin_lab' CHECK (source IN ('admin_lab', 'mural_chat')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_matchmaking_history_created ON public.ai_matchmaking_history(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_matchmaking_history_source ON public.ai_matchmaking_history(source);

-- Logs de recomendações da IA para monitoramento e treino do modelo (assertividade)
CREATE TABLE IF NOT EXISTS public.ai_recommendations_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('ai_search', 'recommend_partner')),
  search_query text,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  company_name text,
  suggested_influencer_ids jsonb NOT NULL DEFAULT '[]',
  suggested_company_ids jsonb NOT NULL DEFAULT '[]',
  rationale text,
  sales_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_logs_created ON public.ai_recommendations_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_logs_source ON public.ai_recommendations_logs(source);
ALTER TABLE public.ai_recommendations_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow all for local API" ON public.ai_recommendations_logs;
  CREATE POLICY "Allow all for local API" ON public.ai_recommendations_logs FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Colunas extras para tabelas já existentes (ALTER ADD COLUMN IF NOT EXISTS)
DO $$ BEGIN
  ALTER TABLE public.ai_matchmaking_history ADD COLUMN IF NOT EXISTS search_query text;
  ALTER TABLE public.ai_matchmaking_history ADD COLUMN IF NOT EXISTS suggested_company_ids jsonb NOT NULL DEFAULT '[]';
  ALTER TABLE public.ai_matchmaking_history ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin_lab';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS denial_reason text;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.system_health_logs ADD COLUMN IF NOT EXISTS page_path text;
  ALTER TABLE public.system_health_logs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  ALTER TABLE public.system_health_logs ADD COLUMN IF NOT EXISTS user_email text;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS public_username text;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_influencers_public_username ON public.influencers(public_username) WHERE public_username IS NOT NULL;

-- RLS (permitir acesso pela API local)
ALTER TABLE public.platform_finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_matchmaking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow all for local API" ON public.platform_finances;
  CREATE POLICY "Allow all for local API" ON public.platform_finances FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow all for local API" ON public.system_health_logs;
  CREATE POLICY "Allow all for local API" ON public.system_health_logs FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow all for local API" ON public.ai_matchmaking_history;
  CREATE POLICY "Allow all for local API" ON public.ai_matchmaking_history FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow all for local API" ON public.admin_settings;
  CREATE POLICY "Allow all for local API" ON public.admin_settings FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- RLS forte para admins: apenas quem já é admin pode ler/gerir a tabela admins.
-- Suporta dois contextos: Supabase (auth.jwt) e API local (app.current_user_id via rest.js).
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can manage admins" ON public.admins;
  CREATE POLICY "Admins can manage admins" ON public.admins
  USING (
    -- Contexto Supabase: JWT com e-mail presente na tabela admins OU super_admin fixo
    (
      current_setting('request.jwt.claim.email', true) IS NOT NULL
      AND (
        lower(current_setting('request.jwt.claim.email', true)) IN (
          SELECT lower(email) FROM public.admins
        )
        OR lower(current_setting('request.jwt.claim.email', true)) = 'brotherscapitalut@gmail.com'
      )
    )
    OR
    -- Contexto API local: app.current_user_id mapeado para profiles.user_id vinculado a admins.user_id
    (
      current_setting('app.current_user_id', true) IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.admins a ON a.user_id = p.id
        WHERE p.user_id::text = current_setting('app.current_user_id', true)
      )
    )
  )
  WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- =============================================================================
-- Pronto para produção: status de pagamentos (Stripe) e SUPER_ADMIN
-- =============================================================================

-- payments: status pronto para notificações Stripe (pending, completed, failed, cancelled, refunded)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded'));

-- app_role: valor super_admin para identificar o administrador master na base
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE 'super_admin';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Garante que o e-mail original brotherscapitalut@gmail.com seja sempre SUPER ADMIN na tabela admins
DO $$ BEGIN
  INSERT INTO public.admins (user_id, email, role)
  SELECT p.id, p.email, 'super_admin'
  FROM public.profiles p
  WHERE LOWER(TRIM(p.email)) = 'brotherscapitalut@gmail.com'
  ON CONFLICT (email) DO NOTHING;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
