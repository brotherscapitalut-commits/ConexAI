import { pool } from "./server/db.js";

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS position_value numeric NOT NULL DEFAULT 0;`);
    console.log("Added column position_value");

    await client.query(`
CREATE OR REPLACE FUNCTION public.accept_position_bid(bid_id uuid)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  DECLARE 
    b record; 
    buyer_balance numeric; 
    seller_share numeric; 
    platform_share numeric;
    temp_uuid uuid := gen_random_uuid();
    buyer_old_pos_val numeric;
  BEGIN
    SELECT id, from_company_id, to_brand_id, amount, status INTO b FROM public.position_bids WHERE id = bid_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Lance não encontrado'); END IF;
    IF b.status != 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'Lance já processado'); END IF;
    IF b.from_company_id = b.to_brand_id THEN RETURN jsonb_build_object('ok', false, 'error', 'Não pode dar lance na própria marca'); END IF;

    SELECT influencer_credits_balance, position_value INTO buyer_balance, buyer_old_pos_val FROM public.companies WHERE id = b.from_company_id;
    IF buyer_balance IS NULL OR buyer_balance < b.amount THEN RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente'); END IF;

    seller_share := round(b.amount * 0.70, 2);
    platform_share := b.amount - seller_share;

    UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance - b.amount WHERE id = b.from_company_id;
    UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance + seller_share WHERE id = b.to_brand_id;
    INSERT INTO public.system_profit (amount, source, reference_id) VALUES (platform_share, 'position_bid', bid_id);

    -- Swap Blocks Logic
    UPDATE public.blocks SET company_id = temp_uuid WHERE company_id = b.from_company_id;
    UPDATE public.blocks SET company_id = b.from_company_id WHERE company_id = b.to_brand_id;
    UPDATE public.blocks SET company_id = b.to_brand_id WHERE company_id = temp_uuid;

    -- Update position values
    UPDATE public.companies SET position_value = buyer_old_pos_val WHERE id = b.to_brand_id;
    UPDATE public.companies SET position_value = b.amount WHERE id = b.from_company_id;

    UPDATE public.position_bids SET status = 'accepted' WHERE id = bid_id;

    RETURN jsonb_build_object('ok', true, 'seller_share', seller_share, 'platform_share', platform_share);
  END; $$;
    `);
    console.log("Updated function accept_position_bid");
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
