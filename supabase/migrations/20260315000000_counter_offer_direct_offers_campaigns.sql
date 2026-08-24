-- Contraproposta: valor sugerido pela empresa e status counter_offer
ALTER TABLE public.partnership_proposals
  ADD COLUMN IF NOT EXISTS suggested_amount numeric;

ALTER TABLE public.partnership_proposals
  DROP CONSTRAINT IF EXISTS partnership_proposals_status_check;

ALTER TABLE public.partnership_proposals
  ADD CONSTRAINT partnership_proposals_status_check
  CHECK (status IN ('pending', 'counter_offer', 'accepted', 'under_review', 'paid'));

COMMENT ON COLUMN public.partnership_proposals.suggested_amount IS 'Valor sugerido pela empresa; influencer pode enviar contraproposta (status counter_offer).';

-- Aceitar proposta: permitir também status counter_offer (contraproposta do influencer)
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
  IF rec.status NOT IN ('pending', 'counter_offer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Proposta já foi processada');
  END IF;
  SELECT c.influencer_credits_balance INTO new_balance
  FROM public.companies c WHERE c.id = rec.to_company_id;
  IF new_balance IS NULL OR new_balance < rec.amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente. Recarregue créditos para influencers.');
  END IF;
  UPDATE public.companies
  SET influencer_credits_balance = influencer_credits_balance - rec.amount
  WHERE id = rec.to_company_id;
  UPDATE public.partnership_proposals
  SET status = 'accepted', updated_at = now()
  WHERE id = proposal_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Ofertas diretas: empresa -> influencer (mesmo fluxo: aceitar = congelar, entrega, liberar - 15%)
CREATE TABLE IF NOT EXISTS public.direct_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'under_review', 'paid')),
  delivery_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_direct_offers_to_user ON public.direct_offers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_direct_offers_company ON public.direct_offers(company_id);

ALTER TABLE public.direct_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company can insert own direct_offers"
  ON public.direct_offers FOR INSERT
  WITH CHECK (public.is_company_owner(auth.uid(), company_id));

CREATE POLICY "Company can read own direct_offers"
  ON public.direct_offers FOR SELECT
  USING (public.is_company_owner(auth.uid(), company_id));

CREATE POLICY "Influencer can read direct_offers to self"
  ON public.direct_offers FOR SELECT
  USING (auth.uid() = to_user_id);

CREATE POLICY "Influencer can update own direct_offers (delivery)"
  ON public.direct_offers FOR UPDATE
  USING (auth.uid() = to_user_id);

CREATE POLICY "Company can update own direct_offers (accept)"
  ON public.direct_offers FOR UPDATE
  USING (public.is_company_owner(auth.uid(), company_id));

-- Aceitar oferta direta: somente o influenciador (to_user_id) pode aceitar; debita empresa, status accepted
CREATE OR REPLACE FUNCTION public.accept_direct_offer(offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  SELECT id, company_id, to_user_id, amount, status INTO rec FROM public.direct_offers WHERE id = offer_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oferta não encontrada'); END IF;
  IF auth.uid() != rec.to_user_id THEN RETURN jsonb_build_object('ok', false, 'error', 'Apenas o influenciador pode aceitar esta oferta.'); END IF;
  IF rec.status != 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'Oferta já processada'); END IF;
  IF (SELECT influencer_credits_balance FROM public.companies WHERE id = rec.company_id) < rec.amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente da empresa.');
  END IF;
  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance - rec.amount WHERE id = rec.company_id;
  UPDATE public.direct_offers SET status = 'accepted', updated_at = now() WHERE id = offer_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Liberar oferta direta: apenas a empresa (dona do company_id) pode liberar; 85% influencer, 15% plataforma
CREATE OR REPLACE FUNCTION public.release_direct_offer(offer_id uuid)
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

-- Campanhas ativas: empresa cria; influencers candidatam-se
CREATE TABLE IF NOT EXISTS public.active_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  budget_per_influencer numeric NOT NULL CHECK (budget_per_influencer >= 0),
  slots_available integer NOT NULL CHECK (slots_available > 0) DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_active_campaigns_company ON public.active_campaigns(company_id);

ALTER TABLE public.active_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company can manage own active_campaigns"
  ON public.active_campaigns FOR ALL
  USING (public.is_company_owner(auth.uid(), company_id));

CREATE POLICY "Anyone can read active_campaigns (listagem)"
  ON public.active_campaigns FOR SELECT
  USING (true);

-- Candidaturas a campanhas
CREATE TABLE IF NOT EXISTS public.campaign_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.active_campaigns(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, from_user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_applications_campaign ON public.campaign_applications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_applications_user ON public.campaign_applications(from_user_id);

ALTER TABLE public.campaign_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Influencer can insert own application"
  ON public.campaign_applications FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Influencer can read own applications"
  ON public.campaign_applications FOR SELECT
  USING (auth.uid() = from_user_id);

CREATE POLICY "Company can read applications to own campaigns"
  ON public.campaign_applications FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.active_campaigns ac WHERE ac.id = campaign_id AND public.is_company_owner(auth.uid(), ac.company_id)));

CREATE POLICY "Company can update applications to own campaigns (accept/reject)"
  ON public.campaign_applications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.active_campaigns ac WHERE ac.id = campaign_id AND public.is_company_owner(auth.uid(), ac.company_id)));

-- Aceitar candidatura: cria direct_offer (accepted), debita empresa, decrementa vaga
CREATE OR REPLACE FUNCTION public.accept_campaign_application(application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app record;
  camp record;
BEGIN
  SELECT ca.id, ca.campaign_id, ca.from_user_id INTO app FROM public.campaign_applications ca WHERE ca.id = application_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Candidatura não encontrada'); END IF;
  IF app.status != 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'Candidatura já processada'); END IF;
  SELECT ac.id, ac.company_id, ac.title, ac.description, ac.budget_per_influencer, ac.slots_available INTO camp FROM public.active_campaigns ac WHERE ac.id = app.campaign_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Campanha não encontrada'); END IF;
  IF camp.slots_available < 1 THEN RETURN jsonb_build_object('ok', false, 'error', 'Não há mais vagas.'); END IF;
  IF (SELECT influencer_credits_balance FROM public.companies WHERE id = camp.company_id) < camp.budget_per_influencer THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente.');
  END IF;
  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance - camp.budget_per_influencer WHERE id = camp.company_id;
  INSERT INTO public.direct_offers (company_id, to_user_id, amount, description, status)
  VALUES (camp.company_id, app.from_user_id, camp.budget_per_influencer, camp.title || ': ' || COALESCE(camp.description, ''), 'accepted');
  UPDATE public.campaign_applications SET status = 'accepted' WHERE id = application_id;
  UPDATE public.active_campaigns SET slots_available = slots_available - 1 WHERE id = camp.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
