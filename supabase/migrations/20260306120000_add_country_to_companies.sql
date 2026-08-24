-- Add country to companies for global ranking (dominância territorial)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_country ON public.companies(country);
