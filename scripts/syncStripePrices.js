#!/usr/bin/env node
/**
 * Lê os preços reais da sua conta Stripe e grava os IDs em server/plans.js.
 *
 * ── Por que um script, e não IDs colados à mão ──
 * Um `price_id` trocado entre planos não gera erro nenhum: o checkout abre, o
 * pagamento passa, e o cliente é cobrado pelo valor errado — o problema só
 * aparece na fatura. Casar os preços pelo VALOR e pelo INTERVALO, lendo da
 * própria conta, elimina a chance de digitação errada.
 *
 * Uso:
 *   npm run stripe:sync           # sincroniza
 *   npm run stripe:sync -- --dry  # só mostra o que encontrou
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Stripe from "stripe";
import { PLANS, BLOCK_REGIONS, toCents } from "../server/plans.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
config({ path: join(ROOT, ".env") });

const DRY = process.argv.includes("--dry");
const KEY = process.env.STRIPE_SECRET_KEY;

if (!KEY) {
  console.error("\n[stripe:sync] STRIPE_SECRET_KEY ausente no .env.\n");
  process.exit(1);
}
if (!KEY.startsWith("sk_")) {
  console.error("\n[stripe:sync] STRIPE_SECRET_KEY não parece uma chave secreta (deve começar com sk_).\n");
  process.exit(1);
}

const stripe = new Stripe(KEY);
const isLive = KEY.startsWith("sk_live_");

console.log(`\n[stripe:sync] modo: ${isLive ? "🔴 LIVE (dinheiro real)" : "🧪 TEST"}\n`);

// ── 1. Carrega todos os preços recorrentes mensais e ativos ──
const prices = [];
for await (const price of stripe.prices.list({ active: true, limit: 100, expand: ["data.product"] })) {
  if (price.recurring?.interval !== "month") continue;
  prices.push(price);
}

console.log(`Encontrados ${prices.length} preços mensais ativos na conta.\n`);

/**
 * Um preço "por unidade" é o que será cobrado com `quantity` = nº de blocos.
 * O Stripe marca isso em `recurring.usage_type` / `billing_scheme`, mas o
 * sinal mais confiável é o VALOR: a base e a taxa por bloco de um mesmo plano
 * têm valores diferentes e conhecidos.
 */
function findByAmount(cents) {
  return prices.filter((p) => p.unit_amount === cents);
}

function describe(p) {
  const product = typeof p.product === "object" && p.product !== null ? p.product.name : p.product;
  return `${p.id}  ${(p.unit_amount / 100).toFixed(2)} ${p.currency.toUpperCase()}  "${product}"`;
}

const resolved = {};
let missing = 0;
let ambiguous = 0;

for (const region of BLOCK_REGIONS) {
  const plan = PLANS[region];
  const baseCents = toCents(plan.baseMonthlyUsd);
  const perBlockCents = toCents(plan.perBlockMonthlyUsd);

  const baseMatches = findByAmount(baseCents);
  const perBlockMatches = findByAmount(perBlockCents);

  console.log(`── ${plan.name} (${region})`);
  console.log(`   base esperada:      $${plan.baseMonthlyUsd.toFixed(2)}/mês`);
  for (const p of baseMatches) console.log(`     ✓ ${describe(p)}`);
  if (baseMatches.length === 0) console.log("     ✗ nenhum preço com este valor");
  if (baseMatches.length > 1) console.log("     ⚠ mais de um candidato — usando o primeiro");

  console.log(`   por bloco esperada: $${plan.perBlockMonthlyUsd.toFixed(2)}/mês`);
  for (const p of perBlockMatches) console.log(`     ✓ ${describe(p)}`);
  if (perBlockMatches.length === 0) console.log("     ✗ nenhum preço com este valor");
  if (perBlockMatches.length > 1) console.log("     ⚠ mais de um candidato — usando o primeiro");
  console.log();

  if (!baseMatches.length || !perBlockMatches.length) missing++;
  if (baseMatches.length > 1 || perBlockMatches.length > 1) ambiguous++;

  resolved[region] = {
    base: baseMatches[0]?.id ?? "",
    perBlock: perBlockMatches[0]?.id ?? "",
  };
}

if (missing > 0) {
  console.error(
    `[stripe:sync] ${missing} plano(s) sem preço correspondente na conta.\n` +
      "Crie no painel do Stripe um preço recorrente MENSAL para cada valor listado\n" +
      "acima como \"✗ nenhum preço com este valor\" e rode novamente.\n"
  );
}
if (ambiguous > 0) {
  console.warn(
    `[stripe:sync] ${ambiguous} plano(s) com mais de um preço do mesmo valor.\n` +
      "Arquive os preços duplicados no Stripe para evitar cobrar pelo errado.\n"
  );
}

if (DRY) {
  console.log("[stripe:sync] --dry: nada foi gravado.\n");
  process.exit(missing > 0 ? 1 : 0);
}

// ── 2. Grava os IDs em server/plans.js ──
const plansPath = join(ROOT, "server", "plans.js");
const source = readFileSync(plansPath, "utf8");

const block = [
  "export const STRIPE_PRICE_IDS = {",
  ...BLOCK_REGIONS.map(
    (r) => `  ${r}: { base: ${JSON.stringify(resolved[r].base)}, perBlock: ${JSON.stringify(resolved[r].perBlock)} },`
  ),
  "};",
].join("\n");

const updated = source.replace(
  /export const STRIPE_PRICE_IDS = \{[\s\S]*?\n\};/,
  block
);

if (updated === source) {
  console.error("[stripe:sync] não encontrei o bloco STRIPE_PRICE_IDS em server/plans.js.\n");
  process.exit(1);
}

writeFileSync(plansPath, updated, "utf8");
console.log("[stripe:sync] server/plans.js atualizado:\n");
for (const r of BLOCK_REGIONS) {
  console.log(`  ${r.padEnd(16)} base=${resolved[r].base || "(vazio)"}  perBlock=${resolved[r].perBlock || "(vazio)"}`);
}
console.log();
process.exit(missing > 0 ? 1 : 0);
