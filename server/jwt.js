import { createHmac, timingSafeEqual } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Emissão e verificação de JWT (HS256)
//
// Este módulo é a ÚNICA fonte de verdade sobre tokens. Ele existe separado de
// `index.js` porque `index.js` importa `adminGuard.js` — se o guard importasse
// de volta o `index.js` para verificar tokens, teríamos import circular. Foi
// exatamente essa fricção que levou o `adminGuard` a implementar sua própria
// "verificação", que na prática apenas decodificava o payload sem checar a
// assinatura, permitindo que qualquer pessoa se declarasse admin.
// ─────────────────────────────────────────────────────────────────────────────

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Segredo de assinatura.
 *
 * Em produção é OBRIGATÓRIO definir `JWT_SECRET`. O fallback anterior derivava
 * o segredo do `DATABASE_URL` com uma chave fixa no código — qualquer pessoa
 * com acesso ao repositório (ou que adivinhasse a URL padrão do banco) poderia
 * reproduzir o segredo e assinar tokens válidos. Preferimos derrubar o
 * processo no boot a subir uma API com sessões forjáveis.
 */
function resolveSecret() {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  if (IS_PRODUCTION) {
    throw new Error(
      "JWT_SECRET ausente ou curto demais (mínimo 32 caracteres). " +
        "Defina JWT_SECRET no ambiente antes de iniciar em produção. " +
        "Gere um com: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }

  if (fromEnv) {
    console.warn("[jwt] JWT_SECRET tem menos de 32 caracteres — aceito apenas fora de produção.");
    return fromEnv;
  }

  // Desenvolvimento: segredo aleatório por processo. Reiniciar o servidor
  // invalida as sessões, o que é o comportamento correto — um segredo estável
  // e previsível em dev acaba virando o segredo de produção por descuido.
  const ephemeral = createHmac("sha256", "nexus-dev")
    .update(String(process.pid) + Date.now() + Math.random())
    .digest("hex");
  console.warn(
    "[jwt] JWT_SECRET não definido. Usando segredo efêmero de desenvolvimento — " +
      "as sessões serão invalidadas a cada reinício do servidor."
  );
  return ephemeral;
}

const JWT_SECRET = resolveSecret();

export const JWT_EXPIRY_SECS = 60 * 60 * 24 * 7; // 7 dias

function b64url(str) {
  return Buffer.from(str).toString("base64url");
}

function computeSignature(header, body) {
  return createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
}

export function signJwt(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.${computeSignature(header, body)}`;
}

/**
 * Comparação de assinaturas resistente a timing attack.
 *
 * `a !== b` retorna assim que encontra o primeiro byte diferente, e essa
 * diferença de tempo é mensurável pela rede — permite reconstruir a assinatura
 * byte a byte. `timingSafeEqual` sempre percorre o buffer inteiro.
 */
function signaturesMatch(expected, received) {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  // `timingSafeEqual` lança se os tamanhos diferem; comparar antes é seguro
  // porque o comprimento da assinatura não é segredo.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Verifica um token e devolve o payload, ou `null` se inválido.
 *
 * Não existe caminho que pule a verificação de assinatura. A versão anterior
 * tratava a assinatura literal `"local"` como válida "por compatibilidade com
 * dev" — o que significava que bastava terminar qualquer token com `.local`
 * para forjar a identidade de qualquer usuário, inclusive a do admin.
 */
export function verifyJwt(token) {
  try {
    if (typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts;
    if (!header || !body || !sig) return null;

    if (!signaturesMatch(computeSignature(header, body), sig)) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));

    // Só aceitamos HS256 — evita que um token declare `alg: none` e seja aceito
    // caso a verificação acima algum dia seja refatorada.
    const decodedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
    if (decodedHeader?.alg !== "HS256") return null;

    if (typeof payload?.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** Extrai o `sub` (id do usuário) de um Bearer token verificado. */
export function userIdFromRequest(req) {
  const auth = req.headers?.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyJwt(auth.slice(7))?.sub ?? null;
}

export function issueSession(user) {
  return signJwt({
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY_SECS,
  });
}
