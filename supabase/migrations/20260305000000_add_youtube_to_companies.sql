-- Add youtube column to companies (instagram and tiktok already exist)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS youtube text;
