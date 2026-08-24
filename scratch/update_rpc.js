import pg from "pg";
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:123456@localhost:5432/supabase_local' });

const sql = `
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
  original_block record;
BEGIN
  SELECT id, from_company_id, to_brand_id, amount, status, block_id INTO b FROM public.position_bids WHERE id = bid_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Lance não encontrado'); END IF;
  IF b.status != 'pending' THEN RETURN jsonb_build_object('ok', false, 'error', 'Lance já processado'); END IF;
  
  SELECT influencer_credits_balance INTO buyer_balance FROM public.companies WHERE id = b.from_company_id;
  IF buyer_balance IS NULL OR buyer_balance < b.amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente');
  END IF;

  seller_share := round(b.amount * 0.70, 2);
  platform_share := b.amount - seller_share;

  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance - b.amount WHERE id = b.from_company_id;
  UPDATE public.companies SET influencer_credits_balance = influencer_credits_balance + seller_share WHERE id = b.to_brand_id;
  
  INSERT INTO public.system_profit (amount, source, reference_id) VALUES (platform_share, 'position_bid', bid_id);

  IF b.block_id IS NOT NULL THEN
    SELECT x, y INTO original_block FROM public.blocks WHERE id = b.block_id;
    UPDATE public.blocks SET company_id = b.from_company_id, purchase_price = b.amount, status = 'occupied' WHERE id = b.block_id;
    
    -- HOT ZONE: Increase neighbors by 5%
    UPDATE public.blocks 
    SET purchase_price = purchase_price * 1.05 
    WHERE x >= original_block.x - 2 AND x <= original_block.x + 2 
      AND y >= original_block.y - 2 AND y <= original_block.y + 2
      AND id != b.block_id;
  ELSE
    UPDATE public.blocks SET company_id = b.from_company_id WHERE company_id = b.to_brand_id;
  END IF;

  UPDATE public.position_bids SET status = 'accepted' WHERE id = bid_id;
  
  RETURN jsonb_build_object('ok', true);
END;
$$;
`;

pool.query(sql)
  .then(() => {
    console.log('RPC accept_position_bid updated with Hot Zone logic');
    pool.end();
  })
  .catch(err => {
    console.error(err);
    pool.end();
  });
