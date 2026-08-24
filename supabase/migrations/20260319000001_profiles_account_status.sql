-- Status da conta para CRM: ativo, excluído, banido, expirado (não renovou)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
  CHECK (account_status IN ('active', 'excluded', 'banned', 'expired'));

COMMENT ON COLUMN public.profiles.account_status IS 'active = normal; excluded = excluído pelo admin; banned = banido; expired = não renovou (sem empresa ativa).';
