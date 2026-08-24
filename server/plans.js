/**
 * Tabela de planos do lado do SERVIDOR.
 *
 * ── Por que existe uma cópia aqui ──
 * O cliente envia apenas `region` e a lista de blocos. Quem calcula o preço é
 * o servidor, sempre. Aceitar um `total_usd` vindo do navegador permitiria a
 * qualquer pessoa abrir o DevTools e assinar o plano Premium por US$ 0,01.
 *
 * Esta tabela espelha `src/lib/stripe.ts`. A duplicação é intencional (o
 * servidor é JS puro e não importa TS), mas é perigosa se as duas divergirem —
 * por isso existe um teste de paridade em
 * `src/lib/__tests__/plans-parity.test.ts` que quebra se alguém alterar uma
 * sem a outra.
 */

export const PLANS = {
  borda: {
    region: "borda",
    name: "Basic",
    baseMonthlyUsd: 9.99,
    perBlockMonthlyUsd: 2.5,
    minBlocks: 1,
    maxBlocks: 6,
  },
  intermediaria: {
    region: "intermediaria",
    name: "Standard",
    baseMonthlyUsd: 20.99,
    perBlockMonthlyUsd: 3.5,
    minBlocks: 7,
    maxBlocks: 12,
  },
  centro_premium: {
    region: "centro_premium",
    name: "Premium",
    baseMonthlyUsd: 49.99,
    perBlockMonthlyUsd: 5.0,
    minBlocks: 13,
    maxBlocks: 25,
  },
};

export const BLOCK_REGIONS = Object.keys(PLANS);

/** Dias de teste gratuito concedidos na primeira assinatura. */
export const TRIAL_PERIOD_DAYS = 7;

/**
 * IDs de preço do Stripe, por região.
 *
 * Preenchidos por `npm run stripe:sync`, que lê os preços reais da sua conta
 * e grava aqui. Não edite à mão: um ID trocado cobra o valor errado sem
 * nenhum erro aparente.
 */
export const STRIPE_PRICE_IDS = {
  borda: { base: "price_1U7e8YRmDCdzWe19bvBU1kKI", perBlock: "price_1U7eAHRmDCdzWe19qX2nu1ov" },
  intermediaria: { base: "price_1U7e99RmDCdzWe19vnXbGeCY", perBlock: "price_1U7eBQRmDCdzWe1944o0jmyJ" },
  centro_premium: { base: "price_1U7e9ZRmDCdzWe19aO7Qbhcv", perBlock: "price_1U7eCDRmDCdzWe194uTiIazn" },
};

export function toCents(usd) {
  return Math.round(usd * 100);
}

/**
 * Custo mensal calculado no servidor, em centavos.
 *
 * Trabalha em inteiros porque `20.99 + 35` em ponto flutuante resulta em
 * `55.989999999999995` — e a diferença apareceria na fatura.
 */
export function computeCostCents(region, blocks) {
  const plan = PLANS[region];
  if (!plan) throw new Error(`Região inválida: ${region}`);
  const n = Math.max(plan.minBlocks, Math.min(plan.maxBlocks, Math.floor(blocks)));
  const baseCents = toCents(plan.baseMonthlyUsd);
  const perBlockCents = toCents(plan.perBlockMonthlyUsd);
  const blocksTotalCents = perBlockCents * n;
  return {
    blocks: n,
    baseCents,
    perBlockCents,
    blocksTotalCents,
    monthlyCents: baseCents + blocksTotalCents,
  };
}

/** `null` se a quantidade é válida para o plano; a mensagem de erro caso não. */
export function validateBlockCount(region, blocks) {
  const plan = PLANS[region];
  if (!plan) return `Região inválida: ${region}`;
  if (!Number.isFinite(blocks) || blocks < 1) return "Selecione ao menos um bloco.";
  if (blocks < plan.minBlocks) return `O plano ${plan.name} começa em ${plan.minBlocks} blocos.`;
  if (blocks > plan.maxBlocks) return `O plano ${plan.name} permite no máximo ${plan.maxBlocks} blocos.`;
  return null;
}

/** `true` quando os IDs de preço já foram sincronizados. */
export function arePricesConfigured() {
  return BLOCK_REGIONS.every(
    (r) => STRIPE_PRICE_IDS[r]?.base?.startsWith("price_") && STRIPE_PRICE_IDS[r]?.perBlock?.startsWith("price_")
  );
}
