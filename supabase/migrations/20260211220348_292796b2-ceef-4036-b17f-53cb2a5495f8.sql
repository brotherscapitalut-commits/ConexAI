
-- Enum for block status
CREATE TYPE public.block_status AS ENUM ('free', 'reserved', 'occupied');
-- Enum for block region
CREATE TYPE public.block_region AS ENUM ('borda', 'intermediaria', 'centro_premium');
-- Enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'advertiser', 'user');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  logo_initials TEXT NOT NULL DEFAULT 'XX',
  color TEXT NOT NULL DEFAULT '#00d4ff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blocks table
CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  region block_region NOT NULL DEFAULT 'borda',
  status block_status NOT NULL DEFAULT 'free',
  reserved_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(x, y)
);

-- Clicks table
CREATE TABLE public.clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  block_x INTEGER,
  block_y INTEGER,
  source TEXT NOT NULL DEFAULT 'mural',
  anonymized_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  blocks_count INTEGER NOT NULL,
  region block_region NOT NULL,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Helper function: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
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

-- Helper function: is_company_owner
CREATE OR REPLACE FUNCTION public.is_company_owner(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
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

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  -- Default role: advertiser
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'advertiser');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON public.blocks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: profiles
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS: user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- RLS: companies
CREATE POLICY "Anyone can view companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Advertisers create own company" ON public.companies FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own company" ON public.companies FOR UPDATE USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners delete own company" ON public.companies FOR DELETE USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- RLS: blocks
CREATE POLICY "Anyone can view blocks" ON public.blocks FOR SELECT USING (true);
CREATE POLICY "Admin or owner can insert blocks" ON public.blocks FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  (company_id IS NOT NULL AND public.is_company_owner(auth.uid(), company_id))
);
CREATE POLICY "Admin or owner can update blocks" ON public.blocks FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin') OR 
  (company_id IS NOT NULL AND public.is_company_owner(auth.uid(), company_id))
);

-- RLS: clicks
CREATE POLICY "Anyone can insert clicks" ON public.clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "Owner or admin can view clicks" ON public.clicks FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.is_company_owner(auth.uid(), company_id)
);

-- RLS: payments
CREATE POLICY "Owner or admin can view payments" ON public.payments FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.is_company_owner(auth.uid(), company_id)
);
CREATE POLICY "System can insert payments" ON public.payments FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.is_company_owner(auth.uid(), company_id)
);

-- Enable realtime for blocks and clicks
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clicks;

-- Create index for performance
CREATE INDEX idx_blocks_xy ON public.blocks(x, y);
CREATE INDEX idx_blocks_company ON public.blocks(company_id);
CREATE INDEX idx_blocks_status ON public.blocks(status);
CREATE INDEX idx_clicks_company ON public.clicks(company_id);
CREATE INDEX idx_clicks_created ON public.clicks(created_at);
CREATE INDEX idx_companies_owner ON public.companies(owner_id);
