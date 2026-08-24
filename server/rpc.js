import { pool } from "./db.js";

const RPC_MAP = {
  accept_partnership_proposal: "proposal_id",
  release_proposal_payment: "proposal_id",
  accept_position_bid: "bid_id",
  accept_direct_offer: "offer_id",
  release_direct_offer: "offer_id",
  accept_campaign_application: "application_id",
  request_withdrawal: ["amount_to_withdraw", "pix_key", "pix_key_type"],
};

export async function callRpc(name, body, userId) {
  const params = RPC_MAP[name];
  if (!params) return { data: null, error: { message: "RPC não encontrada" } };
  const args = Array.isArray(params)
    ? params.map((p) => body[p])
    : [body[params]];
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `SELECT public.${name}(${placeholders}) AS result`;
  const client = await pool.connect();
  try {
    if (userId) await client.query("SET LOCAL app.current_user_id = $1", [userId]);
    const result = await client.query(sql, args);
    const data = result.rows[0]?.result ?? null;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  } finally {
    client.release();
  }
}
