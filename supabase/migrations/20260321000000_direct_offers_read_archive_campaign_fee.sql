-- Ofertas diretas: ler como lido, cancelar, arquivar, vincular campanha; taxa 10%
ALTER TABLE public.direct_offers
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.direct_offers.read_at IS 'Quando o destinatário (influenciador) viu a oferta.';
COMMENT ON COLUMN public.direct_offers.archived_at IS 'Quando a oferta foi arquivada pelo remetente.';
COMMENT ON COLUMN public.direct_offers.campaign_id IS 'Campanha (valor fixo) vinculada para o influenciador acessar detalhes.';

-- Permitir status 'cancelled'
DO $$
BEGIN
  ALTER TABLE public.direct_offers DROP CONSTRAINT IF EXISTS direct_offers_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE public.direct_offers ADD CONSTRAINT direct_offers_status_check
  CHECK (status IN ('pending', 'accepted', 'under_review', 'paid', 'cancelled'));

-- Taxa plataforma 10%: 90% para influenciador/empresa
CREATE OR REPLACE FUNCTION public.release_direct_offer(offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  platform_fee_pct numeric := 0.10;
  platform_cut numeric;
  influencer_amount numeric;
BEGIN
  SELECT id, company_id, to_user_id, amount, status INTO rec FROM public.direct_offers WHERE id = offer_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oferta não encontrada'); END IF;
  IF NOT public.is_company_owner(auth.uid(), rec.company_id) THEN RETURN jsonb_build_object('ok', false, 'error', 'Apenas a empresa pode confirmar a entrega.'); END IF;
  IF rec.status != 'under_review' THEN RETURN jsonb_build_object('ok', false, 'error', 'Entrega ainda não enviada ou já liberada.'); END IF;
  platform_cut := round(rec.amount * platform_fee_pct, 2);
  influencer_amount := rec.amount - platform_cut;
  UPDATE public.profiles SET withdrawable_balance = withdrawable_balance + influencer_amount, reputation_score = COALESCE(reputation_score, 0) + 1 WHERE user_id = rec.to_user_id;
  INSERT INTO public.system_profit (amount, source, reference_id) VALUES (platform_cut, 'direct_offer_release', offer_id);
  UPDATE public.direct_offers SET status = 'paid', updated_at = now() WHERE id = offer_id;
  RETURN jsonb_build_object('ok', true, 'influencer_amount', influencer_amount, 'platform_cut', platform_cut);
END;
$$;
