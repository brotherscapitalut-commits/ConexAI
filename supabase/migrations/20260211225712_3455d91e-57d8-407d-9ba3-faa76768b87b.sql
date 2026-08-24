
-- Mural type enum (empresas vs influencers)
CREATE TYPE public.mural_type AS ENUM ('empresas', 'influencers');

-- Moderation status enum
CREATE TYPE public.moderation_status AS ENUM ('pending', 'approved', 'rejected');

-- Add new columns to companies
ALTER TABLE public.companies
  ADD COLUMN mural_type public.mural_type NOT NULL DEFAULT 'empresas',
  ADD COLUMN moderation_status public.moderation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN moderation_notes text,
  ADD COLUMN instagram text,
  ADD COLUMN tiktok text;

-- Index for fast filtering by mural type
CREATE INDEX idx_companies_mural_type ON public.companies(mural_type);
CREATE INDEX idx_companies_moderation_status ON public.companies(moderation_status);
