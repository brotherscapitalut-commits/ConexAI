-- Premium Plus: marca com is_perpetual ignora ciclo de pulsação no mural (sempre escala 1.2 + glow fixo)
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS is_perpetual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.companies.is_perpetual IS 'Se true, marca Premium Plus: não pulsa no mural, mantém escala e glow fixos.';
