-- Propostas de parceria: influencer envia valor + descrição para a empresa; status Pendente → Aceita → Paga
CREATE TABLE IF NOT EXISTS public.partnership_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  influencer_id uuid REFERENCES public.influencers(id) ON DELETE SET NULL,
  to_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partnership_proposals_from ON public.partnership_proposals(from_user_id);
CREATE INDEX IF NOT EXISTS idx_partnership_proposals_to_company ON public.partnership_proposals(to_company_id);
CREATE INDEX IF NOT EXISTS idx_partnership_proposals_status ON public.partnership_proposals(status);

ALTER TABLE public.partnership_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Influencers can insert own proposals"
  ON public.partnership_proposals FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Influencers can read own proposals"
  ON public.partnership_proposals FOR SELECT
  USING (auth.uid() = from_user_id);

CREATE POLICY "Company owners can read proposals to their companies"
  ON public.partnership_proposals FOR SELECT
  USING (public.is_company_owner(auth.uid(), to_company_id));

CREATE POLICY "Company owners can update proposals to their companies (accept/paid)"
  ON public.partnership_proposals FOR UPDATE
  USING (public.is_company_owner(auth.uid(), to_company_id));

-- Aceitar proposta: validar saldo e debitar da empresa (reserva o valor para o influencer)
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
  SELECT id, to_company_id, amount, status INTO rec
  FROM public.partnership_proposals WHERE id = proposal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Proposta não encontrada');
  END IF;
  IF rec.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Proposta já foi processada');
  END IF;
  SELECT c.influencer_credits_balance INTO new_balance
  FROM public.companies c WHERE c.id = rec.to_company_id;
  IF new_balance IS NULL OR new_balance < rec.amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente. Recarregue créditos para influencers.');
  END IF;
  UPDATE public.companies
  SET influencer_credits_balance = influencer_credits_balance - rec.amount,
      updated_at = now()
  WHERE id = rec.to_company_id;
  UPDATE public.partnership_proposals
  SET status = 'accepted', updated_at = now()
  WHERE id = proposal_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON TABLE public.partnership_proposals IS 'Propostas enviadas por influencers às marcas; valor e descrição; status pending/accepted/paid.';
