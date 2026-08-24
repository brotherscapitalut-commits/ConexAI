-- =============================================================================
-- init_local_db.sql — Schema completo para banco LOCAL (PostgreSQL)
-- =============================================================================
-- Uso:
--   1) Com Supabase local:  supabase start  →  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f init_local_db.sql
--   2) Postgres standalone: psql "postgresql://postgres:senha@localhost:5432/mural_digital" -f init_local_db.sql
--      (Requer que auth.users exista; com Supabase local isso já existe.)
-- =============================================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.block_status AS ENUM ('free', 'reserved', 'occupied');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public.block_region AS ENUM ('borda', 'intermediaria', 'centro_premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'advertiser', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public.mural_type AS ENUM ('empresas', 'influencers');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public.moderation_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- profiles (depende de auth.users no Supabase local)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  profile_type text,
  is_approved boolean NOT NULL DEFAULT false,
  waitlist_position integer,
  withdrawable_balance numeric NOT NULL DEFAULT 0,
  reputation_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Referência opcional a auth.users (comentar se usar Postgres puro sem auth)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- -----------------------------------------------------------------------------
-- user_roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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
  moderation_status public.moderation_status NOT NULL DEFAULT 'pending',
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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_owner_id_fkey;
    ALTER TABLE public.companies ADD CONSTRAINT companies_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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
CREATE INDEX IF NOT EXISTS idx_blocks_status ON public.blocks(status);

-- -----------------------------------------------------------------------------
-- influencers (owner_id como UUID; FK opcional para auth.users)
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
  moderation_status public.moderation_status NOT NULL DEFAULT 'pending',
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
-- partnership_proposals
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
  briefing text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partnership_proposals_status_check
    CHECK (status IN ('pending', 'counter_offer', 'accepted', 'under_review', 'paid'))
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    ALTER TABLE public.partnership_proposals DROP CONSTRAINT IF EXISTS partnership_proposals_from_user_id_fkey;
    ALTER TABLE public.partnership_proposals ADD CONSTRAINT partnership_proposals_from_user_id_fkey
      FOREIGN KEY (from_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_partnership_proposals_from ON public.partnership_proposals(from_user_id);
CREATE INDEX IF NOT EXISTS idx_partnership_proposals_to_company ON public.partnership_proposals(to_company_id);
CREATE INDEX IF NOT EXISTS idx_partnership_proposals_status ON public.partnership_proposals(status);

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
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_owner(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND owner_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_blocks_updated_at ON public.blocks;
CREATE TRIGGER update_blocks_updated_at
  BEFORE UPDATE ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- RLS (simplificado para uso local; auth.uid() funciona com Supabase local)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can view companies" ON public.companies;
CREATE POLICY "Anyone can view companies" ON public.companies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Advertisers create own company" ON public.companies;
CREATE POLICY "Advertisers create own company" ON public.companies FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Owners update own company" ON public.companies;
CREATE POLICY "Owners update own company" ON public.companies FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Owners delete own company" ON public.companies;
CREATE POLICY "Owners delete own company" ON public.companies FOR DELETE USING (true);

DROP POLICY IF EXISTS "Anyone can view blocks" ON public.blocks;
CREATE POLICY "Anyone can view blocks" ON public.blocks FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin or owner can insert blocks" ON public.blocks;
CREATE POLICY "Admin or owner can insert blocks" ON public.blocks FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admin or owner can update blocks" ON public.blocks;
CREATE POLICY "Admin or owner can update blocks" ON public.blocks FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can view approved influencers" ON public.influencers;
CREATE POLICY "Anyone can view approved influencers" ON public.influencers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Owners create own influencer profile" ON public.influencers;
CREATE POLICY "Owners create own influencer profile" ON public.influencers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Owners update own influencer profile" ON public.influencers;
CREATE POLICY "Owners update own influencer profile" ON public.influencers FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Owners or admin delete influencer profile" ON public.influencers;
CREATE POLICY "Owners or admin delete influencer profile" ON public.influencers FOR DELETE USING (true);

DROP POLICY IF EXISTS "Company can manage own active_campaigns" ON public.active_campaigns;
CREATE POLICY "Company can manage own active_campaigns" ON public.active_campaigns FOR ALL USING (true);
DROP POLICY IF EXISTS "Anyone can read active_campaigns (listagem)" ON public.active_campaigns;
CREATE POLICY "Anyone can read active_campaigns (listagem)" ON public.active_campaigns FOR SELECT USING (true);

DROP POLICY IF EXISTS "Company can manage own favorite_influencers" ON public.favorite_influencers;
CREATE POLICY "Company can manage own favorite_influencers" ON public.favorite_influencers FOR ALL USING (true);

DROP POLICY IF EXISTS "Influencers can insert own proposals" ON public.partnership_proposals;
CREATE POLICY "Influencers can insert own proposals" ON public.partnership_proposals FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Influencers can read own proposals" ON public.partnership_proposals;
CREATE POLICY "Influencers can read own proposals" ON public.partnership_proposals FOR SELECT USING (true);
DROP POLICY IF EXISTS "Company owners can read proposals to their companies" ON public.partnership_proposals;
CREATE POLICY "Company owners can read proposals to their companies" ON public.partnership_proposals FOR SELECT USING (true);
DROP POLICY IF EXISTS "Company owners can update proposals to their companies" ON public.partnership_proposals;
CREATE POLICY "Company owners can update proposals to their companies" ON public.partnership_proposals FOR UPDATE USING (true);
