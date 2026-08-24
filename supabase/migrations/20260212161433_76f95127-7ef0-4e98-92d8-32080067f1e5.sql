
-- =============================================
-- 1. CREATE INFLUENCERS TABLE
-- =============================================
CREATE TABLE public.influencers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  photo_url TEXT,
  category TEXT NOT NULL,
  niche TEXT,
  bio TEXT,
  followers_count INTEGER DEFAULT 0,
  avg_engagement NUMERIC(5,2) DEFAULT 0,
  portfolio_url TEXT,
  instagram TEXT,
  tiktok TEXT,
  youtube TEXT,
  twitter TEXT,
  contact_email TEXT,
  contact_whatsapp TEXT,
  website TEXT,
  region TEXT,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  logo_initials TEXT NOT NULL DEFAULT 'XX',
  mural_type public.mural_type NOT NULL DEFAULT 'influencers',
  moderation_status public.moderation_status NOT NULL DEFAULT 'pending',
  moderation_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view approved influencers"
ON public.influencers FOR SELECT
USING (true);

CREATE POLICY "Owners create own influencer profile"
ON public.influencers FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update own influencer profile"
ON public.influencers FOR UPDATE
USING (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners or admin delete influencer profile"
ON public.influencers FOR DELETE
USING (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_influencers_updated_at
BEFORE UPDATE ON public.influencers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. ADD MISSING COLUMNS TO COMPANIES
-- =============================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS product_service TEXT,
  ADD COLUMN IF NOT EXISTS target_audience TEXT,
  ADD COLUMN IF NOT EXISTS avg_budget TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT;

-- =============================================
-- 3. ENABLE REALTIME FOR INFLUENCERS
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.influencers;
