import { pool } from "./db.js";
import { userIdFromRequest } from "./jwt.js";

/**
 * E-mail do administrador master.
 *
 * Sem fallback no código: se `MASTER_ADMIN_EMAIL` não estiver definido,
 * `isMasterAdmin` retorna `false` para todo mundo. Um e-mail hardcoded aqui
 * significaria que qualquer pessoa que lesse o repositório saberia exatamente
 * qual conta comprometer para obter acesso administrativo — e a troca de
 * responsável exigiria um deploy.
 */
const MASTER_ADMIN_EMAIL = (process.env.MASTER_ADMIN_EMAIL ?? "").toLowerCase().trim();

if (!MASTER_ADMIN_EMAIL) {
  console.warn(
    "[adminGuard] MASTER_ADMIN_EMAIL não definido — nenhum usuário será " +
      "reconhecido como admin master. Defina no .env para habilitar o painel."
  );
}

function normalizeEmail(email) {
  return (email ?? "").toString().toLowerCase().trim();
}

/**
 * `true` se a requisição vem do administrador master.
 *
 * ⚠️ Correção de segurança crítica: a versão anterior fazia
 *
 *     const payload = JSON.parse(Buffer.from(b64, "base64").toString());
 *     userId = payload.sub;
 *
 * ou seja, decodificava o payload do JWT e confiava nele SEM VERIFICAR A
 * ASSINATURA. O payload de um JWT é apenas base64 — não é criptografado nem
 * protegido. Qualquer pessoa podia montar
 *
 *     <qualquer>.<base64 de {"sub":"<id-do-admin>"}>.<qualquer>
 *
 * e obter acesso total ao painel administrativo. Agora o token passa por
 * `verifyJwt`, que confere o HMAC antes de devolver qualquer dado.
 */
export async function isMasterAdmin(req) {
  if (!MASTER_ADMIN_EMAIL) return false;

  const userId = userIdFromRequest(req);
  if (!userId) return false;

  try {
    const { rows } = await pool.query(
      "SELECT email FROM public.profiles WHERE id = $1 OR user_id = $1",
      [userId]
    );
    return normalizeEmail(rows[0]?.email) === MASTER_ADMIN_EMAIL;
  } catch (err) {
    // Falha ao consultar o banco nunca pode virar "acesso liberado".
    console.error("[adminGuard] falha ao verificar admin:", err.message);
    return false;
  }
}
