-- Link de entrega e status "em revisão"
ALTER TABLE public.partnership_proposals
  ADD COLUMN IF NOT EXISTS delivery_link text;

ALTER TABLE public.partnership_proposals
  DROP CONSTRAINT IF EXISTS partnership_proposals_status_check;

ALTER TABLE public.partnership_proposals
  ADD CONSTRAINT partnership_proposals_status_check
  CHECK (status IN ('pending', 'accepted', 'under_review', 'paid'));

COMMENT ON COLUMN public.partnership_proposals.delivery_link IS 'Link da postagem enviado pelo influencer; preenchido ao clicar em Enviar Entrega.';

-- Influencer pode atualizar suas próprias propostas (enviar entrega)
CREATE POLICY "Influencers can update own proposals (delivery)"
  ON public.partnership_proposals FOR UPDATE
  USING (auth.uid() = from_user_id)
  WITH CHECK (auth.uid() = from_user_id);

-- Saldo sacável do influencer (profiles)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS withdrawable_balance numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.withdrawable_balance IS 'Saldo disponível para saque (PIX, conta, cartão).';

-- Lucro do sistema (taxa da plataforma em liberações)
CREATE TABLE IF NOT EXISTS public.system_profit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL CHECK (amount >= 0),
  source text NOT NULL DEFAULT 'proposal_release',
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_profit_created ON public.system_profit(created_at);

ALTER TABLE public.system_profit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service or admin can manage system_profit"
  ON public.system_profit FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Liberação final: empresa confirma entrega; desconta 15% para plataforma e credita o restante no withdrawable_balance do influencer
CREATE OR REPLACE FUNCTION public.release_proposal_payment(proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  platform_fee_pct numeric := 0.15;
  platform_cut numeric;
  influencer_amount numeric;
BEGIN
  SELECT id, from_user_id, amount, status INTO rec
  FROM public.partnership_proposals WHERE id = proposal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Proposta não encontrada');
  END IF;
  IF rec.status != 'under_review' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Entrega ainda não enviada pelo influencer ou já liberada.');
  END IF;

  platform_cut := round(rec.amount * platform_fee_pct, 2);
  influencer_amount := rec.amount - platform_cut;

  UPDATE public.profiles
  SET withdrawable_balance = withdrawable_balance + influencer_amount
  WHERE user_id = rec.from_user_id;

  INSERT INTO public.system_profit (amount, source, reference_id)
  VALUES (platform_cut, 'proposal_release', proposal_id);

  UPDATE public.partnership_proposals
  SET status = 'paid', updated_at = now()
  WHERE id = proposal_id;

  RETURN jsonb_build_object('ok', true, 'influencer_amount', influencer_amount, 'platform_cut', platform_cut);
END;
$$;

COMMENT ON FUNCTION public.release_proposal_payment IS 'Confirma entrega e libera valor: credita withdrawable_balance do influencer (85%) e registra taxa 15% em system_profit.';

-- Solicitações de saque do influencer (PIX, conta, cartão)
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  pix_key text,
  pix_key_type text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON public.withdrawal_requests(user_id);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own withdrawal_requests"
  ON public.withdrawal_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own withdrawal_requests"
  ON public.withdrawal_requests FOR SELECT USING (auth.uid() = user_id);

-- Solicitar saque: debita withdrawable_balance e cria withdrawal_request
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  amount_to_withdraw numeric,
  pix_key text DEFAULT NULL,
  pix_key_type text DEFAULT 'cpf'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance numeric;
BEGIN
  IF amount_to_withdraw IS NULL OR amount_to_withdraw < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Valor mínimo para saque: R$ 10,00.');
  END IF;
  SELECT withdrawable_balance INTO current_balance FROM public.profiles WHERE user_id = auth.uid();
  IF current_balance IS NULL OR current_balance < amount_to_withdraw THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente.');
  END IF;
  UPDATE public.profiles SET withdrawable_balance = withdrawable_balance - amount_to_withdraw WHERE user_id = auth.uid();
  INSERT INTO public.withdrawal_requests (user_id, amount, pix_key, pix_key_type, status)
  VALUES (auth.uid(), amount_to_withdraw, pix_key, pix_key_type, 'pending');
  RETURN jsonb_build_object('ok', true);
END;
$$;
