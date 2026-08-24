-- =============================================================================
-- FULL_SCHEMA.sql — PostgreSQL 15 — Backend local (sem Supabase Cloud)
-- Consolida: local_schema_pgadmin.sql, rebuild_supabase_schema.sql,
--            scripts/admin_suite_tables.sql, supabase/migrations/*.sql
--            e tabelas/queries usadas em server/index.js, server/auth.js, server/rpc.js
--
-- Aplicação (banco vazio ou primeira instalação):
--   psql -U postgres -d muraldigital -v ON_ERROR_STOP=1 -f FULL_SCHEMA.sql
--
-- auth.uid() lê current_setting('app.current_user_id') — definido pela API (rest.js).
-- RLS ativo com política permissiva "Allow all for local API" (controle no Node).
--
-- Validado: carregamento completo em PostgreSQL 15 (Docker) sem erros; 32 tabelas
-- públicas; RPCs accept_* / release_* / request_withdrawal presentes.
-- Não inclui: Supabase Realtime, storage, pg_cron, pg_net, auth.users.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

-- -----------------------------------------------------------------------------
-- ENUMs
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.block_status AS ENUM ('free', 'reserved', 'occupied');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.block_region AS ENUM ('borda', 'intermediaria', 'centro_premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'advertiser', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.mural_type AS ENUM ('empresas', 'influencers');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.moderation_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.crm_lead_status AS ENUM ('lead', 'contato', 'negociacao', 'proposta', 'cliente', 'perdido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  email text,
  password_hash text,
  display_name text,
  avatar_url text,
  profile_type text,
  is_approved boolean NOT NULL DEFAULT true,
  waitlist_position integer,
  withdrawable_balance numeric NOT NULL DEFAULT 0,
  reputation_score integer NOT NULL DEFAULT 0,
  account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'excluded', 'banned', 'expired')),
  email_notify_bids boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  referral_code text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

CREATE OR REPLACE FUNCTION public.profiles_set_user_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.user_id := COALESCE(NEW.user_id, NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_user_id_trigger ON public.profiles;
CREATE TRIGGER profiles_set_user_id_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_set_user_id();

-- -----------------------------------------------------------------------------
-- user_roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

-- -----------------------------------------------------------------------------
-- companies
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  website text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  description text,
  logo_url text,
  logo_initials text NOT NULL DEFAULT 'XX',
  color text NOT NULL DEFAULT '#00d4ff',
  expires_at timestamptz,
  contact_whatsapp text,
  contact_email text,
  mural_type public.mural_type NOT NULL DEFAULT 'empresas',
  moderation_status public.moderation_status NOT NULL DEFAULT 'approved',
  moderation_notes text,
  instagram text,
  tiktok text,
  youtube text,
  product_service text,
  target_audience text,
  avg_budget text,
  region text,
  country text,
  is_perpetual boolean NOT NULL DEFAULT false,
  influencer_credits_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_companies_owner ON public.companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_country ON public.companies(country);
CREATE INDEX IF NOT EXISTS idx_companies_mural_type ON public.companies(mural_type);
CREATE INDEX IF NOT EXISTS idx_companies_moderation_status ON public.companies(moderation_status);

-- -----------------------------------------------------------------------------
-- blocks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  x integer NOT NULL,
  y integer NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  region public.block_region NOT NULL DEFAULT 'borda',
  status public.block_status NOT NULL DEFAULT 'free',
  reserved_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (x, y)
);
CREATE INDEX IF NOT EXISTS idx_blocks_xy ON public.blocks(x, y);
CREATE INDEX IF NOT EXISTS idx_blocks_company ON public.blocks(company_id);
CREATE INDEX IF NOT EXISTS idx_blocks_status ON public.blocks(status);
CREATE INDEX IF NOT EXISTS idx_blocks_company_status ON public.blocks(company_id, status);
CREATE INDEX IF NOT EXISTS idx_blocks_region_status ON public.blocks(region, status);

-- -----------------------------------------------------------------------------
-- clicks, payments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  block_x integer,
  block_y integer,
  source text NOT NULL DEFAULT 'mural',
  anonymized_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clicks_company ON public.clicks(company_id);
CREATE INDEX IF NOT EXISTS idx_clicks_created ON public.clicks(created_at);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  blocks_count integer NOT NULL,
  region public.block_region NOT NULL,
  stripe_session_id text,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_status_check CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded'))
);

-- -----------------------------------------------------------------------------
-- influencers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  photo_url text,
  category text NOT NULL DEFAULT '',
  niche text,
  bio text,
  followers_count integer DEFAULT 0,
  avg_engagement numeric(5,2) DEFAULT 0,
  portfolio_url text,
  instagram text,
  tiktok text,
  youtube text,
  twitter text,
  contact_email text,
  contact_whatsapp text,
  website text,
  region text,
  color text NOT NULL DEFAULT '#8b5cf6',
  logo_initials text NOT NULL DEFAULT 'XX',
  mural_type public.mural_type NOT NULL DEFAULT 'influencers',
  moderation_status public.moderation_status NOT NULL DEFAULT 'approved',
  moderation_notes text,
  public_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_influencers_public_username ON public.influencers(public_username) WHERE public_username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_influencers_owner ON public.influencers(owner_id);

-- -----------------------------------------------------------------------------
-- interactions + platform_revenue
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  block_x integer,
  block_y integer,
  source text NOT NULL DEFAULT 'mural',
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interactions_company ON public.interactions(company_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON public.interactions(created_at);

CREATE TABLE IF NOT EXISTS public.platform_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  interaction_id uuid REFERENCES public.interactions(id) ON DELETE SET NULL,
  amount_platform numeric NOT NULL DEFAULT 0,
  amount_influencer numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_company ON public.platform_revenue(company_id);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_user ON public.platform_revenue(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_created ON public.platform_revenue(created_at);

-- -----------------------------------------------------------------------------
-- campaigns (valor fixo) + campaign_influencers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'collecting_interest', 'funded', 'active', 'completed', 'cancelled')),
  title text,
  description text,
  campaign_link text,
  is_public boolean NOT NULL DEFAULT true,
  attachment_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_company ON public.campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON public.campaigns(owner_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);

CREATE TABLE IF NOT EXISTS public.campaign_influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, influencer_id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_influencers_campaign ON public.campaign_influencers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_influencers_influencer ON public.campaign_influencers(influencer_id);

CREATE TABLE IF NOT EXISTS public.campaign_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_proposals_company ON public.campaign_proposals(company_id);

-- -----------------------------------------------------------------------------
-- partnership_proposals, system_profit, withdrawal_requests, position_bids
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partnership_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  influencer_id uuid REFERENCES public.influencers(id) ON DELETE SET NULL,
  to_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  description text,
  delivery_link text,
  suggested_amount numeric,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'counter_offer', 'accepted', 'under_review', 'paid', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partnership_proposals_from ON public.partnership_proposals(from_user_id);
CREATE INDEX IF NOT EXISTS idx_partnership_proposals_to_company ON public.partnership_proposals(to_company_id);
CREATE INDEX IF NOT EXISTS idx_partnership_proposals_status ON public.partnership_proposals(status);

CREATE TABLE IF NOT EXISTS public.system_profit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL CHECK (amount >= 0),
  source text NOT NULL DEFAULT 'proposal_release',
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_system_profit_created ON public.system_profit(created_at);

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  pix_key text,
  pix_key_type text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  denial_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON public.withdrawal_requests(user_id);

CREATE TABLE IF NOT EXISTS public.position_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  to_brand_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_position_bids_to_brand ON public.position_bids(to_brand_id);
CREATE INDEX IF NOT EXISTS idx_position_bids_from_company ON public.position_bids(from_company_id);

-- -----------------------------------------------------------------------------
-- direct_offers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.direct_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  description text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'under_review', 'paid', 'cancelled')),
  delivery_link text,
  read_at timestamptz,
  archived_at timestamptz,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_direct_offers_to_user ON public.direct_offers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_direct_offers_company ON public.direct_offers(company_id);

-- -----------------------------------------------------------------------------
-- active_campaigns, campaign_applications, favorite_influencers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.active_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  budget_per_influencer numeric NOT NULL CHECK (budget_per_influencer >= 0),
  slots_available integer NOT NULL CHECK (slots_available > 0) DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'trashed')),
  owner_id uuid,
  amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_active_campaigns_company ON public.active_campaigns(company_id);

CREATE TABLE IF NOT EXISTS public.campaign_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.active_campaigns(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, from_user_id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_applications_campaign ON public.campaign_applications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_applications_user ON public.campaign_applications(from_user_id);

CREATE TABLE IF NOT EXISTS public.favorite_influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, influencer_id)
);
CREATE INDEX IF NOT EXISTS idx_favorite_influencers_company ON public.favorite_influencers(company_id);

-- -----------------------------------------------------------------------------
-- conversations, messages, contact_events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  influencer_id uuid REFERENCES public.influencers(id) ON DELETE CASCADE,
  initiated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, influencer_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  to_influencer_id uuid REFERENCES public.influencers(id) ON DELETE SET NULL,
  contact_type text NOT NULL DEFAULT 'whatsapp' CHECK (contact_type IN ('whatsapp', 'email', 'instagram', 'tiktok', 'website')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- CRM
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  whatsapp text,
  website text,
  address text,
  city text,
  state text,
  zip_code text,
  country text DEFAULT 'BR',
  cnpj text,
  business_sector text,
  company_size text,
  estimated_revenue text,
  employee_count integer,
  lead_source text,
  status public.crm_lead_status NOT NULL DEFAULT 'lead',
  notes text,
  tags text[],
  linked_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to uuid,
  last_interaction_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  interaction_type text NOT NULL DEFAULT 'note',
  description text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON public.crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_lead ON public.crm_interactions(lead_id);

-- -----------------------------------------------------------------------------
-- checkout_orders (Stripe / compra de blocos — server/index.js)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkout_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checkout_orders_company ON public.checkout_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_checkout_orders_status ON public.checkout_orders(status);

-- -----------------------------------------------------------------------------
-- Admin suite: finanças, saúde, IA, admins
-- -----------------------------------------------------------------------------
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

CREATE TABLE IF NOT EXISTS public.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(LOWER(TRIM(email)));

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

CREATE TABLE IF NOT EXISTS public.admin_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT ''
);

INSERT INTO public.admin_settings (key, value) VALUES ('maintenance_mode', 'false')
  ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ai_matchmaking_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.active_campaigns(id) ON DELETE SET NULL,
  suggested_influencers_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_company_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  fit_score numeric(5,2),
  rationale text,
  search_query text,
  source text NOT NULL DEFAULT 'admin_lab' CHECK (source IN ('admin_lab', 'mural_chat')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_matchmaking_history_created ON public.ai_matchmaking_history(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_matchmaking_history_source ON public.ai_matchmaking_history(source);

CREATE TABLE IF NOT EXISTS public.ai_recommendations_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('ai_search', 'recommend_partner')),
  search_query text,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  company_name text,
  suggested_influencer_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_company_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  rationale text,
  sales_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_logs_created ON public.ai_recommendations_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_logs_source ON public.ai_recommendations_logs(source);

-- View inventário mural
DROP VIEW IF EXISTS public.mural_inventory;
CREATE VIEW public.mural_inventory AS
  SELECT x, y, company_id FROM public.blocks WHERE status = 'occupied';

-- -----------------------------------------------------------------------------
-- Funções auxiliares
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_company_owner(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id
    AND (
      EXISTS (SELECT 1 FROM public.companies WHERE id = c.company_id AND owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.influencers WHERE id = c.influencer_id AND owner_id = _user_id)
      OR public.has_role(_user_id, 'admin'::public.app_role)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_interaction_record_revenue()
RETURNS trigger
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
  FOR EACH ROW EXECUTE FUNCTION public.on_interaction_record_revenue();

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
  LEFT JOIN public.profiles p ON p.user_id = pr.user_id OR p.id = pr.user_id
  WHERE pr.user_id IS NOT NULL
  GROUP BY pr.user_id, p.display_name
  ORDER BY total_generated DESC
  LIMIT limit_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- RPCs usados por server/rpc.js (auth.uid() via app.current_user_id)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_partnership_proposal(proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  new_balance numeric;
BEGIN
  SELECT id, to_company_id, amount, status INTO rec FROM public.partnership_proposals WHERE id = proposal_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Proposta não encontrada'); END IF;
  IF rec.status NOT IN ('pending', 'counter_offer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Proposta já foi processada');
  END IF;
  SELECT c.influencer_credits_balance INTO new_balance FROM public.companies c WHERE c.id = rec.to_company_id;
  IF new_balance IS NULL OR new_balance < rec.amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente.');
  END IF;
  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance - rec.amount, updated_at = now() WHERE id = rec.to_company_id;
  UPDATE public.partnership_proposals SET status = 'accepted', updated_at = now() WHERE id = proposal_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_proposal_payment(proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  platform_fee_pct numeric := 0.15;
  platform_cut numeric;
  influencer_amount numeric;
BEGIN
  SELECT id, from_user_id, amount, status INTO rec FROM public.partnership_proposals WHERE id = proposal_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Proposta não encontrada'); END IF;
  IF rec.status != 'under_review' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Entrega ainda não enviada ou já liberada.');
  END IF;
  platform_cut := round(rec.amount * platform_fee_pct, 2);
  influencer_amount := rec.amount - platform_cut;
  UPDATE public.profiles
  SET withdrawable_balance = withdrawable_balance + influencer_amount,
      reputation_score = COALESCE(reputation_score, 0) + 1
  WHERE id = rec.from_user_id OR user_id = rec.from_user_id;
  INSERT INTO public.system_profit (amount, source, reference_id) VALUES (platform_cut, 'proposal_release', proposal_id);
  UPDATE public.partnership_proposals SET status = 'paid', updated_at = now() WHERE id = proposal_id;
  RETURN jsonb_build_object('ok', true, 'influencer_amount', influencer_amount, 'platform_cut', platform_cut);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_position_bid(bid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b record;
  buyer_balance numeric;
  seller_share numeric;
  platform_share numeric;
BEGIN
  SELECT id, from_company_id, to_brand_id, amount, status INTO b FROM public.position_bids WHERE id = bid_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Lance não encontrado'); END IF;
  IF b.status != 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'Lance já processado'); END IF;
  IF b.from_company_id = b.to_brand_id THEN RETURN jsonb_build_object('ok', false, 'error', 'Não pode dar lance na própria marca'); END IF;
  SELECT influencer_credits_balance INTO buyer_balance FROM public.companies WHERE id = b.from_company_id;
  IF buyer_balance IS NULL OR buyer_balance < b.amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente do comprador');
  END IF;
  seller_share := round(b.amount * 0.70, 2);
  platform_share := b.amount - seller_share;
  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance - b.amount WHERE id = b.from_company_id;
  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance + seller_share WHERE id = b.to_brand_id;
  INSERT INTO public.system_profit (amount, source, reference_id) VALUES (platform_share, 'position_bid', bid_id);
  UPDATE public.blocks SET company_id = b.from_company_id WHERE company_id = b.to_brand_id;
  UPDATE public.position_bids SET status = 'accepted' WHERE id = bid_id;
  RETURN jsonb_build_object('ok', true, 'seller_share', seller_share, 'platform_share', platform_share);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_direct_offer(offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rec record;
BEGIN
  SELECT id, company_id, to_user_id, amount, status INTO rec FROM public.direct_offers WHERE id = offer_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oferta não encontrada'); END IF;
  IF auth.uid() IS NULL OR auth.uid() != rec.to_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Apenas o influenciador pode aceitar.');
  END IF;
  IF rec.status != 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'Oferta já processada'); END IF;
  IF (SELECT influencer_credits_balance FROM public.companies WHERE id = rec.company_id) < rec.amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente.');
  END IF;
  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance - rec.amount WHERE id = rec.company_id;
  UPDATE public.direct_offers SET status = 'accepted', updated_at = now() WHERE id = offer_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Taxa plataforma 10% em liberação de oferta direta (migração 20260321000000)
CREATE OR REPLACE FUNCTION public.release_direct_offer(offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  platform_fee_pct numeric := 0.10;
  platform_cut numeric;
  influencer_amount numeric;
BEGIN
  SELECT id, company_id, to_user_id, amount, status INTO rec FROM public.direct_offers WHERE id = offer_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oferta não encontrada'); END IF;
  IF NOT public.is_company_owner(auth.uid(), rec.company_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Apenas a empresa pode confirmar a entrega.');
  END IF;
  IF rec.status != 'under_review' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Entrega ainda não enviada ou já liberada.');
  END IF;
  platform_cut := round(rec.amount * platform_fee_pct, 2);
  influencer_amount := rec.amount - platform_cut;
  UPDATE public.profiles
  SET withdrawable_balance = withdrawable_balance + influencer_amount,
      reputation_score = COALESCE(reputation_score, 0) + 1
  WHERE id = rec.to_user_id OR user_id = rec.to_user_id;
  INSERT INTO public.system_profit (amount, source, reference_id) VALUES (platform_cut, 'direct_offer_release', offer_id);
  UPDATE public.direct_offers SET status = 'paid', updated_at = now() WHERE id = offer_id;
  RETURN jsonb_build_object('ok', true, 'influencer_amount', influencer_amount, 'platform_cut', platform_cut);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_campaign_application(application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app record;
  camp record;
BEGIN
  SELECT ca.id, ca.campaign_id, ca.from_user_id, ca.status INTO app
  FROM public.campaign_applications ca WHERE ca.id = application_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Candidatura não encontrada'); END IF;
  IF app.status != 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'Candidatura já processada'); END IF;
  SELECT ac.id, ac.company_id, ac.title, ac.description, ac.budget_per_influencer, ac.slots_available
  INTO camp FROM public.active_campaigns ac WHERE ac.id = app.campaign_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Campanha não encontrada'); END IF;
  IF camp.slots_available < 1 THEN RETURN jsonb_build_object('ok', false, 'error', 'Sem vagas'); END IF;
  IF (SELECT influencer_credits_balance FROM public.companies WHERE id = camp.company_id) < camp.budget_per_influencer THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente');
  END IF;
  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance - camp.budget_per_influencer WHERE id = camp.company_id;
  INSERT INTO public.direct_offers (company_id, to_user_id, amount, description, status)
  VALUES (camp.company_id, app.from_user_id, camp.budget_per_influencer,
          camp.title || ': ' || COALESCE(camp.description, ''), 'accepted');
  UPDATE public.campaign_applications SET status = 'accepted' WHERE id = application_id;
  UPDATE public.active_campaigns SET slots_available = slots_available - 1 WHERE id = camp.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  amount_to_withdraw numeric,
  pix_key text DEFAULT NULL,
  pix_key_type text DEFAULT 'cpf'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance numeric;
BEGIN
  IF amount_to_withdraw IS NULL OR amount_to_withdraw < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Valor mínimo para saque: R$ 10,00.');
  END IF;
  SELECT withdrawable_balance INTO current_balance FROM public.profiles WHERE id = auth.uid() OR user_id = auth.uid();
  IF current_balance IS NULL OR current_balance < amount_to_withdraw THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente.');
  END IF;
  UPDATE public.profiles SET withdrawable_balance = withdrawable_balance - amount_to_withdraw
  WHERE id = auth.uid() OR user_id = auth.uid();
  INSERT INTO public.withdrawal_requests (user_id, amount, pix_key, pix_key_type, status)
  VALUES (auth.uid(), amount_to_withdraw, pix_key, pix_key_type, 'pending');
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- Triggers updated_at
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_blocks_updated_at ON public.blocks;
CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_influencers_updated_at ON public.influencers;
CREATE TRIGGER update_influencers_updated_at BEFORE UPDATE ON public.influencers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_crm_leads_updated_at ON public.crm_leads;
CREATE TRIGGER update_crm_leads_updated_at BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- RLS: API local (autorização na aplicação Node)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profiles','user_roles','companies','blocks','clicks','payments','influencers',
    'interactions','platform_revenue','campaigns','campaign_influencers','campaign_proposals',
    'partnership_proposals','system_profit','withdrawal_requests','position_bids','direct_offers',
    'active_campaigns','campaign_applications','favorite_influencers','conversations','messages',
    'contact_events','crm_leads','crm_interactions','checkout_orders','platform_finances',
    'admins','system_health_logs','admin_settings','ai_matchmaking_history','ai_recommendations_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all for local API" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Allow all for local API" ON public.%I FOR ALL USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- Fim FULL_SCHEMA.sql
