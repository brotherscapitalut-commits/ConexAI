-- Tabela de lances por posição no mural (leilão)
CREATE TABLE IF NOT EXISTS public.position_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  to_brand_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_position_bids_to_brand ON public.position_bids(to_brand_id);
CREATE INDEX IF NOT EXISTS idx_position_bids_from_company ON public.position_bids(from_company_id);

ALTER TABLE public.position_bids ENABLE ROW LEVEL SECURITY;

-- Donos da marca (to_brand_id) podem ver e atualizar lances recebidos
CREATE POLICY "Company can read bids to own brand"
  ON public.position_bids FOR SELECT
  USING (public.is_company_owner(auth.uid(), to_brand_id));

CREATE POLICY "Company can update bids to own brand (accept/reject)"
  ON public.position_bids FOR UPDATE
  USING (public.is_company_owner(auth.uid(), to_brand_id));

-- Empresas podem inserir lances (from_company_id = própria empresa)
CREATE POLICY "Company can insert own bids"
  ON public.position_bids FOR INSERT
  WITH CHECK (public.is_company_owner(auth.uid(), from_company_id));

CREATE POLICY "Company can read own bids"
  ON public.position_bids FOR SELECT
  USING (public.is_company_owner(auth.uid(), from_company_id));

-- Aceitar lance: transfere posição, debita comprador, 70% vendedor, 30% plataforma
CREATE OR REPLACE FUNCTION public.accept_position_bid(bid_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b record;
  buyer_balance numeric;
  seller_share numeric;
  platform_share numeric;
BEGIN
  SELECT id, from_company_id, to_brand_id, amount, status INTO b
  FROM public.position_bids WHERE id = bid_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Lance não encontrado');
  END IF;
  IF b.status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Lance já foi processado');
  END IF;
  IF b.from_company_id = b.to_brand_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Não é possível dar lance na própria marca');
  END IF;

  SELECT influencer_credits_balance INTO buyer_balance FROM public.companies WHERE id = b.from_company_id;
  IF buyer_balance IS NULL OR buyer_balance < b.amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente do comprador');
  END IF;

  seller_share := round(b.amount * 0.70, 2);
  platform_share := b.amount - seller_share;

  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance - b.amount WHERE id = b.from_company_id;
  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance + seller_share WHERE id = b.to_brand_id;
  INSERT INTO public.system_profit (amount, source, reference_id) VALUES (platform_share, 'position_bid', bid_id);

  UPDATE public.blocks SET company_id = b.from_company_id WHERE company_id = b.to_brand_id;

  UPDATE public.position_bids SET status = 'accepted' WHERE id = bid_id;

  RETURN jsonb_build_object('ok', true, 'seller_share', seller_share, 'platform_share', platform_share);
END;
$$;

COMMENT ON FUNCTION public.accept_position_bid IS 'Aceita lance: transfere blocos ao comprador, debita comprador, 70% ao vendedor, 30% plataforma.';

-- Reputação: score por negociações concluídas (paid)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_score integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.reputation_score IS 'Aumenta a cada contrato finalizado com status Paid (parceria paga).';

-- Atualizar release_proposal_payment para incrementar reputation_score do influencer
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
  SET withdrawable_balance = withdrawable_balance + influencer_amount,
      reputation_score = COALESCE(reputation_score, 0) + 1
  WHERE user_id = rec.from_user_id;

  INSERT INTO public.system_profit (amount, source, reference_id)
  VALUES (platform_cut, 'proposal_release', proposal_id);

  UPDATE public.partnership_proposals
  SET status = 'paid', updated_at = now()
  WHERE id = proposal_id;

  RETURN jsonb_build_object('ok', true, 'influencer_amount', influencer_amount, 'platform_cut', platform_cut);
END;
$$;
