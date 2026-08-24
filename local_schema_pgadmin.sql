-- =============================================================================
-- local_schema_pgadmin.sql — Schema completo para PostgreSQL local (pgAdmin)
-- Desvinculado do Supabase Cloud. Inclui: profiles, companies, blocks,
-- active_campaigns, favorite_influencers, partnership_proposals, position_bids,
-- system_profit + auth local (email/password em profiles).
-- =============================================================================
-- Uso no pgAdmin: abra este arquivo e execute no banco desejado (ex.: mural_digital).
-- =============================================================================

-- Schema auth (para compatibilidade com funções que usam auth.uid())
CREATE SCHEMA IF NOT EXISTS auth;

-- Em modo local, auth.uid() lê o user_id da sessão (definido pela API)
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

-- Enums
DO $$ BEGIN CREATE TYPE public.block_status AS ENUM ('free', 'reserved', 'occupied');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.block_region AS ENUM ('borda', 'intermediaria', 'centro_premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'advertiser', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.mural_type AS ENUM ('empresas', 'influencers');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.moderation_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- profiles (com email e password_hash para login local / modo desenvolvimento)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  email text UNIQUE,
  password_hash text,
  display_name text,
  avatar_url text,
  profile_type text DEFAULT 'company',
  is_approved boolean NOT NULL DEFAULT true,
  waitlist_position integer,
  withdrawable_balance numeric NOT NULL DEFAULT 0,
  reputation_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Em INSERT, user_id = id para login local (um único id por perfil)
CREATE OR REPLACE FUNCTION public.profiles_set_user_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.user_id := NEW.id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tr_profiles_set_user_id ON public.profiles;
CREATE TRIGGER tr_profiles_set_user_id BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.profiles_set_user_id();

-- -----------------------------------------------------------------------------
-- user_roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- -----------------------------------------------------------------------------
-- companies
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  website text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  description text,
  logo_url text,
  logo_initials text NOT NULL DEFAULT 'XX',
  color text NOT NULL DEFAULT '#00d4ff',
  mural_type public.mural_type NOT NULL DEFAULT 'empresas',
  moderation_status public.moderation_status NOT NULL DEFAULT 'approved',
  moderation_notes text,
  instagram text,
  tiktok text,
  product_service text,
  target_audience text,
  avg_budget text,
  region text,
  expires_at timestamptz,
  contact_whatsapp text,
  contact_email text,
  country text,
  is_perpetual boolean NOT NULL DEFAULT false,
  influencer_credits_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_owner ON public.companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_country ON public.companies(country);

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
  UNIQUE(x, y)
);

CREATE INDEX IF NOT EXISTS idx_blocks_xy ON public.blocks(x, y);
CREATE INDEX IF NOT EXISTS idx_blocks_company ON public.blocks(company_id);

-- -----------------------------------------------------------------------------
-- interactions (cliques no mural)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  block_x integer,
  block_y integer,
  source text NOT NULL DEFAULT 'mural',
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interactions_company ON public.interactions(company_id);

-- -----------------------------------------------------------------------------
-- influencers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_influencers_owner ON public.influencers(owner_id);

-- -----------------------------------------------------------------------------
-- active_campaigns
-- -----------------------------------------------------------------------------
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

-- Colunas opcionais para compatibilidade com CampaignsSection (uso único: active_campaigns)
ALTER TABLE public.active_campaigns ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.active_campaigns ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.active_campaigns ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
ALTER TABLE public.active_campaigns ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- campaign_influencers referenciando active_campaigns (para lista de interesse)
CREATE TABLE IF NOT EXISTS public.campaign_influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.active_campaigns(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_influencers_campaign ON public.campaign_influencers(campaign_id);

-- -----------------------------------------------------------------------------
-- campaign_applications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.active_campaigns(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, from_user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_applications_campaign ON public.campaign_applications(campaign_id);

-- -----------------------------------------------------------------------------
-- favorite_influencers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.favorite_influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, influencer_id)
);

CREATE INDEX IF NOT EXISTS idx_favorite_influencers_company ON public.favorite_influencers(company_id);

-- -----------------------------------------------------------------------------
-- partnership_proposals (contraproposta: suggested_amount, status counter_offer)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partnership_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  influencer_id uuid REFERENCES public.influencers(id) ON DELETE SET NULL,
  to_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  description text,
  delivery_link text,
  suggested_amount numeric,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partnership_proposals_status_check
    CHECK (status IN ('pending', 'counter_offer', 'accepted', 'under_review', 'paid'))
);

CREATE INDEX IF NOT EXISTS idx_partnership_proposals_from ON public.partnership_proposals(from_user_id);
CREATE INDEX IF NOT EXISTS idx_partnership_proposals_to_company ON public.partnership_proposals(to_company_id);

-- -----------------------------------------------------------------------------
-- position_bids (leilão de posição; 30% taxa plataforma)
-- -----------------------------------------------------------------------------
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
-- system_profit (30% em bids; 15% em liberação de propostas/ofertas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_profit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL CHECK (amount >= 0),
  source text NOT NULL DEFAULT 'proposal_release',
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_profit_created ON public.system_profit(created_at);

-- -----------------------------------------------------------------------------
-- direct_offers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.direct_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'under_review', 'paid', 'cancelled')),
  delivery_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_direct_offers_to_user ON public.direct_offers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_direct_offers_company ON public.direct_offers(company_id);

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  influencer_id uuid REFERENCES public.influencers(id) ON DELETE CASCADE,
  initiated_by uuid,
  status text NOT NULL DEFAULT 'active',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  influencer_id uuid,
  to_influencer_id uuid,
  user_id uuid,
  source text DEFAULT 'mural',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_company ON public.conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_conversations_influencer ON public.conversations(influencer_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_contact_events_to_influencer ON public.contact_events(to_influencer_id);

-- -----------------------------------------------------------------------------
-- Funções auxiliares
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_company_owner(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_blocks_updated_at ON public.blocks;
CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON public.blocks FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- RPC: accept_partnership_proposal (aceita pending ou counter_offer)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_partnership_proposal(proposal_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec record; new_balance numeric;
BEGIN
  SELECT id, to_company_id, amount, status INTO rec FROM public.partnership_proposals WHERE id = proposal_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Proposta não encontrada'); END IF;
  IF rec.status NOT IN ('pending', 'counter_offer') THEN RETURN jsonb_build_object('ok', false, 'error', 'Proposta já foi processada'); END IF;
  SELECT c.influencer_credits_balance INTO new_balance FROM public.companies c WHERE c.id = rec.to_company_id;
  IF new_balance IS NULL OR new_balance < rec.amount THEN RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente.'); END IF;
  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance - rec.amount WHERE id = rec.to_company_id;
  UPDATE public.partnership_proposals SET status = 'accepted', updated_at = now() WHERE id = proposal_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: release_proposal_payment (15% taxa; incrementa reputation_score)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_proposal_payment(proposal_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec record; platform_fee_pct numeric := 0.15; platform_cut numeric; influencer_amount numeric;
BEGIN
  SELECT id, from_user_id, amount, status INTO rec FROM public.partnership_proposals WHERE id = proposal_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Proposta não encontrada'); END IF;
  IF rec.status != 'under_review' THEN RETURN jsonb_build_object('ok', false, 'error', 'Entrega ainda não enviada ou já liberada.'); END IF;
  platform_cut := round(rec.amount * platform_fee_pct, 2);
  influencer_amount := rec.amount - platform_cut;
  UPDATE public.profiles SET withdrawable_balance = withdrawable_balance + influencer_amount, reputation_score = COALESCE(reputation_score, 0) + 1 WHERE user_id = rec.from_user_id;
  INSERT INTO public.system_profit (amount, source, reference_id) VALUES (platform_cut, 'proposal_release', proposal_id);
  UPDATE public.partnership_proposals SET status = 'paid', updated_at = now() WHERE id = proposal_id;
  RETURN jsonb_build_object('ok', true, 'influencer_amount', influencer_amount, 'platform_cut', platform_cut);
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: accept_position_bid (30% taxa para plataforma)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_position_bid(bid_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
  b record; 
  buyer_balance numeric; 
  seller_share numeric; 
  platform_share numeric;
  buyer_old_val numeric;
BEGIN
  -- 1. Obter info do lance
  SELECT id, from_company_id, to_brand_id, amount, status INTO b FROM public.position_bids WHERE id = bid_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Lance não encontrado'); END IF;
  IF b.status != 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'Lance já processado'); END IF;
  
  -- 2. Verificar saldo do comprador e valor antigo
  SELECT influencer_credits_balance, position_value INTO buyer_balance, buyer_old_val FROM public.companies WHERE id = b.from_company_id;
  IF buyer_balance IS NULL OR buyer_balance < b.amount THEN RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente do comprador'); END IF;
  
  -- 3. Calcular fatias (30% taxa plataforma)
  seller_share := round(b.amount * 0.70, 2);
  platform_share := b.amount - seller_share;
  
  -- 4. Transferência financeira
  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance - b.amount WHERE id = b.from_company_id;
  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance + seller_share WHERE id = b.to_brand_id;
  INSERT INTO public.system_profit (amount, source, reference_id) VALUES (platform_share, 'position_bid', bid_id);
  
  -- 5. TROCA DE POSIÇÕES (SWAP)
  UPDATE public.blocks 
  SET company_id = CASE 
    WHEN company_id = b.from_company_id THEN b.to_brand_id 
    WHEN company_id = b.to_brand_id THEN b.from_company_id 
  END 
  WHERE company_id IN (b.from_company_id, b.to_brand_id);
  
  -- 6. ATUALIZA VALORES DE MERCADO
  UPDATE public.companies SET position_value = b.amount WHERE id = b.from_company_id;
  UPDATE public.companies SET position_value = COALESCE(buyer_old_val, 150) WHERE id = b.to_brand_id;

  -- 7. Finalizar
  UPDATE public.position_bids SET status = 'accepted' WHERE id = bid_id;
  
  RETURN jsonb_build_object('ok', true, 'seller_share', seller_share, 'platform_share', platform_share);
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: accept_direct_offer
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_direct_offer(offer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec record;
BEGIN
  SELECT id, company_id, to_user_id, amount, status INTO rec FROM public.direct_offers WHERE id = offer_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oferta não encontrada'); END IF;
  IF auth.uid() != rec.to_user_id THEN RETURN jsonb_build_object('ok', false, 'error', 'Apenas o influenciador pode aceitar.'); END IF;
  IF rec.status != 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'Oferta já processada'); END IF;
  IF (SELECT influencer_credits_balance FROM public.companies WHERE id = rec.company_id) < rec.amount THEN RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente.'); END IF;
  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance - rec.amount WHERE id = rec.company_id;
  UPDATE public.direct_offers SET status = 'accepted', updated_at = now() WHERE id = offer_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: release_direct_offer (15% taxa)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_direct_offer(offer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec record; platform_fee_pct numeric := 0.15; platform_cut numeric; influencer_amount numeric;
BEGIN
  SELECT id, company_id, to_user_id, amount, status INTO rec FROM public.direct_offers WHERE id = offer_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oferta não encontrada'); END IF;
  IF NOT public.is_company_owner(auth.uid(), rec.company_id) THEN RETURN jsonb_build_object('ok', false, 'error', 'Apenas a empresa pode confirmar.'); END IF;
  IF rec.status != 'under_review' THEN RETURN jsonb_build_object('ok', false, 'error', 'Entrega ainda não enviada ou já liberada.'); END IF;
  platform_cut := round(rec.amount * platform_fee_pct, 2);
  influencer_amount := rec.amount - platform_cut;
  UPDATE public.profiles SET withdrawable_balance = withdrawable_balance + influencer_amount, reputation_score = COALESCE(reputation_score, 0) + 1 WHERE user_id = rec.to_user_id;
  INSERT INTO public.system_profit (amount, source, reference_id) VALUES (platform_cut, 'direct_offer_release', offer_id);
  UPDATE public.direct_offers SET status = 'paid', updated_at = now() WHERE id = offer_id;
  RETURN jsonb_build_object('ok', true, 'influencer_amount', influencer_amount, 'platform_cut', platform_cut);
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: accept_campaign_application
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_campaign_application(application_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE app record; camp record;
BEGIN
  SELECT ca.id, ca.campaign_id, ca.from_user_id INTO app FROM public.campaign_applications ca WHERE ca.id = application_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Candidatura não encontrada'); END IF;
  IF app.status != 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'Candidatura já processada'); END IF;
  SELECT ac.id, ac.company_id, ac.title, ac.description, ac.budget_per_influencer, ac.slots_available INTO camp FROM public.active_campaigns ac WHERE ac.id = app.campaign_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Campanha não encontrada'); END IF;
  IF camp.slots_available < 1 THEN RETURN jsonb_build_object('ok', false, 'error', 'Sem vagas'); END IF;
  IF (SELECT influencer_credits_balance FROM public.companies WHERE id = camp.company_id) < camp.budget_per_influencer THEN RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente'); END IF;
  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance - camp.budget_per_influencer WHERE id = camp.company_id;
  INSERT INTO public.direct_offers (company_id, to_user_id, amount, description, status) VALUES (camp.company_id, app.from_user_id, camp.budget_per_influencer, camp.title || ': ' || COALESCE(camp.description, ''), 'accepted');
  UPDATE public.campaign_applications SET status = 'accepted' WHERE id = application_id;
  UPDATE public.active_campaigns SET slots_available = slots_available - 1 WHERE id = camp.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- campaigns (CampaignsSection)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'collecting_interest', 'funded', 'active', 'completed', 'cancelled')),
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_company ON public.campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON public.campaigns(owner_id);

CREATE TABLE IF NOT EXISTS public.campaign_influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_influencers_campaign ON public.campaign_influencers(campaign_id);

-- -----------------------------------------------------------------------------
-- withdrawal_requests + RPC: request_withdrawal
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  pix_key text,
  pix_key_type text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.request_withdrawal(amount_to_withdraw numeric, pix_key text DEFAULT NULL, pix_key_type text DEFAULT 'cpf')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_balance numeric;
BEGIN
  SELECT withdrawable_balance INTO current_balance FROM public.profiles WHERE user_id = auth.uid();
  IF NOT FOUND OR current_balance IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Perfil não encontrado'); END IF;
  IF amount_to_withdraw <= 0 OR amount_to_withdraw > current_balance THEN RETURN jsonb_build_object('ok', false, 'error', 'Valor inválido ou saldo insuficiente'); END IF;
  UPDATE public.profiles SET withdrawable_balance = withdrawable_balance - amount_to_withdraw WHERE user_id = auth.uid();
  INSERT INTO public.withdrawal_requests (user_id, amount, pix_key, pix_key_type) VALUES (auth.uid(), amount_to_withdraw, pix_key, pix_key_type);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Desabilitar RLS nas tabelas para uso via API local (a autorização fica na API)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_profit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for local API" ON public.profiles;
CREATE POLICY "Allow all for local API" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for local API" ON public.companies;
CREATE POLICY "Allow all for local API" ON public.companies FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for local API" ON public.blocks;
CREATE POLICY "Allow all for local API" ON public.blocks FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for local API" ON public.influencers;
CREATE POLICY "Allow all for local API" ON public.influencers FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for local API" ON public.active_campaigns;
CREATE POLICY "Allow all for local API" ON public.active_campaigns FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for local API" ON public.favorite_influencers;
CREATE POLICY "Allow all for local API" ON public.favorite_influencers FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for local API" ON public.partnership_proposals;
CREATE POLICY "Allow all for local API" ON public.partnership_proposals FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for local API" ON public.position_bids;
CREATE POLICY "Allow all for local API" ON public.position_bids FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for local API" ON public.system_profit;
CREATE POLICY "Allow all for local API" ON public.system_profit FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for local API" ON public.direct_offers;
CREATE POLICY "Allow all for local API" ON public.direct_offers FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for local API" ON public.conversations;
CREATE POLICY "Allow all for local API" ON public.conversations FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for local API" ON public.messages;
CREATE POLICY "Allow all for local API" ON public.messages FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for local API" ON public.contact_events;
CREATE POLICY "Allow all for local API" ON public.contact_events FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_influencers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for local API" ON public.campaigns;
CREATE POLICY "Allow all for local API" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for local API" ON public.campaign_influencers;
CREATE POLICY "Allow all for local API" ON public.campaign_influencers FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for local API" ON public.interactions;
CREATE POLICY "Allow all for local API" ON public.interactions FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for local API" ON public.withdrawal_requests;
CREATE POLICY "Allow all for local API" ON public.withdrawal_requests FOR ALL USING (true) WITH CHECK (true);
