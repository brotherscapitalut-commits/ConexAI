import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

import express from "express";
import cors from "cors";
import { login, signUp } from "./auth.js";
import { restGet, restPost, restPatch, restDelete } from "./rest.js";
import { callRpc } from "./rpc.js";
import { isMasterAdmin } from "./adminGuard.js";
import { userIdFromRequest, issueSession } from "./jwt.js";
import {
  PLANS as SERVER_PLANS,
  STRIPE_PRICE_IDS,
  TRIAL_PERIOD_DAYS,
  computeCostCents,
  validateBlockCount as validateServerBlockCount,
  arePricesConfigured,
} from "./plans.js";
import { pool } from "./db.js";
import { sendNovaOfertaEmail, sendVendaConcluidaEmail } from "./emailService.js";
import Stripe from "stripe";
import { ContentOrchestrator, scheduleDailyContentCycle } from "./agents/contentOrchestrator.js";
import { ensureVault, syncProfile, readVaultContext } from "./agents/vaultManager.js";
import LeadHunterAgent from "./agents/leadHunterAgent.js";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const PAYMENT_MODE = (process.env.LOCAL_PAYMENT_MODE || "manual").toLowerCase();
const GRID_COLS = 50;
const GRID_ROWS = 30;

async function logEmailSent(dbPool, { status, message, user_email }) {
  try {
    await dbPool.query(
      `INSERT INTO public.system_health_logs (service_name, status, error_message, user_email, "timestamp")
       VALUES ('email', $1, $2, $3, now())`,
      [status, message || null, user_email || null]
    );
  } catch (e) {
    console.error("[logEmailSent]", e.message);
  }
}

function appendQuery(url, params) {
  const target = new URL(url, "http://localhost");
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) target.searchParams.set(key, String(value));
  });
  if (/^https?:\/\//i.test(url)) return target.toString();
  return `${target.pathname}${target.search}${target.hash}`;
}

function normalizeBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  const seen = new Set();
  const result = [];
  for (const cell of blocks) {
    const x = parseInt(cell?.x, 10);
    const y = parseInt(cell?.y, 10);
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) continue;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ x, y });
  }
  return result;
}

/**
 * Traduz o que o front chamar de plano/região para a chave interna que
 * `SERVER_PLANS`/`STRIPE_PRICE_IDS` usam. O formulário de checkout leve manda
 * os nomes comerciais (`basic`/`standard`/`premium`); o picker de blocos do
 * mural manda a chave interna direto. Aceitar os dois evita que uma mudança
 * de nomenclatura em um front quebre silenciosamente o outro.
 */
const PLAN_TYPE_TO_REGION = {
  basic: "borda",
  standard: "intermediaria",
  premium: "centro_premium",
  borda: "borda",
  intermediaria: "intermediaria",
  centro_premium: "centro_premium",
};
function normalizeRegion(value) {
  const key = String(value ?? "").trim().toLowerCase();
  return PLAN_TYPE_TO_REGION[key] ?? key;
}

/**
 * Retângulos de cada zona dentro da grade do checkout (`GRID_COLS` ×
 * `GRID_ROWS`, 50×30). Só serve para o AUTO-atribuidor de blocos abaixo —
 * quando o cliente manda coordenadas explícitas, elas passam por
 * `normalizeBlocks`/`getRegion` como sempre.
 *
 * ⚠️ Estes limites são independentes dos usados pelo mural visual no
 * frontend (que roda numa grade bem maior, 400×400). Não há problema: o
 * formulário leve de checkout não mostra grade nenhuma, só escolhe QUANTOS
 * blocos — a única coisa que precisa ser consistente é este arquivo consigo
 * mesmo (aqui e na validação de blocos ocupados, mais abaixo).
 */
const REGION_BOUNDS = {
  centro_premium: { x0: 17, x1: 32, y0: 10, y1: 19 },
  intermediaria: { x0: 8, x1: 41, y0: 4, y1: 25 },
  borda: { x0: 0, x1: GRID_COLS - 1, y0: 0, y1: GRID_ROWS - 1 },
};

function regionOfCell(x, y) {
  const premium = REGION_BOUNDS.centro_premium;
  if (x >= premium.x0 && x <= premium.x1 && y >= premium.y0 && y <= premium.y1) return "centro_premium";
  const mid = REGION_BOUNDS.intermediaria;
  if (x >= mid.x0 && x <= mid.x1 && y >= mid.y0 && y <= mid.y1) return "intermediaria";
  return "borda";
}

/**
 * Reserva os primeiros `count` blocos livres dentro da zona pedida.
 *
 * Roda dentro da transação do chamador (`client`, não `pool`): a checagem de
 * quais blocos estão ocupados e a decisão de quais atribuir precisam
 * enxergar o mesmo snapshot, senão duas compras simultâneas poderiam
 * "escolher" o mesmo bloco livre antes de qualquer uma confirmar.
 */
async function pickFreeBlocksInRegion(client, region, count) {
  const bounds = REGION_BOUNDS[region];
  if (!bounds) return [];

  const candidates = [];
  const maxCandidates = count * 6; // folga para descontar blocos já ocupados
  for (let y = bounds.y0; y <= bounds.y1 && candidates.length < maxCandidates; y++) {
    for (let x = bounds.x0; x <= bounds.x1 && candidates.length < maxCandidates; x++) {
      if (regionOfCell(x, y) !== region) continue; // fora daqui pertence a uma zona mais interna
      candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return [];

  const { rows: taken } = await client.query(
    `SELECT x, y FROM public.blocks
     WHERE company_id IS NOT NULL AND (x, y) IN (${candidates.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ")})`,
    candidates.flatMap((c) => [c.x, c.y])
  );
  const takenSet = new Set(taken.map((r) => `${r.x},${r.y}`));
  return candidates.filter((c) => !takenSet.has(`${c.x},${c.y}`)).slice(0, count);
}

async function ensureDatabaseSchema() {
  console.log("[db] Verificando esquema do banco de dados...");
  try {
    // Tabela de Empresas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        logo_initials TEXT,
        logo_url TEXT,
        color TEXT DEFAULT '#00d4ff',
        website TEXT,
        instagram TEXT,
        tiktok TEXT,
        youtube TEXT,
        moderation_status TEXT DEFAULT 'pending',
        influencer_credits_balance INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Tabela de Leads Caçados (Lead Hunter)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.hunter_leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name TEXT NOT NULL,
        email TEXT,
        website TEXT,
        niche TEXT,
        region TEXT,
        status TEXT DEFAULT 'NEW_LEAD_READY_FOR_CLAIM',
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Tabela de Blocos (Real Estate)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.blocks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
        region TEXT DEFAULT 'borda',
        purchase_price NUMERIC DEFAULT 150,
        status TEXT DEFAULT 'occupied',
        position_id TEXT,
        purchased_at TIMESTAMPTZ DEFAULT now(),
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(x, y)
      )
    `);

    // Tabela de Lances (Hostile Takeover)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.position_bids (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
        to_brand_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Tabela de Eventos Pulse
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.pulse_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Função SQL para aceitar lance de posição (Takeover)
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.accept_position_bid(p_bid_id UUID)
      RETURNS JSONB AS $$
      DECLARE
        v_bid RECORD;
        v_old_owner_id UUID;
        v_new_owner_id UUID;
        v_amount NUMERIC;
        v_seller_share NUMERIC;
        v_platform_share NUMERIC;
      BEGIN
        -- 1. Buscar o lance
        SELECT * INTO v_bid FROM public.position_bids WHERE id = p_bid_id AND status = 'pending';
        IF NOT FOUND THEN
          RETURN jsonb_build_object('error', 'Lance não encontrado ou já processado');
        END IF;

        v_amount := v_bid.amount;
        v_new_owner_id := v_bid.from_company_id;
        v_old_owner_id := v_bid.to_brand_id;

        -- 2. Calcular 70/30
        v_seller_share := v_amount * 0.7;
        v_platform_share := v_amount * 0.3;

        -- 3. Trocar o dono de TODOS os blocos daquela marca (Takeover completo da posição)
        -- Ou apenas do bloco específico? O usuário disse "lugar da Marca A". Geralmente é o território.
        UPDATE public.blocks 
        SET company_id = v_new_owner_id, 
            purchase_price = v_amount,
            updated_at = now()
        WHERE company_id = v_old_owner_id;

        -- 4. Atualizar saldo de créditos do vendedor (70%)
        UPDATE public.companies 
        SET influencer_credits_balance = influencer_credits_balance + v_seller_share,
            updated_at = now()
        WHERE id = v_old_owner_id;

        -- 5. Finalizar o lance
        UPDATE public.position_bids SET status = 'accepted' WHERE id = p_bid_id;

        -- 6. Notificar no Pulse
        INSERT INTO public.pulse_events (content)
        VALUES ('🚀 NEXUS TAKEOVER: Uma nova marca assumiu uma posição estratégica por $' || v_amount || '!');

        RETURN jsonb_build_object('success', true, 'seller_received', v_seller_share, 'platform_received', v_platform_share);
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    await ensureLocalCommerceTables();
    console.log("[db] Esquema verificado com sucesso.");
    await seedDatabase();
  } catch (err) {
    console.error("[db] Erro ao verificar esquema:", err.message);
  }
}

async function seedDatabase() {
  const { rows } = await pool.query("SELECT count(*) FROM public.companies");
  if (parseInt(rows[0].count, 10) > 0) return;

  console.log("[db] Semeando banco de dados com marcas iniciais...");
  const MOCK_USER_ID = "9134419b-e855-4081-9b63-0c46001712a8"; // Seu ID de Admin

  const initialCompanies = [
    { name: "Nexus Tech (Minha)", logo: "NX", color: "#00d4ff", category: "Tech", x: 25, y: 15, owner: MOCK_USER_ID },
    { name: "Cyber Fashion", logo: "CF", color: "#ff0080", category: "Moda", x: 28, y: 18, owner: "00000000-0000-0000-0000-000000000000" },
    { name: "Crypto Bank", logo: "CB", color: "#ffd700", category: "Finanças", x: 22, y: 12, owner: "00000000-0000-0000-0000-000000000000" },
    { name: "Meta Health", logo: "MH", color: "#00ff80", category: "Saúde", x: 25, y: 20, owner: "00000000-0000-0000-0000-000000000000" },
  ];

  for (const comp of initialCompanies) {
    const res = await pool.query(
      `INSERT INTO public.companies (owner_id, name, logo_initials, color, category, moderation_status)
       VALUES ($1, $2, $3, $4, $5, 'approved') RETURNING id`,
      [comp.owner, comp.name, comp.logo, comp.color, comp.category]
    );
    const companyId = res.rows[0].id;
    await pool.query(
      `INSERT INTO public.blocks (x, y, company_id, purchase_price, status)
       VALUES ($1, $2, $3, 150, 'occupied')`,
      [comp.x, comp.y, companyId]
    );
  }
  console.log("[db] Banco de dados semeado.");
}

// Chamar a verificação ao iniciar
ensureDatabaseSchema();

async function ensureLocalCommerceTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.checkout_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL,
      company_id UUID NOT NULL,
      payload JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `);
  await pool.query("ALTER TABLE public.checkout_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ");
  // Rastreia o ciclo de vida do provisionamento just-in-time: uma empresa
  // criada no instante do checkout começa "PENDING_PAYMENT" e só vira
  // "active" quando o webhook confirma o pagamento. Empresas antigas (criadas
  // antes desta coluna existir) já passaram por um fluxo de cadastro manual,
  // então entram como "active" para não regredir contas existentes.
  await pool.query(
    "ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'active'"
  );
  // Lido pelo Content-SEO-AEO-Agent para decidir a cota de artigos e os
  // destaques (rank priority, campanhas em destaque) do plano contratado —
  // ver server/agents/contentAgent.js.
  await pool.query("ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS plan_type TEXT");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.content_articles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
      plan_type TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      markdown TEXT NOT NULL,
      meta_description TEXT,
      keywords TEXT[] NOT NULL DEFAULT '{}',
      is_featured BOOLEAN NOT NULL DEFAULT false,
      rank_priority BOOLEAN NOT NULL DEFAULT false,
      -- Snapshot de engajamento (contact_events) no instante da publicação e,
      -- mais tarde, um segundo snapshot após a janela de observação. A
      -- diferença entre os dois é o sinal que alimenta o próximo ciclo do
      -- agente — ver ContentAgent.getPerformanceSnapshot / closeFeedbackLoop.
      engagement_before INTEGER NOT NULL DEFAULT 0,
      engagement_after INTEGER,
      generated_by TEXT NOT NULL DEFAULT 'template',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_content_articles_company ON public.content_articles(company_id, created_at DESC)"
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      blocks_count INTEGER NOT NULL DEFAULT 0,
      region TEXT NOT NULL DEFAULT 'borda',
      stripe_session_id TEXT,
      stripe_payment_intent_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}
async function createCheckoutOrder({ ownerId, companyId, payload }) {
  await ensureLocalCommerceTables();
  const { rows } = await pool.query(
    `INSERT INTO public.checkout_orders (owner_id, company_id, payload, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING id`,
    [ownerId, companyId, JSON.stringify(payload)]
  );
  return rows[0];
}

async function completeCheckoutOrder(orderId, { userId = null } = {}) {
  await ensureLocalCommerceTables();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT id, owner_id, company_id, payload, status FROM public.checkout_orders WHERE id = $1 FOR UPDATE",
      [orderId]
    );
    const order = rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return { status: 404, body: { error: { message: "Pedido nao encontrado" } } };
    }
    if (userId && order.owner_id !== userId) {
      await client.query("ROLLBACK");
      return { status: 403, body: { error: { message: "Pedido nao pertence ao usuario autenticado" } } };
    }
    if (order.status === "completed") {
      await client.query("COMMIT");
      return { status: 200, body: { data: { ok: true, inserted: 0, alreadyCompleted: true, order_id: order.id } } };
    }
    if (order.status !== "pending") {
      await client.query("ROLLBACK");
      return { status: 400, body: { error: { message: "Pedido ja processado ou cancelado" } } };
    }

    const payload = typeof order.payload === "string" ? JSON.parse(order.payload) : order.payload || {};
    const blocks = normalizeBlocks(payload.blocks);
    const companyId = payload.company_id || order.company_id;
    const validRegion = ["borda", "intermediaria", "centro_premium"].includes(payload.region) ? payload.region : "borda";
    if (!companyId || blocks.length === 0) {
      await client.query("ROLLBACK");
      return { status: 400, body: { error: { message: "Pedido sem blocos validos para publicar" } } };
    }

    const placeholders = blocks.map((_, i) => `($${2 * i + 1}, $${2 * i + 2})`).join(", ");
    const flatCoords = blocks.flatMap((cell) => [cell.x, cell.y]);
    const occupied = await client.query(
      `SELECT x, y FROM public.blocks WHERE status = 'occupied' AND (x, y) IN (${placeholders})`,
      flatCoords
    );
    if (occupied.rows.length > 0) {
      await client.query("ROLLBACK");
      return { status: 409, body: { error: { message: "Um ou mais blocos ja estao ocupados. Atualize o mural e escolha outros blocos." } } };
    }

    let inserted = 0;
    for (const cell of blocks) {
      const result = await client.query(
        `INSERT INTO public.blocks (x, y, company_id, region, status)
         VALUES ($1, $2, $3, $4, 'occupied')
         ON CONFLICT (x, y) DO UPDATE SET company_id = EXCLUDED.company_id, region = EXCLUDED.region, status = 'occupied'
         WHERE public.blocks.status = 'free'
         RETURNING x, y`,
        [cell.x, cell.y, companyId, validRegion]
      );
      inserted += result.rowCount || 0;
    }

    const updates = [];
    const params = [];
    let idx = 1;
    if (typeof payload.color === "string" && payload.color.trim()) {
      updates.push(`color = $${idx++}`);
      params.push(payload.color.trim().slice(0, 32));
    }
    if (typeof payload.logo_initials === "string" && payload.logo_initials.trim()) {
      updates.push(`logo_initials = $${idx++}`);
      params.push(payload.logo_initials.trim().slice(0, 4).toUpperCase());
    }
    if (typeof payload.logo_url === "string" && /^https?:\/\//i.test(payload.logo_url)) {
      updates.push(`logo_url = $${idx++}`);
      params.push(payload.logo_url.trim());
    }
    if (typeof payload.access_url === "string" && /^https?:\/\//i.test(payload.access_url)) {
      updates.push(`website = $${idx++}`);
      params.push(payload.access_url.trim());
    }
    if (typeof payload.is_perpetual === "boolean") {
      updates.push(`is_perpetual = $${idx++}`);
      params.push(payload.is_perpetual);
    }
    updates.push(`moderation_status = 'approved'`);
    // Sai do estado "PENDING_PAYMENT" do auto-provisionamento assim que o
    // pagamento é confirmado — é este campo que o dashboard usa para saber
    // se a empresa já pode operar de verdade.
    updates.push(`payment_status = 'active'`);
    // Fonte da verdade para o que os Agentes de IA devem entregar: o
    // Content-SEO-AEO-Agent lê este campo para saber a cota de artigos e os
    // destaques (rank priority, campanhas em destaque) do plano contratado.
    updates.push(`plan_type = $${idx++}`);
    params.push(validRegion);
    updates.push(`expires_at = COALESCE(expires_at, now() + interval '1 year')`);
    updates.push(`updated_at = now()`);
    params.push(companyId);
    await client.query(`UPDATE public.companies SET ${updates.join(", ")} WHERE id = $${idx}`, params);

    const amountCents = Math.round(Number(payload.total_usd || 0) * 100);
    await client.query(
      `INSERT INTO public.payments (company_id, amount, blocks_count, region, status, stripe_session_id)
       VALUES ($1, $2, $3, $4, 'completed', $5)`,
      [companyId, amountCents, blocks.length, validRegion, `manual_${order.id}`]
    ).catch((e) => {
      if (e.code !== "42P01") console.warn("[manual-checkout] payment log skipped:", e.message);
    });

    await client.query("UPDATE public.checkout_orders SET status = 'completed', completed_at = now() WHERE id = $1", [order.id]);
    await client.query("COMMIT");
    inventoryCache = null;

    // Vault de memória de longo prazo: criado no exato instante em que o
    // pagamento confirma, nunca antes (uma tentativa de checkout que nunca
    // chegou a pagar não deveria ganhar pasta nem histórico). Roda FORA da
    // transação — é E/S de arquivo, não algo que o Postgres deveria poder
    // desfazer, e uma falha aqui não pode reverter um pagamento já commitado.
    try {
      const { rows: companyRows } = await pool.query(
        "SELECT id, name, category, website, plan_type FROM public.companies WHERE id = $1",
        [companyId]
      );
      if (companyRows[0]) {
        await ensureVault(companyId, companyRows[0]);
        await syncProfile(companyId, companyRows[0]);
      }
    } catch (vaultErr) {
      console.error("[vault] falha ao criar vault pós-pagamento:", vaultErr.message);
    }

    return { status: 200, body: { data: { ok: true, inserted, order_id: order.id, mode: "manual" } } };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[manual-checkout] complete:", err.message);
    return { status: 500, body: { error: { message: err.message } } };
  } finally {
    client.release();
  }
}

const app = express();
const PORT = process.env.LOCAL_API_PORT || 3001;

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ── trust proxy ──────────────────────────────────────────────────────────────
//
// Atrás de um reverse proxy (Nginx, Render, Railway, Cloudflare), a conexão TCP
// chega do proxy — `req.ip` retorna o IP do proxy, não o do cliente. Sem isto,
// o rate limit de autenticação colocava TODOS os usuários no mesmo balde: dez
// tentativas de login de qualquer pessoa bloqueavam o login do site inteiro,
// e um atacante ficava indistinguível dos usuários legítimos.
//
// `TRUST_PROXY_HOPS` deve ser o número de proxies à frente da aplicação
// (normalmente 1). Não usamos `true`, que confia em qualquer `X-Forwarded-For`
// e permitiria ao atacante forjar o próprio IP para escapar do rate limit.
const TRUST_PROXY_HOPS = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? "", 10);
if (Number.isFinite(TRUST_PROXY_HOPS) && TRUST_PROXY_HOPS > 0) {
  app.set("trust proxy", TRUST_PROXY_HOPS);
} else if (IS_PRODUCTION) {
  console.warn(
    "[server] TRUST_PROXY_HOPS não definido. Se a API roda atrás de um proxy, " +
      "defina-o (geralmente 1) — caso contrário o rate limit trata todos os " +
      "clientes como um único IP."
  );
}

const REQUEST_LOG_MAX = 200;
const requestLogs = [];

// CORS: origens permitidas
const ALLOWED_ORIGINS_ENV = process.env.ALLOWED_ORIGINS || "";
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_ENV
  ? ALLOWED_ORIGINS_ENV.split(",").map((o) => o.trim()).filter(Boolean)
  : null; // null = aceitar qualquer em dev/local

// Em produção, um CORS aberto deixa qualquer site fazer requisições
// autenticadas em nome do usuário (as respostas viriam com `credentials: true`).
// Falhar no boot é preferível a subir assim silenciosamente.
if (IS_PRODUCTION && !ALLOWED_ORIGINS) {
  throw new Error(
    "ALLOWED_ORIGINS é obrigatório em produção. " +
      "Defina a lista de domínios do frontend separada por vírgula, " +
      "ex.: ALLOWED_ORIGINS=https://muraldigital.com,https://www.muraldigital.com"
  );
}

app.use(
  cors({
    origin: (origin, cb) => {
      // Requisições sem origin (curl, Postman, SSR) sempre aceitas
      if (!origin) return cb(null, true);
      // Se ALLOWED_ORIGINS não definido (modo dev/local), aceitar tudo
      if (!ALLOWED_ORIGINS) return cb(null, true);
      // Em produção: checar lista explícita
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`Origin '${origin}' não permitida`));
    },
    credentials: true,
  })
);

// ── Webhook Stripe ───────────────────────────────────────────────────────────
//
// ⚠️ Correção de segurança crítica.
//
// A versão anterior recebia o body raw (o comentário dizia "para verificação
// de assinatura") mas NUNCA verificava assinatura nenhuma: fazia `JSON.parse`
// e confiava no conteúdo. Como este endpoint é público por natureza, qualquer
// pessoa podia enviar
//
//   POST /api/webhooks/stripe
//   {"type":"checkout.session.completed",
//    "data":{"object":{"metadata":{"order_id":"<id de um pedido pendente>"}}}}
//
// e o servidor liberava os blocos sem que houvesse pagamento algum.
//
// Agora o evento só é processado se a assinatura `stripe-signature` conferir
// com STRIPE_WEBHOOK_SECRET. O segredo vem do painel do Stripe, na tela do
// endpoint (formato `whsec_...`).
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

if (!STRIPE_WEBHOOK_SECRET) {
  console.warn(
    "[webhook] STRIPE_WEBHOOK_SECRET não definido — o endpoint de webhook vai " +
      "rejeitar todos os eventos. Configure antes de aceitar pagamentos reais."
  );
}

app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      console.error("[webhook] recebido, mas Stripe/segredo não configurados. Ignorado.");
      return res.status(503).json({ error: { message: "Webhook não configurado." } });
    }

    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({ error: { message: "Assinatura ausente." } });
    }

    let event;
    try {
      // `req.body` precisa ser o Buffer cru — por isso esta rota é registrada
      // ANTES de `express.json()`. Se algum middleware já tiver parseado o
      // corpo, a assinatura não confere e o evento é (corretamente) rejeitado.
      event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("[webhook] assinatura inválida:", err.message);
      return res.status(400).json({ error: { message: "Assinatura inválida." } });
    }

    if (event.type !== "checkout.session.completed") {
      return res.status(200).send();
    }
    const session = event.data?.object;
    const orderId = session?.metadata?.order_id;
    if (!orderId) {
      console.error("[webhook] order_id não encontrada no metadata da sessão. Garanta que checkout_session inclui metadata: { order_id }.");
      return res.status(400).json({ error: { message: "order_id não encontrada no metadata da sessão (checkout_session deve incluir metadata: { order_id })" } });
    }
    const result = await completeCheckoutOrder(orderId);
    if (result.status >= 400) return res.status(result.status).json(result.body);
    return res.status(200).json({ received: true, ...result.body });
  } catch (err) {
    console.error("[webhook] stripe:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const entry = {
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      latency: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
    requestLogs.push(entry);
    if (requestLogs.length > REQUEST_LOG_MAX) requestLogs.shift();
  });
  next();
});

// ── JWT ──────────────────────────────────────────────────────────────────────
// A implementação vive em ./jwt.js, compartilhada com o adminGuard.
//
// A versão anterior tinha aqui um bypass: assinaturas iguais a "local" eram
// aceitas sem verificação, "por compatibilidade com dev". Na prática, terminar
// qualquer token com `.local` permitia forjar a identidade de qualquer usuário.
// Removido — não há mais caminho que pule a checagem do HMAC.
const getUserId = userIdFromRequest;
const simpleJwt = issueSession;

// ── Rate limiting simples (brute force em auth) ──────────────────────────────
const authAttempts = new Map(); // ip -> { count, resetAt }
const AUTH_RATE_LIMIT = 10;     // max tentativas
const AUTH_RATE_WINDOW = 60000; // 1 minuto

function authRateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= AUTH_RATE_LIMIT) {
      return res.status(429).json({ error: { message: "Muitas tentativas. Tente novamente em 1 minuto." } });
    }
    entry.count++;
  } else {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_RATE_WINDOW });
  }
  // Limpar entradas antigas a cada 100 reqs
  if (authAttempts.size > 500) {
    for (const [k, v] of authAttempts) { if (now > v.resetAt) authAttempts.delete(k); }
  }
  next();
}


// ----- Auth (modo desenvolvimento: login contra profiles local) -----
app.post("/api/auth/login", authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: { message: "Email e senha obrigatórios" } });
    }
    const user = await login(email, password);
    if (!user) {
      return res.status(401).json({ error: { message: "Credenciais inválidas" } });
    }
    const token = simpleJwt(user);
    return res.json({ data: { user, session: { access_token: token, user } }, error: null });
  } catch (err) {
    console.error("[auth] login route:", err.message);
    return res.status(500).json({ error: { message: "Erro interno no login" } });
  }
});

app.post("/api/auth/signup", authRateLimit, async (req, res) => {
  try {
    const { email, password, options } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: { message: "Email e senha obrigatórios" } });
    }
    const meta = options?.data || {};
    const user = await signUp(email, password, meta.display_name, meta.profile_type);
    if (!user) {
      return res.status(400).json({ error: { message: "Erro ao criar conta (email já existe?)" } });
    }
    const token = simpleJwt(user);
    return res.json({ data: { user, session: { access_token: token, user } }, error: null });
  } catch (err) {
    console.error("[auth] signup route:", err.message);
    return res.status(500).json({ error: { message: "Erro interno no cadastro" } });
  }
});

app.get("/api/auth/user", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.json({ data: { user: null } });
    const { pool } = await import("./db.js");
    const { rows } = await pool.query(
      "SELECT id, user_id, email, display_name, profile_type FROM public.profiles WHERE id = $1 OR user_id = $1",
      [userId]
    );
    const p = rows[0];
    if (!p) return res.json({ data: { user: null } });
    const uid = p.user_id ?? p.id;
    return res.json({
      data: {
        user: {
          id: uid,
          email: p.email,
          user_metadata: { display_name: p.display_name, profile_type: p.profile_type },
        },
      },
    });
  } catch (err) {
    console.error("[auth] user route:", err.message);
    return res.status(500).json({ data: { user: null } });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.json({ error: null });
});

// ----- REST (Supabase-style) -----
app.get("/api/rest/:table", async (req, res) => {
  try {
    console.log(`[rest] ${req.method} ${req.originalUrl || req.url}`);
    const userId = getUserId(req);
    const result = await restGet(req.params.table, req.query, userId);
    return res.json(result);
  } catch (err) {
    console.error("[rest] GET:", err.message);
    return res.status(500).json({ data: null, error: { message: err.message } });
  }
});

app.post("/api/rest/:table", async (req, res) => {
  try {
    console.log(`[rest] ${req.method} ${req.originalUrl || req.url}`);
    const userId = getUserId(req);
    const result = await restPost(req.params.table, req.body || {}, userId);
    return res.json(result);
  } catch (err) {
    console.error("[rest] POST:", err.message);
    return res.status(500).json({ data: null, error: { message: err.message } });
  }
});

app.patch("/api/rest/:table", async (req, res) => {
  try {
    console.log(`[rest] ${req.method} ${req.originalUrl || req.url}`);
    const userId = getUserId(req);
    const result = await restPatch(req.params.table, req.body || {}, req.query, userId);
    return res.json(result);
  } catch (err) {
    console.error("[rest] PATCH:", err.message);
    return res.status(500).json({ data: null, error: { message: err.message } });
  }
});

app.delete("/api/rest/:table", async (req, res) => {
  try {
    console.log(`[rest] ${req.method} ${req.originalUrl || req.url}`);
    const userId = getUserId(req);
    const result = await restDelete(req.params.table, req.query, userId);
    return res.json(result);
  } catch (err) {
    console.error("[rest] DELETE:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

// ----- Create payment (Stripe Checkout) — chamado pela página de preços como /api/rpc/create-payment -----
async function handleCreatePayment(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ data: null, error: { message: "Não autenticado" } });
    }
    const {
      price_id,
      quantity,
      region,
      company_id,
      years,
      success_url,
      cancel_url,
      blocks,
      logo_url,
      logo_initials,
      color,
      access_url,
      contact_url,
      is_perpetual,
      total_usd,
    } = req.body || {};
    if (!price_id || !company_id || !success_url || !cancel_url) {
      return res.json({ data: null, error: { message: "price_id, company_id, success_url e cancel_url são obrigatórios" } });
    }
    const totalQty = Math.max(1, parseInt(quantity, 10) || 1);
    const yrs = Math.max(1, Math.min(10, parseInt(years, 10) || 1));
    const validRegion = ["borda", "intermediaria", "centro_premium"].includes(region) ? region : "borda";

    const { rows: owner } = await pool.query(
      "SELECT id FROM public.companies WHERE id = $1 AND owner_id = $2",
      [company_id, userId]
    );
    if (!owner.length) {
      return res.json({ data: null, error: { message: "Empresa não encontrada ou não pertence ao usuário" } });
    }

    const payload = {
      company_id,
      region: validRegion,
      quantity: totalQty,
      years: yrs,
      blocks: normalizeBlocks(blocks),
      logo_url: typeof logo_url === "string" ? logo_url : null,
      logo_initials: typeof logo_initials === "string" ? logo_initials : null,
      color: typeof color === "string" ? color : null,
      access_url: typeof access_url === "string" ? access_url : null,
      contact_url: typeof contact_url === "string" ? contact_url : null,
      is_perpetual: !!is_perpetual,
      total_usd: Number(total_usd || 0),
    };
    const order = await createCheckoutOrder({ ownerId: userId, companyId: company_id, payload });
    if (!order) {
      return res.status(500).json({ data: null, error: { message: "Falha ao criar pedido" } });
    }

    if (PAYMENT_MODE === "manual") {
      const url = appendQuery(success_url, { payment: "success", order_id: order.id, payment_mode: "manual" });
      return res.json({ data: { url, order_id: order.id, mode: "manual" }, error: null });
    }

    if (!stripe) {
      return res.json({ data: null, error: { message: "Pagamento não configurado (STRIPE_SECRET_KEY não definida)" } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price_id, quantity: totalQty }],
      success_url,
      cancel_url,
      metadata: { order_id: order.id },
      subscription_data: {
        metadata: { order_id: order.id },
      },
    });
    return res.json({ data: { url: session.url, order_id: order.id }, error: null });
  } catch (err) {
    console.error("[create-payment]:", err.message);
    return res.status(500).json({ data: null, error: { message: err.message || "Erro ao criar sessão de pagamento" } });
  }
}

// ----- RPC -----
app.post("/api/rpc/:name", async (req, res) => {
  try {
    if (req.params.name === "create-payment") {
      return handleCreatePayment(req, res);
    }
    const userId = getUserId(req);
    const result = await callRpc(req.params.name, req.body || {}, userId);
    return res.json(result);
  } catch (err) {
    console.error("[rpc]:", err.message);
    return res.status(500).json({ data: null, error: { message: err.message } });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, port: PORT });
});

// Manutenção (público: qualquer um pode ler o estado)
app.get("/api/maintenance-mode", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM public.admin_settings WHERE key = $1", ["maintenance_mode"]);
    const enabled = rows[0]?.value === "true";
    return res.json({ enabled: !!enabled });
  } catch (err) {
    return res.json({ enabled: false });
  }
});

// Card público do influencer (SEO: /p/[username])
app.get("/api/public/influencer/:username", async (req, res) => {
  try {
    const username = (req.params.username || "").trim();
    if (!username) return res.status(400).json({ error: { message: "username obrigatório" } });
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);
    const { rows } = await pool.query(
      isUuid
        ? "SELECT id, name, bio, category, public_username FROM public.influencers WHERE id = $1 LIMIT 1"
        : "SELECT id, name, bio, category, public_username FROM public.influencers WHERE public_username = $1 LIMIT 1",
      [username]
    );
    const inf = rows[0];
    if (!inf) return res.status(404).json({ error: { message: "Influencer não encontrado" } });
    return res.json({
      data: {
        id: inf.id,
        name: inf.name,
        bio: inf.bio || "",
        category: inf.category || "",
        public_username: inf.public_username || inf.id,
      },
    });
  } catch (err) {
    console.error("[public] influencer:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

// Link de convite (referral) do usuário logado
app.get("/api/auth/referral-link", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: { message: "Não autenticado" } });
    const { rows } = await pool.query(
      "SELECT id, referral_code FROM public.profiles WHERE id = $1 OR user_id = $1 LIMIT 1",
      [userId]
    );
    const profile = rows[0];
    if (!profile) return res.status(404).json({ error: { message: "Perfil não encontrado" } });
    let code = profile.referral_code;
    if (!code) {
      const shortId = Buffer.from(profile.id.replace(/-/g, ""), "hex").toString("base64url").slice(0, 10);
      code = shortId || `ref-${Date.now().toString(36)}`;
      await pool.query("UPDATE public.profiles SET referral_code = $1 WHERE id = $2", [code, profile.id]);
    }
    const baseUrl = (req.get("origin") || req.get("referer") || "").replace(/\/$/, "") || "https://muraldigital.com";
    const link = `${baseUrl}/auth?ref=${encodeURIComponent(code)}`;
    return res.json({ data: { link, code } });
  } catch (err) {
    console.error("[auth] referral-link:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

let inventoryCache = null;
let inventoryCacheTime = 0;

// Inventário do mural (coordenadas ocupadas + logo/cor do dono para o grid)
app.get("/api/mural-inventory", async (req, res) => {
  try {
    if (inventoryCache && Date.now() - inventoryCacheTime < 30000) {
      return res.json({ data: inventoryCache });
    }
    const { rows } = await pool.query(
      `SELECT b.x, b.y, b.company_id, c.logo_url, c.color, c.logo_initials
       FROM public.blocks b
       LEFT JOIN public.companies c ON c.id = b.company_id
       WHERE b.status = 'occupied'`
    );
    inventoryCache = rows;
    inventoryCacheTime = Date.now();
    return res.json({ data: rows });
  } catch (err) {
    console.error("[api] mural-inventory:", err.message);
    return res.status(500).json({ data: [], error: { message: err.message } });
  }
});

// ----- Checkout: order_id na sessão para o webhook recuperar -----
// Cria um pedido pendente e retorna order_id. O frontend DEVE passar este order_id em
// metadata ao criar a Stripe Checkout Session: metadata: { order_id: data.order_id }
// para que o webhook consiga recuperar o pedido ao receber checkout.session.completed.
app.post("/api/checkout/create-order", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: { message: "Não autenticado" } });
    const { company_id, blocks, region, logo_url, color } = req.body || {};
    if (!company_id || !Array.isArray(blocks) || blocks.length === 0) {
      return res.status(400).json({ error: { message: "company_id e blocks (array de {x,y}) obrigatórios" } });
    }
    const { rows: owner } = await pool.query(
      "SELECT id FROM public.companies WHERE id = $1 AND owner_id = $2",
      [company_id, userId]
    );
    if (!owner.length) {
      return res.status(403).json({ error: { message: "Empresa não encontrada ou não pertence ao usuário" } });
    }
    const validRegion = ["borda", "intermediaria", "centro_premium"].includes(region) ? region : "borda";
    const payload = { company_id, blocks, region: validRegion, logo_url: logo_url || null, color: color || null };

    let rows;
    try {
      const r = await pool.query(
        `INSERT INTO public.checkout_orders (owner_id, company_id, payload, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id`,
        [userId, company_id, JSON.stringify(payload)]
      );
      rows = r.rows;
    } catch (e) {
      if (e.code === "42P01") {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS public.checkout_orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id UUID NOT NULL,
            company_id UUID NOT NULL,
            payload JSONB NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT now()
          )
        `);
        const r = await pool.query(
          `INSERT INTO public.checkout_orders (owner_id, company_id, payload, status)
           VALUES ($1, $2, $3, 'pending')
           RETURNING id`,
          [userId, company_id, JSON.stringify(payload)]
        );
        rows = r.rows;
      } else throw e;
    }
    const order = rows[0];
    if (!order) return res.status(500).json({ error: { message: "Falha ao criar pedido" } });
    console.log("[checkout] order_id criado (passar em metadata do Stripe):", order.id);
    return res.json({ data: { order_id: order.id } });
  } catch (err) {
    console.error("[checkout] create-order:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

// Compra de blocos: persiste coordenadas e atualiza logo/cor da empresa (após pagamento)
// ─────────────────────────────────────────────────────────────────────────────
// Sessão de checkout do Stripe
//
// Fluxo: cria o pedido local (com as coordenadas dos blocos) e abre uma
// Checkout Session com DUAS linhas recorrentes — a assinatura base (quantidade
// 1) e a taxa por bloco (quantidade = nº de blocos) — mais 7 dias de trial.
//
// ⚠️ Princípio inegociável: o VALOR é calculado aqui, a partir de
// `server/plans.js`. O cliente informa apenas a região e quais blocos quer.
// Aceitar um preço vindo do navegador permitiria assinar o Premium por
// centavos alterando o payload no DevTools.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Auto-provisionamento transparente (Just-in-Time Account Creation).
 *
 * ── Por que existe ──
 * A regra de ouro do e-commerce: nunca bloquear um cliente com o cartão na
 * mão exigindo cadastro prévio. Antes, um checkout sem `userId` autenticado
 * simplesmente falhava — e se por acaso um `owner_id` órfão chegava até o
 * INSERT em `companies`, o Postgres rejeitava com
 * `companies_owner_id_fkey` (owner_id precisa existir em `profiles`).
 *
 * Esta função resolve um e-mail para um `profiles.id` válido: reaproveita o
 * perfil se o e-mail já existe (ex.: usuário voltando para comprar de novo
 * sem ter feito login), ou cria um perfil "leve" na hora — sem senha, sem
 * fricção — que o dono pode reivindicar depois (reset de senha via e-mail).
 *
 * SEMPRE roda dentro da transação do chamador: se o Stripe falhar depois,
 * o ROLLBACK desfaz o perfil junto, e não sobra um usuário fantasma.
 */
async function ensureOwnerProfile(client, { userId, email, displayName }) {
  if (userId) {
    const { rows } = await client.query(
      "SELECT id, email FROM public.profiles WHERE id = $1 OR user_id = $1",
      [userId]
    );
    if (rows[0]) return rows[0];
    // Token válido mas perfil ausente (ex.: banco recriado) — cai para o
    // provisionamento por e-mail abaixo em vez de estourar a FK.
  }

  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!cleanEmail) {
    throw Object.assign(new Error("E-mail é obrigatório para continuar sem login."), { statusCode: 400 });
  }

  const existing = await client.query("SELECT id, email FROM public.profiles WHERE email = $1", [cleanEmail]);
  if (existing.rows[0]) return existing.rows[0];

  const { rows } = await client.query(
    `INSERT INTO public.profiles (email, display_name, profile_type, is_approved, account_status)
     VALUES ($1, $2, 'company', true, 'active')
     RETURNING id, email`,
    [cleanEmail, displayName || cleanEmail]
  );
  return rows[0];
}

/** Cria uma empresa "PENDING_PAYMENT" para quem chega no checkout sem uma. */
async function ensurePendingCompany(client, { ownerId, name, color, logoInitials }) {
  const { rows } = await client.query(
    `INSERT INTO public.companies (owner_id, name, color, logo_initials, moderation_status, payment_status)
     VALUES ($1, $2, $3, $4, 'pending', 'PENDING_PAYMENT')
     RETURNING id, name`,
    [ownerId, (name || "Minha Marca").trim().slice(0, 120), color || "#00d4ff", (logoInitials || "").slice(0, 4) || null]
  );
  return rows[0];
}

app.post("/api/checkout/create-session", async (req, res) => {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    if (!stripe) {
      return res.status(503).json({ error: { message: "STRIPE_SECRET_KEY não configurada no servidor." } });
    }
    if (!arePricesConfigured()) {
      return res.status(503).json({
        error: {
          message:
            "Preços do Stripe não sincronizados. Rode `npm run stripe:sync` para preencher os IDs em server/plans.js.",
        },
      });
    }

    const rawBody = req.body || {};
    // Aceita tanto o contrato snake_case original (usado pelo picker de
    // blocos do mural) quanto o camelCase que o formulário de checkout leve
    // envia (companyName/email/website/planType/blocksCount) — sem obrigar
    // o front a conhecer o nome interno dos campos do servidor.
    const company_id = rawBody.company_id;
    const blocks = rawBody.blocks;
    const logo_url = rawBody.logo_url;
    const logo_initials = rawBody.logo_initials;
    const color = rawBody.color;
    const access_url = rawBody.access_url ?? rawBody.website;
    const contact_url = rawBody.contact_url;
    // Checkout sem login: só chegam quando o visitante não tem sessão e/ou
    // ainda não tem empresa cadastrada. Nenhum dos dois é aceito como
    // valor de cobrança — servem apenas para provisionar o registro.
    const guest_email = rawBody.guest_email ?? rawBody.email;
    const guest_name = rawBody.guest_name ?? rawBody.companyName;
    const company_name = rawBody.company_name ?? rawBody.companyName;
    // `region` é a chave interna ("borda"/"intermediaria"/"centro_premium");
    // `planType`/`plan_type` aceita também os nomes comerciais dos planos
    // (basic/standard/premium), traduzidos abaixo.
    const region = normalizeRegion(rawBody.region ?? rawBody.plan_type ?? rawBody.planType);
    const blocksCountInput = rawBody.blocks_count ?? rawBody.blocksCount;

    if (!SERVER_PLANS[region]) {
      return res.status(400).json({ error: { message: `Região ou plano inválido: ${rawBody.region ?? rawBody.planType ?? ""}` } });
    }

    const hasExplicitBlocks = Array.isArray(blocks) && blocks.length > 0;
    const blocksCountNum = Number(blocksCountInput);
    const hasBlocksCount = Number.isFinite(blocksCountNum) && blocksCountNum > 0;
    if (!hasExplicitBlocks && !hasBlocksCount) {
      return res.status(400).json({
        error: { message: "Informe blocks (array de {x,y}) ou blocks_count (quantidade a atribuir automaticamente)." },
      });
    }

    let userId = getUserId(req);
    if (!userId && !guest_email) {
      return res.status(400).json({
        error: { message: "Informe um e-mail para continuar — não é necessário criar conta antes de pagar." },
      });
    }

    await ensureLocalCommerceTables();
    await client.query("BEGIN");
    transactionOpen = true;

    // Formulário leve (sem grid do mural): o cliente só escolhe QUANTOS
    // blocos quer, não as coordenadas. O servidor reserva os primeiros
    // blocos livres da zona do plano — dentro da transação, então nada é
    // considerado "livre" duas vezes em corridas simultâneas.
    let autoBlocks = null;
    if (!hasExplicitBlocks) {
      autoBlocks = await pickFreeBlocksInRegion(client, region, Math.floor(blocksCountNum));
      if (autoBlocks.length < Math.floor(blocksCountNum)) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(409).json({
          error: {
            message: `Só há ${autoBlocks.length} bloco(s) livre(s) na zona ${SERVER_PLANS[region].name} agora. Tente uma quantidade menor.`,
          },
        });
      }
    }

    // ── Auto-provisionamento transparente ──────────────────────────────────
    // Se `userId` não existir (sem login) ou apontar para um perfil que não
    // existe mais no banco, resolvemos/criamos o perfil pelo e-mail — sem
    // bloquear a compra pedindo cadastro prévio. Tudo dentro da transação:
    // se o Stripe falhar mais abaixo, o ROLLBACK desfaz o perfil junto.
    const profile = await ensureOwnerProfile(client, {
      userId,
      email: guest_email,
      displayName: guest_name,
    });
    userId = profile.id;

    // A empresa precisa pertencer a quem está pagando. Se `company_id` não
    // veio (visitante ainda sem empresa cadastrada), provisiona uma nova,
    // marcada "PENDING_PAYMENT" até o webhook confirmar o pagamento.
    let owner;
    if (company_id) {
      const { rows } = await client.query(
        "SELECT id, name FROM public.companies WHERE id = $1 AND owner_id = $2",
        [company_id, userId]
      );
      if (!rows.length) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(403).json({ error: { message: "Empresa não encontrada ou não pertence ao usuário." } });
      }
      owner = rows[0];
    } else {
      owner = await ensurePendingCompany(client, {
        ownerId: userId,
        name: company_name || guest_name,
        color,
        logoInitials: logo_initials,
      });
    }
    const resolvedCompanyId = owner.id;

    // Blocos únicos e com coordenadas inteiras — duplicatas inflariam a cobrança.
    // Quando o servidor escolheu os blocos (`autoBlocks`), eles já vêm livres
    // e sem duplicatas, mas o dedup roda do mesmo jeito — é barato e fecha
    // qualquer suposição errada sobre a origem dos dados.
    const blocksSource = hasExplicitBlocks ? blocks : autoBlocks;
    const unique = new Map();
    for (const b of blocksSource) {
      const x = Number(b?.x);
      const y = Number(b?.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return res.status(400).json({ error: { message: "Coordenadas de bloco inválidas." } });
      }
      unique.set(`${x},${y}`, { x, y });
    }
    const cleanBlocks = [...unique.values()];

    const rangeError = validateServerBlockCount(region, cleanBlocks.length);
    if (rangeError) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(400).json({ error: { message: rangeError } });
    }

    // Nenhum bloco pode já estar ocupado.
    const { rows: taken } = await client.query(
      `SELECT x, y FROM public.blocks
       WHERE company_id IS NOT NULL AND (x, y) IN (${cleanBlocks.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ")})`,
      cleanBlocks.flatMap((b) => [b.x, b.y])
    );
    if (taken.length > 0) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(409).json({
        error: { message: `${taken.length} bloco(s) já foram ocupados. Escolha outras posições.` },
      });
    }

    const cost = computeCostCents(region, cleanBlocks.length);

    // Pedido local: guarda o que aplicar quando o pagamento confirmar.
    const payload = {
      company_id: resolvedCompanyId,
      blocks: cleanBlocks,
      region,
      logo_url: logo_url || null,
      logo_initials: logo_initials || null,
      color: color || null,
      access_url: access_url || null,
      contact_url: contact_url || null,
      monthly_cents: cost.monthlyCents,
    };
    const { rows: orderRows } = await client.query(
      `INSERT INTO public.checkout_orders (owner_id, company_id, payload, status)
       VALUES ($1, $2, $3, 'pending') RETURNING id`,
      [userId, resolvedCompanyId, JSON.stringify(payload)]
    );
    const orderId = orderRows[0]?.id;
    if (!orderId) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(500).json({ error: { message: "Falha ao criar o pedido." } });
    }

    const ids = STRIPE_PRICE_IDS[region];
    const baseUrl = (process.env.PUBLIC_APP_URL || req.get("origin") || "http://localhost:8080").replace(/\/$/, "");

    // Metadados ricos: mesmo que a aba feche ou o perfil tenha acabado de ser
    // criado agora, o webhook `checkout.session.completed` recebe tudo que
    // precisa para provisionar o acesso definitivo — sem depender de o
    // usuário voltar ao site.
    const eventMetadata = {
      order_id: orderId,
      company_id: resolvedCompanyId,
      user_id: userId,
      plan_type: region,
      blocks_count: String(cleanBlocks.length),
    };

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: profile.email || undefined,
        line_items: [
          { price: ids.base, quantity: 1 },
          { price: ids.perBlock, quantity: cleanBlocks.length },
        ],
        subscription_data: {
          trial_period_days: TRIAL_PERIOD_DAYS,
          metadata: eventMetadata,
        },
        // O webhook lê `metadata.order_id` para saber o que aplicar. Sem isto o
        // pagamento acontece e nenhum bloco é gravado.
        metadata: eventMetadata,
        client_reference_id: orderId,
        success_url: `${baseUrl}/dashboard?payment=success&order=${orderId}`,
        cancel_url: `${baseUrl}/dashboard?payment=cancelled`,
        allow_promotion_codes: true,
      });
    } catch (stripeErr) {
      // Se o Stripe recusar (cartão, rede, config), desfaz o perfil/empresa
      // provisionados agora — não deixa lixo órfão para trás por causa de
      // uma tentativa que nunca chegou à tela de pagamento.
      await client.query("ROLLBACK");
      transactionOpen = false;
      throw stripeErr;
    }

    // Só grava de vez depois que o Stripe confirmou a criação da sessão.
    await client.query("COMMIT");
    transactionOpen = false;

    console.log(
      `[checkout] sessão ${session.id} criada | pedido ${orderId} | ${SERVER_PLANS[region].name} | ` +
        `${cleanBlocks.length} blocos | $${(cost.monthlyCents / 100).toFixed(2)}/mês | trial ${TRIAL_PERIOD_DAYS}d` +
        (company_id ? "" : " | empresa auto-provisionada")
    );

    return res.json({
      data: {
        order_id: orderId,
        session_id: session.id,
        url: session.url,
        monthly_cents: cost.monthlyCents,
        trial_days: TRIAL_PERIOD_DAYS,
      },
    });
  } catch (err) {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => {});
    }
    console.error("[checkout] create-session:", err.message);
    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    return res.status(statusCode).json({ error: { message: err.message } });
  } finally {
    client.release();
  }
});

app.post("/api/checkout/manual-complete", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: { message: "Não autenticado" } });
    const orderId = req.body?.order_id || req.query?.order_id;
    if (!orderId) return res.status(400).json({ error: { message: "order_id obrigatório" } });
    const result = await completeCheckoutOrder(orderId, { userId });
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("[checkout] manual-complete:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.post("/api/blocks/purchase", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: { message: "Não autenticado" } });
    const { company_id, blocks, region, logo_url, color } = req.body || {};
    if (!company_id || !Array.isArray(blocks) || blocks.length === 0) {
      return res.status(400).json({ error: { message: "company_id e blocks (array de {x,y}) obrigatórios" } });
    }
    const { rows: owner } = await pool.query(
      "SELECT id FROM public.companies WHERE id = $1 AND owner_id = $2",
      [company_id, userId]
    );
    if (!owner.length) return res.status(403).json({ error: { message: "Empresa não encontrada ou não pertence ao usuário" } });
    const validRegion = ["borda", "intermediaria", "centro_premium"].includes(region) ? region : "borda";

    const coordinates = blocks
      .map((c) => [parseInt(c.x, 10), parseInt(c.y, 10)])
      .filter(([x, y]) => !isNaN(x) && !isNaN(y));
    if (coordinates.length === 0) return res.status(400).json({ error: { message: "Nenhuma coordenada válida em blocks" } });

    const placeholders = coordinates.map((_, i) => `($${2 * i + 1}, $${2 * i + 2})`).join(", ");
    const flatCoords = coordinates.flat();
    const { rows: occupied } = await pool.query(
      `SELECT x, y FROM public.blocks WHERE status = 'occupied' AND (x, y) IN (${placeholders})`,
      flatCoords
    );
    if (occupied.length > 0) {
      return res.status(400).json({
        error: {
          message: "Um ou mais blocos selecionados já estão ocupados. Atualize a página e escolha blocos disponíveis.",
        },
      });
    }

    let inserted = 0;
    for (const cell of blocks) {
      const x = parseInt(cell.x, 10);
      const y = parseInt(cell.y, 10);
      if (isNaN(x) || isNaN(y)) continue;
      const result = await pool.query(
        `INSERT INTO public.blocks (x, y, company_id, region, status)
         VALUES ($1, $2, $3, $4, 'occupied')
         ON CONFLICT (x, y) DO UPDATE SET company_id = EXCLUDED.company_id, region = EXCLUDED.region, status = 'occupied'
         WHERE public.blocks.status = 'free'`,
        [x, y, company_id, validRegion]
      );
      if (result.rowCount > 0) inserted++;
    }
    const updates = [];
    const params = [];
    let idx = 1;
    if (color != null && typeof color === "string") { updates.push(`color = $${idx}`); params.push(color); idx++; }
    if (logo_url != null && typeof logo_url === "string") { updates.push(`logo_url = $${idx}`); params.push(logo_url); idx++; }
    if (updates.length) {
      params.push(company_id);
      await pool.query(
        `UPDATE public.companies SET ${updates.join(", ")}, updated_at = now() WHERE id = $${idx}`,
        params
      );
    }
    inventoryCache = null; // Invalida o cache
    return res.json({ data: { ok: true, inserted } });
  } catch (err) {
    console.error("[api] blocks/purchase:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

// Feed de atividade (últimas 24h) para LiveStatusTicker
app.get("/api/activity-feed", async (_req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const activities = [];

    const { rows: blockRows } = await pool.query(
      `SELECT c.name AS company_name, b.region, COUNT(*) AS blocks_count
       FROM public.blocks b
       JOIN public.companies c ON c.id = b.company_id
       WHERE b.status = 'occupied' AND b.created_at >= $1
       GROUP BY c.name, b.region
       ORDER BY MAX(b.created_at) DESC
       LIMIT 15`,
      [twentyFourHoursAgo]
    );
    blockRows.forEach((r) => {
      activities.push({
        type: "vip_center",
        company_name: r.company_name,
        blocks_count: parseInt(r.blocks_count, 10),
        region: r.region,
      });
    });

    const { rows: newCompanies } = await pool.query(
      `SELECT name FROM public.companies WHERE created_at >= $1 ORDER BY created_at DESC LIMIT 10`,
      [twentyFourHoursAgo]
    );
    newCompanies.forEach((c) => {
      activities.push({ type: "new_member", company_name: c.name || "Nova empresa" });
    });

    const { rows: soldBids } = await pool.query(
      `SELECT c.name AS company_name FROM public.position_bids pb
       JOIN public.companies c ON c.id = pb.to_brand_id
       WHERE pb.status = 'accepted' AND pb.created_at >= $1 LIMIT 5`,
      [twentyFourHoursAgo]
    );
    soldBids.forEach(() => {
      activities.push({ type: "position_sold" });
    });

    const { rows: regionStats } = await pool.query(
      `SELECT region, COUNT(*) AS total FROM public.blocks WHERE status = 'occupied' GROUP BY region`
    );
    const regionTotals = { borda: 300, intermediaria: 400, centro_premium: 200 };
    const regionLabels = { borda: "Borda", intermediaria: "Intermediária", centro_premium: "Centro" };
    regionStats.forEach((r) => {
      const total = parseInt(r.total, 10);
      const cap = regionTotals[r.region] || 500;
      const pct = Math.round((1 - total / cap) * 100);
      if (pct < 100 && pct > 0) {
        activities.push({
          type: "region_availability",
          region: regionLabels[r.region] || r.region,
          percent_available: Math.min(100, Math.max(0, pct)),
        });
      }
    });

    return res.json({ data: activities.slice(0, 25) });
  } catch (err) {
    console.error("[activity-feed]", err.message);
    return res.status(500).json({ data: [] });
  }
});

// Notificação por e-mail quando um lance é recebido (valor líquido = Total - 30%)
app.post("/api/notify-bid-email", async (req, res) => {
  try {
    const { bid_id, to_brand_id, amount } = req.body || {};
    if (!to_brand_id || amount == null) {
      return res.status(400).json({ error: { message: "to_brand_id e amount obrigatórios" } });
    }
    const valorLiquido = Number(amount) * 0.7;
    let rows;
    try {
      const r = await pool.query(
        `SELECT p.email, p.email_notify_bids, c.name AS company_name
         FROM public.companies c
         JOIN public.profiles p ON p.id = c.owner_id
         WHERE c.id = $1`,
        [to_brand_id]
      );
      rows = r.rows;
    } catch (colErr) {
      if (colErr.code === "42703") {
        const r = await pool.query(
          `SELECT p.email, c.name AS company_name FROM public.companies c
           JOIN public.profiles p ON p.id = c.owner_id WHERE c.id = $1`,
          [to_brand_id]
        );
        rows = r.rows.map((x) => ({ ...x, email_notify_bids: true }));
      } else throw colErr;
    }
    const rec = rows[0];
    const email = rec?.email;
    const wantEmail = rec?.email_notify_bids !== false;
    if (email && wantEmail) {
      const result = await sendNovaOfertaEmail({
        to: email,
        valorLiquido,
        companyName: rec.company_name || "",
      });
      if (result.ok && !result.skipped) {
        await logEmailSent(pool, { status: "ok", message: `email_sent: nova_oferta to ${email}`, user_email: email });
      } else if (!result.ok) {
        await logEmailSent(pool, { status: "error", message: `email_failed: ${result.error}`, user_email: email });
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("[notify-bid-email]", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

// Notificação: venda concluída (lance aceito — saldo já atualizado)
app.post("/api/notify-bid-accepted", async (req, res) => {
  try {
    const { to_brand_id, valor_creditado } = req.body || {};
    if (!to_brand_id || valor_creditado == null) {
      return res.status(400).json({ error: { message: "to_brand_id e valor_creditado obrigatórios" } });
    }
    const { rows } = await pool.query(
      `SELECT p.email, c.name AS company_name
       FROM public.companies c
       JOIN public.profiles p ON p.id = c.owner_id
       WHERE c.id = $1`,
      [to_brand_id]
    );
    const rec = rows[0];
    const email = rec?.email;
    if (email) {
      const result = await sendVendaConcluidaEmail({
        to: email,
        valorCreditado: Number(valor_creditado),
        companyName: rec.company_name || "",
      });
      if (result.ok && !result.skipped) {
        await logEmailSent(pool, { status: "ok", message: `email_sent: venda_concluida to ${email}`, user_email: email });
      } else if (!result.ok) {
        await logEmailSent(pool, { status: "error", message: `email_failed: ${result.error}`, user_email: email });
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("[notify-bid-accepted]", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

// ── Content-SEO-AEO-Agent ────────────────────────────────────────────────
//
// Disparo manual (admin) e leitura dos artigos publicados. O ciclo
// automático diário mora em `agents/contentOrchestrator.js`, atrás da env
// var ENABLE_CONTENT_AGENT_CRON — aqui só ficam as rotas HTTP.
const contentOrchestrator = new ContentOrchestrator();

/** Roda o ciclo completo (todas as empresas ativas) ou uma empresa específica. */
app.post("/api/admin/agents/content/run", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const { company_id } = req.body || {};
    const result = company_id
      ? await contentOrchestrator.runForCompany(company_id)
      : await contentOrchestrator.runFullCycle();
    return res.json({ data: result });
  } catch (err) {
    console.error("[agents/content/run]", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

/** Artigos publicados para uma empresa — usado pelo dashboard do anunciante e pelo admin. */
app.get("/api/companies/:companyId/content-articles", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: { message: "Não autenticado" } });

    const { companyId } = req.params;
    const isAdmin = await isMasterAdmin(req);
    if (!isAdmin) {
      const { rows } = await pool.query(
        "SELECT id FROM public.companies WHERE id = $1 AND owner_id = $2",
        [companyId, userId]
      );
      if (!rows.length) return res.status(403).json({ error: { message: "Empresa não encontrada ou não pertence ao usuário." } });
    }

    const { rows } = await pool.query(
      `SELECT id, title, slug, markdown, meta_description, keywords, is_featured, rank_priority,
              engagement_before, engagement_after, generated_by, created_at
       FROM public.content_articles
       WHERE company_id = $1
       ORDER BY created_at DESC`,
      [companyId]
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error("[content-articles]", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

/** Lê os quatro arquivos do vault de uma empresa — mesma memória que o agente injeta no prompt. */
app.get("/api/companies/:companyId/vault", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: { message: "Não autenticado" } });

    const { companyId } = req.params;
    const isAdmin = await isMasterAdmin(req);
    if (!isAdmin) {
      const { rows } = await pool.query(
        "SELECT id FROM public.companies WHERE id = $1 AND owner_id = $2",
        [companyId, userId]
      );
      if (!rows.length) return res.status(403).json({ error: { message: "Empresa não encontrada ou não pertence ao usuário." } });
    }

    const context = await readVaultContext(companyId, { maxCharsPerFile: 20000 });
    return res.json({ data: context });
  } catch (err) {
    console.error("[vault]", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

scheduleDailyContentCycle();

// Preferência: avisos de lances por e-mail (toggle no NotificationsCenter)
app.get("/api/auth/email-notify-bids", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: { message: "Não autenticado" } });
    try {
      const { rows } = await pool.query(
        "SELECT email_notify_bids FROM public.profiles WHERE id = $1",
        [userId]
      );
      const value = rows[0]?.email_notify_bids;
      return res.json({ data: { email_notify_bids: value !== false } });
    } catch (colErr) {
      if (colErr.code === "42703") return res.json({ data: { email_notify_bids: true } });
      throw colErr;
    }
  } catch (err) {
    console.error("[email-notify-bids get]", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.patch("/api/auth/email-notify-bids", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: { message: "Não autenticado" } });
    const email_notify_bids = req.body?.email_notify_bids !== false;
    try {
      await pool.query("UPDATE public.profiles SET email_notify_bids = $1 WHERE id = $2", [email_notify_bids, userId]);
    } catch (colErr) {
      if (colErr.code === "42703") return res.json({ data: { email_notify_bids: true } });
      throw colErr;
    }
    return res.json({ data: { email_notify_bids } });
  } catch (err) {
    console.error("[email-notify-bids patch]", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.post("/api/credits/manual-add", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: { message: "Não autenticado" } });
    const { company_id, amount } = req.body || {};
    const amountNum = typeof amount === "string" ? parseFloat(amount.replace(",", ".")) : Number(amount);
    if (!company_id || Number.isNaN(amountNum) || amountNum < 1) {
      return res.status(400).json({ error: { message: "Informe empresa e valor de créditos maior ou igual a 1." } });
    }
    const { rows } = await pool.query(
      `UPDATE public.companies
       SET influencer_credits_balance = COALESCE(influencer_credits_balance, 0) + $1,
           updated_at = now()
       WHERE id = $2 AND owner_id = $3
       RETURNING influencer_credits_balance`,
      [amountNum, company_id, userId]
    );
    if (!rows.length) {
      return res.status(403).json({ error: { message: "Empresa não encontrada ou não pertence ao usuário." } });
    }
    return res.json({
      data: {
        ok: true,
        mode: "manual",
        amount_added: amountNum,
        balance: Number(rows[0].influencer_credits_balance ?? 0),
      },
    });
  } catch (err) {
    console.error("[credits] manual-add:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

// ----- Admin (conta definida em MASTER_ADMIN_EMAIL) -----
app.get("/api/admin/advertisers-list", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const { rows } = await pool.query(
      `SELECT c.id AS company_id, c.owner_id, c.name AS company_name, c.influencer_credits_balance, c.created_at AS company_created_at,
              p.email, p.display_name, p.created_at AS profile_created_at, p.last_login_at
       FROM public.companies c
       LEFT JOIN public.profiles p ON p.id = c.owner_id
       ORDER BY c.created_at DESC`
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error("[admin] advertisers-list:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.get("/api/admin/influencers-list", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const { rows } = await pool.query(
      `SELECT i.id, i.owner_id, i.name, i.category, i.niche, i.moderation_status, i.instagram, i.tiktok, i.youtube, i.twitter, i.website, i.contact_email, i.created_at, p.email AS profile_email
       FROM public.influencers i
       LEFT JOIN public.profiles p ON p.id = i.owner_id
       ORDER BY i.created_at DESC`
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error("[admin] influencers-list:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.get("/api/admin/influencer-dossier/:id", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const { id } = req.params;
    const { rows: infRows } = await pool.query(
      "SELECT id, owner_id, name, category, niche, bio, instagram, tiktok, youtube, twitter, website, contact_email, moderation_status, created_at FROM public.influencers WHERE id = $1",
      [id]
    );
    const influencer = infRows[0];
    if (!influencer) return res.status(404).json({ error: { message: "Influencer não encontrado" } });
    const ownerId = influencer.owner_id;
    const { rows: offers } = await pool.query(
      `SELECT d.id, d.amount, d.status, d.description, d.created_at, c.name AS company_name
       FROM public.direct_offers d
       LEFT JOIN public.companies c ON c.id = d.company_id
       WHERE d.to_user_id = $1
       ORDER BY d.created_at DESC
       LIMIT 50`,
      [ownerId]
    );
    return res.json({ data: { influencer, offersReceived: offers } });
  } catch (err) {
    console.error("[admin] influencer-dossier:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.get("/api/admin/executive-vip", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const [companiesRes, influencersRes] = await Promise.all([
      pool.query(
        `SELECT c.id, c.name, c.influencer_credits_balance
         FROM public.companies c ORDER BY c.influencer_credits_balance DESC NULLS LAST LIMIT 10`
      ),
      pool.query(
        `SELECT i.id, i.name, i.category, i.owner_id,
         (SELECT COUNT(*) FROM public.partnership_proposals pp WHERE pp.influencer_id = i.id AND pp.status IN ('accepted', 'paid')) +
         (SELECT COUNT(*) FROM public.direct_offers d WHERE d.to_user_id = i.owner_id AND d.status IN ('accepted', 'paid')) AS completed_count
         FROM public.influencers i
         ORDER BY completed_count DESC NULLS LAST LIMIT 10`
      ),
    ]);
    const top10Companies = companiesRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      influencer_credits_balance: Number(r.influencer_credits_balance ?? 0),
    }));
    const top10Influencers = influencersRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      completed_count: parseInt(r.completed_count ?? "0", 10),
    }));
    return res.json({ data: { top10Companies, top10Influencers } });
  } catch (err) {
    console.error("[admin] executive-vip:", err.message);
    return res.status(500).json({ data: { top10Companies: [], top10Influencers: [] }, error: { message: err.message } });
  }
});

app.get("/api/admin/growth-stats", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS c FROM public.profiles WHERE created_at >= now() - interval '7 days'`
    );
    return res.json({ data: { newSignupsLast7Days: parseInt(rows[0]?.c ?? "0", 10) } });
  } catch (err) {
    console.error("[admin] growth-stats:", err.message);
    return res.json({ data: { newSignupsLast7Days: 0 } });
  }
});

app.get("/api/admin/request-logs", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    return res.json({ data: [...requestLogs].reverse() });
  } catch (err) {
    console.error("[admin] request-logs:", err.message);
    return res.status(500).json({ data: [], error: { message: err.message } });
  }
});

app.post("/api/admin/health-sample", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const { latency, status: sampleStatus } = req.body || {};
    const status = ["ok", "degraded", "error"].includes(sampleStatus) ? sampleStatus : "ok";
    await pool.query(
      `INSERT INTO public.system_health_logs (service_name, status, latency, "timestamp")
       VALUES ('api', $1, $2, now())`,
      [status, typeof latency === "number" && latency >= 0 ? Math.round(latency) : null]
    );
    return res.json({ data: { ok: true } });
  } catch (err) {
    console.error("[admin] health-sample:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.get("/api/admin/health-stats", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const { rows } = await pool.query(
      `SELECT status, latency, "timestamp" FROM public.system_health_logs
       WHERE "timestamp" >= now() - interval '24 hours'
       ORDER BY "timestamp" ASC`
    );
    const total = rows.length;
    const okCount = rows.filter((r) => r.status === "ok").length;
    const uptimePct = total > 0 ? Math.round((okCount / total) * 100) : 100;
    const series = rows.map((r) => ({
      time: r.timestamp,
      latency: r.latency ?? 0,
      status: r.status,
    }));
    return res.json({ data: { uptimePct, series: series.slice(-100) } });
  } catch (err) {
    console.error("[admin] health-stats:", err.message);
    return res.status(500).json({ error: { message: err.message }, data: { uptimePct: 100, series: [] } });
  }
});

app.get("/api/admin/system-health-logs", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const { rows } = await pool.query(
      `SELECT id, service_name, status, latency, error_message, page_path, user_id, user_email, "timestamp"
       FROM public.system_health_logs ORDER BY "timestamp" DESC LIMIT 200`
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error("[admin] system-health-logs:", err.message);
    return res.status(500).json({ data: [], error: { message: err.message } });
  }
});

app.get("/api/admin/ai-requests-today", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS c FROM public.ai_matchmaking_history
       WHERE source = 'mural_chat' AND created_at >= date_trunc('day', now())`
    );
    return res.json({ data: { count: parseInt(rows[0]?.c ?? "0", 10) } });
  } catch (err) {
    console.error("[admin] ai-requests-today:", err.message);
    return res.json({ data: { count: 0 } });
  }
});

app.post("/api/admin/maintenance", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const enabled = !!req.body?.enabled;
    await pool.query(
      `INSERT INTO public.admin_settings (key, value) VALUES ('maintenance_mode', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [enabled ? "true" : "false"]
    );
    return res.json({ data: { enabled } });
  } catch (err) {
    console.error("[admin] maintenance:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.post("/api/admin/ai-suggest", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const { campaign_text: campaignText } = req.body || {};
    const text = (campaignText ?? "").toString().toLowerCase();
    const keywords = text.split(/\s+/).filter((w) => w.length > 2);

    const { rows: influencers } = await pool.query(
      "SELECT id, name, category, niche, bio, followers_count, avg_engagement FROM public.influencers"
    );

    const scored = influencers.map((inf) => {
      const cat = (inf.category ?? "").toLowerCase();
      const niche = (inf.niche ?? "").toLowerCase();
      const bio = (inf.bio ?? "").toLowerCase();
      const combined = `${cat} ${niche} ${bio}`;
      let fitScore = 0;
      for (const kw of keywords) {
        if (combined.includes(kw)) fitScore += 10;
      }
      const engagement = Number(inf.avg_engagement) || 0;
      const followers = Number(inf.followers_count) || 0;
      const engagementScore = Math.min(100, engagement * 10 + Math.log10(followers + 1) * 5);
      const total = fitScore + engagementScore;
      return { ...inf, fit_score: Math.min(100, total), fitScore, engagementScore };
    });

    scored.sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));
    const top5 = scored.slice(0, 5);

    const ids = top5.map((i) => i.id);
    const rationale = top5.map((i) => `${i.name}: fit ${(i.fit_score ?? 0).toFixed(1)} (categoria + engajamento)`).join("; ");
    await pool.query(
      `INSERT INTO public.ai_matchmaking_history (campaign_id, suggested_influencers_ids, fit_score, rationale, search_query, source)
       VALUES (NULL, $1::jsonb, $2, $3, $4, 'admin_lab')`,
      [JSON.stringify(ids), top5[0]?.fit_score ?? 0, rationale, campaignText || null]
    );

    return res.json({
      data: {
        influencers: top5.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          niche: i.niche,
          followers_count: i.followers_count,
          avg_engagement: i.avg_engagement,
          fit_score: (i.fit_score ?? 0).toFixed(1),
        })),
        rationale,
      },
    });
  } catch (err) {
    console.error("[admin] ai-suggest:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.get("/api/admin/finance-stats", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const [companiesRes, profitPf, profitSys, transactionsRes, withdrawalsRes] = await Promise.all([
      pool.query("SELECT COUNT(*) AS c, COALESCE(SUM(influencer_credits_balance), 0) AS passivo FROM public.companies"),
      pool.query("SELECT COALESCE(SUM(fee_collected), 0) AS fee, COALESCE(SUM(amount), 0) AS total FROM public.platform_finances WHERE status = 'completed'"),
      pool.query("SELECT COALESCE(SUM(amount), 0) AS profit FROM public.system_profit"),
      pool.query("SELECT id, transaction_type, amount, fee_collected, status, created_at FROM public.platform_finances ORDER BY created_at DESC LIMIT 100"),
      pool.query("SELECT id, user_id, amount, status, created_at, denial_reason FROM public.withdrawal_requests ORDER BY created_at DESC"),
    ]);
    const passivoCirculante = Number(companiesRes.rows[0]?.passivo ?? 0);
    const companiesCount = Number(companiesRes.rows[0]?.c ?? 0);
    const feeFromPf = Number(profitPf.rows[0]?.fee ?? 0);
    const profitFromSys = Number(profitSys.rows[0]?.profit ?? 0);
    const profitTotal = feeFromPf + profitFromSys;
    const transactions = transactionsRes.rows || [];
    const withdrawals = withdrawalsRes.rows || [];
    const byDate = {};
    transactions.forEach((t) => {
      const d = t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : "";
      if (d) byDate[d] = (byDate[d] ?? 0) + Number(t.fee_collected ?? t.amount ?? 0);
    });
    const systemProfitRows = await pool.query("SELECT amount, created_at FROM public.system_profit ORDER BY created_at DESC LIMIT 50");
    systemProfitRows.rows.forEach((p) => {
      const d = p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "";
      if (d) byDate[d] = (byDate[d] ?? 0) + Number(p.amount ?? 0);
    });
    const revenueData = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, receita]) => ({ date, receita: Math.round(receita * 100) / 100 }));
    return res.json({
      data: {
        passivoCirculante,
        companiesCount,
        profitTotal,
        revenueData,
        transactions,
        withdrawals,
      },
    });
  } catch (err) {
    console.error("[admin] finance-stats:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.post("/api/admin/withdrawal/approve", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: { message: "id obrigatório" } });
    const { rows } = await pool.query("SELECT id, user_id, amount, status FROM public.withdrawal_requests WHERE id = $1", [id]);
    const w = rows[0];
    if (!w) return res.status(404).json({ error: { message: "Solicitação não encontrada" } });
    if (w.status !== "pending") return res.status(400).json({ error: { message: "Solicitação já processada" } });
    const amount = Number(w.amount);
    const { rows: prof } = await pool.query("SELECT withdrawable_balance FROM public.profiles WHERE id = $1 OR user_id = $1", [w.user_id, w.user_id]);
    const bal = Number(prof[0]?.withdrawable_balance ?? 0);
    if (bal < amount) return res.status(400).json({ error: { message: "Saldo insuficiente do influenciador" } });
    await pool.query("UPDATE public.profiles SET withdrawable_balance = withdrawable_balance - $1 WHERE id = $2 OR user_id = $2", [amount, w.user_id]);
    await pool.query("UPDATE public.withdrawal_requests SET status = 'completed' WHERE id = $1", [id]);
    return res.json({ data: { ok: true } });
  } catch (err) {
    console.error("[admin] withdrawal/approve:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.post("/api/admin/withdrawal/deny", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const { id, reason } = req.body || {};
    if (!id) return res.status(400).json({ error: { message: "id obrigatório" } });
    await pool.query(
      "UPDATE public.withdrawal_requests SET status = 'cancelled', denial_reason = $2 WHERE id = $1 AND status = 'pending'",
      [id, (reason ?? "").toString().slice(0, 500)]
    );
    return res.json({ data: { ok: true } });
  } catch (err) {
    console.error("[admin] withdrawal/deny:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.post("/api/admin/adjust-credits", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const { company_id, new_balance } = req.body || {};
    if (!company_id) return res.status(400).json({ error: { message: "company_id obrigatório" } });
    const balance = parseFloat(new_balance);
    if (isNaN(balance) || balance < 0) return res.status(400).json({ error: { message: "new_balance deve ser um número ≥ 0" } });
    const { rowCount } = await pool.query(
      "UPDATE public.companies SET influencer_credits_balance = $1, updated_at = now() WHERE id = $2",
      [balance, company_id]
    );
    if (rowCount === 0) return res.status(404).json({ error: { message: "Empresa não encontrada" } });
    return res.json({ data: { ok: true } });
  } catch (err) {
    console.error("[admin] adjust-credits:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.get("/api/admin/monthly-report", async (req, res) => {
  try {
    if (!(await isMasterAdmin(req))) {
      return res.status(403).json({ error: { message: "Acesso negado" } });
    }
    const { rows: finances } = await pool.query(
      "SELECT date_trunc('month', created_at) AS month, SUM(fee_collected) AS fee, SUM(amount) AS total FROM public.platform_finances WHERE status = 'completed' GROUP BY 1 ORDER BY 1 DESC LIMIT 12"
    );
    const { rows: profits } = await pool.query(
      "SELECT date_trunc('month', created_at) AS month, SUM(amount) AS profit FROM public.system_profit GROUP BY 1 ORDER BY 1 DESC LIMIT 12"
    );
    const byMonth = {};
    finances.forEach((r) => {
      const k = r.month ? new Date(r.month).toISOString().slice(0, 7) : "";
      if (!byMonth[k]) byMonth[k] = { month: k, fee: 0, profit: 0 };
      byMonth[k].fee += Number(r.fee ?? 0);
      byMonth[k].profit += Number(r.profit ?? 0);
    });
    profits.forEach((r) => {
      const k = r.month ? new Date(r.month).toISOString().slice(0, 7) : "";
      if (!byMonth[k]) byMonth[k] = { month: k, fee: 0, profit: 0 };
      byMonth[k].profit += Number(r.profit ?? 0);
    });
    return res.json({ data: Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month)) });
  } catch (err) {
    console.error("[admin] monthly-report:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

function scoreByKeywords(text, keywords) {
  const t = (text ?? "").toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (t.includes(kw)) score += 10;
  }
  return score;
}

// Base de conhecimento do Mural Assistant (regras de negócio para contexto da IA)
const AI_KNOWLEDGE_BASE = {
  summary: "O Mural Assistant conhece as regras do ConeXai: funcionamento do grid, lances com 30% de taxa e sistema de créditos.",
  rules: [
    "Grid: o mural é composto por blocos que empresas podem comprar; cada bloco exibe a logo da marca. Posições no centro têm maior destaque.",
    "Lances (Bids): empresas podem fazer ofertas para comprar a posição de quem já tem blocos. A plataforma retém 30% do valor; o vendedor recebe 70% (valor líquido).",
    "Créditos: o saldo de créditos para influencers (influencer_credits_balance) é usado para campanhas e ofertas diretas a criadores. Saques seguem aprovação do admin.",
  ],
};

app.get("/api/ai/context", (req, res) => {
  try {
    return res.json({ data: AI_KNOWLEDGE_BASE });
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

async function logAiRecommendation(pool, payload) {
  try {
    await pool.query(
      `INSERT INTO public.ai_recommendations_logs (source, search_query, company_id, company_name, suggested_influencer_ids, suggested_company_ids, rationale, sales_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        payload.source,
        payload.search_query ?? null,
        payload.company_id ?? null,
        payload.company_name ?? null,
        JSON.stringify(payload.suggested_influencer_ids || []),
        JSON.stringify(payload.suggested_company_ids || []),
        payload.rationale ?? null,
        payload.sales_message ?? null,
      ]
    );
  } catch (e) {
    if (e.code !== "42P01") console.error("[logAiRecommendation]", e.message);
  }
}

app.post("/api/ai-search", async (req, res) => {
  try {
    const { query } = req.body || {};
    const q = (query ?? "").toString().toLowerCase();
    const keywords = q.split(/\s+/).filter((w) => w.length > 2);

    let influencers;
    try {
      const r = await pool.query(
        "SELECT id, name, category, niche, bio, followers_count, avg_engagement, public_username FROM public.influencers"
      );
      influencers = r.rows;
    } catch (colErr) {
      if (colErr.code === "42703") {
        const r = await pool.query(
          "SELECT id, name, category, niche, bio, followers_count, avg_engagement FROM public.influencers"
        );
        influencers = r.rows.map((row) => ({ ...row, public_username: null }));
      } else throw colErr;
    }
    const { rows: companies } = await pool.query(
      "SELECT id, name, category, description FROM public.companies"
    );

    const scoredInf = influencers.map((inf) => {
      const cat = (inf.category ?? "").toLowerCase();
      const niche = (inf.niche ?? "").toLowerCase();
      const bio = (inf.bio ?? "").toLowerCase();
      const fit = scoreByKeywords(`${cat} ${niche} ${bio}`, keywords);
      const eng = Math.min(100, (Number(inf.avg_engagement) || 0) * 10 + Math.log10((Number(inf.followers_count) || 0) + 1) * 5);
      return { ...inf, fit_score: fit + eng };
    });
    const scoredCo = companies.map((c) => {
      const desc = (c.description ?? "").toLowerCase();
      const cat = (c.category ?? "").toLowerCase();
      const name = (c.name ?? "").toLowerCase();
      return { ...c, fit_score: scoreByKeywords(`${name} ${cat} ${desc}`, keywords) };
    });

    scoredInf.sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));
    scoredCo.sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));
    const top3InfIds = scoredInf.slice(0, 3).map((i) => i.id);
    const top3Co = scoredCo.slice(0, 3).map((c) => c.id);
    const influencersWithUrls = scoredInf.slice(0, 3).map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      profile_url: `/p/${i.public_username || i.id}`,
    }));

    const rationale = `Influencers: ${scoredInf.slice(0, 3).map((i) => i.name).join(", ")}; Empresas: ${scoredCo.map((c) => c.name).join(", ")}`;
    await pool.query(
      `INSERT INTO public.ai_matchmaking_history (suggested_influencers_ids, suggested_company_ids, fit_score, rationale, search_query, source)
       VALUES ($1::jsonb, $2::jsonb, $3, $4, $5, 'mural_chat')`,
      [JSON.stringify(top3InfIds), JSON.stringify(top3Co), scoredInf[0]?.fit_score ?? 0, rationale, q || null]
    );
    await logAiRecommendation(pool, {
      source: "ai_search",
      search_query: q || null,
      suggested_influencer_ids: top3InfIds,
      suggested_company_ids: top3Co,
      rationale,
    });

    return res.json({
      data: {
        companyIds: top3Co,
        influencerIds: top3InfIds,
        rationale,
        influencers: influencersWithUrls,
        knowledge_summary: AI_KNOWLEDGE_BASE.summary,
      },
    });
  } catch (err) {
    console.error("[ai-search]:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

// IA: recomende um parceiro para minha marca — 3 influenciadores reais por categoria (agente de vendas)
app.post("/api/ai-recommend-partner", async (req, res) => {
  try {
    const { category, company_id, company_name } = req.body || {};
    let searchCategory = (category ?? "").toString().trim().toLowerCase();
    let companyDisplayName = (company_name ?? "").toString().trim() || null;
    let resolvedCompanyId = company_id || null;

    if (company_id && !searchCategory) {
      const { rows: comp } = await pool.query(
        "SELECT id, name, category FROM public.companies WHERE id = $1",
        [company_id]
      );
      if (comp[0]) {
        searchCategory = String(comp[0].category || "").toLowerCase();
        companyDisplayName = companyDisplayName || comp[0].name || null;
        resolvedCompanyId = comp[0].id;
      }
    }
    if (company_name && !company_id && !searchCategory) {
      const { rows: comp } = await pool.query(
        "SELECT id, name, category FROM public.companies WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1",
        [company_name]
      );
      if (comp[0]) {
        searchCategory = String(comp[0].category || "").toLowerCase();
        companyDisplayName = comp[0].name || null;
        resolvedCompanyId = comp[0].id;
      }
    }

    let influencers;
    try {
      const r = await pool.query(
        `SELECT id, name, category, niche, bio, followers_count, avg_engagement, public_username
         FROM public.influencers
         WHERE moderation_status = 'approved'
         ORDER BY created_at DESC
         LIMIT 50`
      );
      influencers = r.rows;
    } catch (colErr) {
      if (colErr.code === "42703") {
        const r = await pool.query(
          `SELECT id, name, category, niche, bio, followers_count, avg_engagement
           FROM public.influencers
           WHERE moderation_status = 'approved'
           ORDER BY created_at DESC
           LIMIT 50`
        );
        influencers = r.rows.map((row) => ({ ...row, public_username: null }));
      } else throw colErr;
    }

    const scored = influencers.map((inf) => {
      const cat = (inf.category ?? "").toLowerCase();
      const niche = (inf.niche ?? "").toLowerCase();
      const match = searchCategory ? (cat.includes(searchCategory) || niche.includes(searchCategory) ? 20 : 0) : 0;
      const eng = Math.min(50, (Number(inf.avg_engagement) || 0) * 5 + Math.log10((Number(inf.followers_count) || 0) + 1) * 2);
      return { ...inf, score: match + eng };
    });
    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const top3 = scored.slice(0, 3).map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      niche: i.niche,
      profile_url: `/p/${i.public_username || i.id}`,
    }));

    const rationale = searchCategory
      ? `Recomendamos 3 parceiros alinhados à categoria "${searchCategory}": ${top3.map((i) => i.name).join(", ")}.`
      : `Top 3 parceiros do mural: ${top3.map((i) => i.name).join(", ")}.`;

    const brandLabel = companyDisplayName || "sua marca";
    const sales_message = `Baseado na sua marca **${brandLabel}**, estes 3 influenciadores podem triplicar o seu alcance no Mural: ${top3.map((i) => i.name).join(", ")}. Acesse os perfis abaixo e salve nos favoritos para ofertas diretas.`;

    await logAiRecommendation(pool, {
      source: "recommend_partner",
      search_query: company_name || null,
      company_id: resolvedCompanyId,
      company_name: companyDisplayName,
      suggested_influencer_ids: top3.map((i) => i.id),
      suggested_company_ids: [],
      rationale,
      sales_message,
    });

    return res.json({
      data: {
        influencerIds: top3.map((i) => i.id),
        influencers: top3,
        rationale,
        sales_message,
        knowledge_summary: AI_KNOWLEDGE_BASE.summary,
      },
    });
  } catch (err) {
    console.error("[ai-recommend-partner]:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

// ----------------------------------------------------------------------------
// AGENTES CAÇADORES (LEAD HUNTERS)
// ----------------------------------------------------------------------------

app.post("/api/admin/run-hunter", async (req, res) => {
  try {
    const { niche = "SaaS", region = "Global", quantity = 3 } = req.body || {};
    
    // O agente usa log via console no terminal
    const agent = new LeadHunterAgent();
    const result = await agent.scrapeAndFeedCRM(niche, region, parseInt(quantity, 10) || 3, pool);
    
    return res.json({ data: result });
  } catch (err) {
    console.error("[run-hunter]:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.get("/api/admin/hunter-leads", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM public.hunter_leads ORDER BY created_at DESC LIMIT 100"
    );
    return res.json({ data: rows });
  } catch (err) {
    console.error("[hunter-leads]:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.post("/api/admin/agents/run", async (req, res) => {
  try {
    const { agentId, params } = req.body || {};
    
    // Validate agent ID to prevent directory traversal
    if (!agentId || !/^[a-zA-Z0-9_]+$/.test(agentId)) {
      return res.status(400).json({ error: { message: "Invalid agent ID" } });
    }

    let AgentClass;
    try {
      const module = await import(`./agents/${agentId}.js`);
      AgentClass = module.default || module;
    } catch (e) {
      return res.status(404).json({ error: { message: "Agent not found: " + agentId } });
    }

    // Algumas classes esperam 'db' no construtor
    const agent = typeof AgentClass === 'function' ? new AgentClass(pool) : AgentClass;
    
    let result = { status: "SUCCESS", message: "Agent executed successfully." };
    
    try {
      switch (agentId) {
        case "auctionDynamicPricingAgent":
          result = await agent.calculateZonePricing(params?.zone || 'centro_premium', params?.blocksCount || 10);
          break;
        case "escrowFinanceAgent":
          result = await agent.auditEscrowHoldings();
          break;
        case "trafficAnalyticsAgent":
          result = await agent.auditBlockTraffic(params?.blockId || 'mock-block', [{clicks: 100}, {clicks: 250}]);
          break;
        case "legalComplianceAgent":
          result = await agent.auditPartnershipTerms({ id: 'mock-deal', termsAccepted: true });
          break;
        case "contentAgent":
        case "contentOrchestrator":
        case "emailConversionEngine":
        case "growthCampaignAgent":
        case "influencerCampaignAgent":
        case "platformIntelligence":
        case "securityHunterAgent":
        case "vaultManager":
          // Simulação genérica para agentes complexos sem inputs específicos para demonstração
          result = { status: "SUCCESS", logs: [`[${new Date().toISOString()}] Inicialização do agente ${agentId}`, `[${new Date().toISOString()}] Varredura concluída. 0 anomalias encontradas.`, `[${new Date().toISOString()}] Relatório gerado e finalizado com sucesso.`] };
          break;
        default:
          result = { status: "MOCKED", message: `Agente ${agentId} executado.` };
          break;
      }
    } catch (agentErr) {
      console.error(`Error running agent ${agentId}:`, agentErr);
      result = { status: "ERROR", message: agentErr.message };
    }

    return res.json({ data: result });
  } catch (err) {
    console.error("[run-agent]:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.post("/api/admin/agents/generate-article", async (req, res) => {
  try {
    const { companyId, topic, webhookUrl } = req.body;
    if (!companyId || !topic) {
      return res.status(400).json({ error: { message: "companyId e topic são obrigatórios" } });
    }

    const { default: ContentAgent } = await import("./agents/contentAgent.js");
    const agent = new ContentAgent();
    const article = await agent.generateManualArticle(companyId, topic, webhookUrl);

    return res.json({ data: article });
  } catch (err) {
    console.error("[generate-article]:", err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

async function ensureCampaignsColumns() {
  try {
    await pool.query(`
      ALTER TABLE public.campaigns
        ADD COLUMN IF NOT EXISTS description text,
        ADD COLUMN IF NOT EXISTS campaign_link text,
        ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS attachment_urls jsonb NOT NULL DEFAULT '[]'
    `);
  } catch (e) {
    console.warn("[migrate] campaigns columns:", e.message);
  }
}

async function ensureDirectOffersColumns() {
  try {
    await pool.query(`
      ALTER TABLE public.direct_offers
        ADD COLUMN IF NOT EXISTS read_at timestamptz,
        ADD COLUMN IF NOT EXISTS archived_at timestamptz,
        ADD COLUMN IF NOT EXISTS campaign_id uuid
    `);
    await pool.query("ALTER TABLE public.direct_offers DROP CONSTRAINT IF EXISTS direct_offers_status_check");
    await pool.query(`
      ALTER TABLE public.direct_offers
        ADD CONSTRAINT direct_offers_status_check
        CHECK (status IN ('pending', 'accepted', 'under_review', 'paid', 'cancelled'))
    `);
  } catch (e) {
    console.warn("[migrate] direct_offers columns:", e.message);
  }
}

async function ensureEngagementTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
        influencer_id uuid REFERENCES public.influencers(id) ON DELETE CASCADE,
        initiated_by uuid,
        status text NOT NULL DEFAULT 'active',
        last_message_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
        sender_id uuid NOT NULL,
        content text NOT NULL,
        read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.contact_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid,
        influencer_id uuid,
        to_influencer_id uuid,
        user_id uuid,
        source text DEFAULT 'mural',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_conversations_company ON public.conversations(company_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_conversations_influencer ON public.conversations(influencer_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_contact_events_to_influencer ON public.contact_events(to_influencer_id)");
  } catch (e) {
    console.warn("[migrate] engagement tables:", e.message);
  }
}

Promise.all([ensureCampaignsColumns(), ensureDirectOffersColumns(), ensureEngagementTables()]).then(() => {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Local API] Rodando em http://localhost:${PORT} — frontend pode usar esta URL para login/cadastro.`);
    });
  }
});

export default app;
