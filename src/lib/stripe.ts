// ─────────────────────────────────────────────────────────────────────────
// Modelo de preços — fonte única de verdade
//
// Modelo HÍBRIDO: cada plano tem uma assinatura base mensal (que paga os
// serviços inclusos — dashboard, artigos, badge, suporte) MAIS uma taxa por
// bloco ocupado. A base cobre o serviço; a taxa por bloco cobre o território.
//
// Histórico: já passou por três modelos — anual por zona ($1/$2/$5 por ano),
// depois preço único de $3,99/mês, agora híbrido. Por isso tudo vive aqui:
// qualquer tela que precise de preço importa deste arquivo, nunca recalcula.
// ─────────────────────────────────────────────────────────────────────────

export type BlockRegion = "borda" | "intermediaria" | "centro_premium";

export const BLOCK_REGIONS: BlockRegion[] = ["borda", "intermediaria", "centro_premium"];

export interface PlanDefinition {
  region: BlockRegion;
  /** Nome comercial do plano. */
  name: string;
  /** Rótulo da zona no mural. */
  zoneLabel: string;
  /** Assinatura base mensal, em USD. */
  baseMonthlyUsd: number;
  /** Taxa mensal por bloco ocupado, em USD. */
  perBlockMonthlyUsd: number;
  /**
   * Faixa de blocos do plano. `min` é OBRIGATÓRIO: não é possível assinar o
   * Standard com 3 blocos, por exemplo. A faixa é o que separa os planos —
   * sem mínimo, alguém pagaria a base do Premium para ocupar um bloco só e o
   * preço do centro perderia sentido.
   */
  minBlocks: number;
  maxBlocks: number;
  /** Artigos institucionais inclusos por mês. */
  articlesPerMonth: number;
  /**
   * ⚠️ TODO (Stripe): cada plano precisa de DOIS preços recorrentes mensais —
   * um de valor fixo (a base) e um "por unidade" (a taxa por bloco, cobrada
   * com `quantity` igual ao número de blocos). Crie-os no painel do Stripe e
   * cole os IDs aqui. Enquanto houver "TODO", `assertStripeConfigured` impede
   * o checkout de rodar com configuração inválida.
   */
  stripeBasePriceId: string;
  stripePerBlockPriceId: string;
}

export const PLANS: Record<BlockRegion, PlanDefinition> = {
  borda: {
    region: "borda",
    name: "Basic",
    zoneLabel: "Edge",
    baseMonthlyUsd: 9.99,
    perBlockMonthlyUsd: 2.5,
    minBlocks: 1,
    maxBlocks: 6,
    articlesPerMonth: 1,
    stripeBasePriceId: "price_TODO_BASIC_BASE",
    stripePerBlockPriceId: "price_TODO_BASIC_PER_BLOCK",
  },
  intermediaria: {
    region: "intermediaria",
    name: "Standard",
    zoneLabel: "Mid",
    baseMonthlyUsd: 20.99,
    perBlockMonthlyUsd: 3.5,
    minBlocks: 7,
    maxBlocks: 12,
    articlesPerMonth: 2,
    stripeBasePriceId: "price_TODO_STANDARD_BASE",
    stripePerBlockPriceId: "price_TODO_STANDARD_PER_BLOCK",
  },
  centro_premium: {
    region: "centro_premium",
    name: "Premium",
    zoneLabel: "Prime Center",
    baseMonthlyUsd: 49.99,
    perBlockMonthlyUsd: 5.0,
    minBlocks: 13,
    maxBlocks: 25,
    articlesPerMonth: 4,
    stripeBasePriceId: "price_TODO_PREMIUM_BASE",
    stripePerBlockPriceId: "price_TODO_PREMIUM_PER_BLOCK",
  },
};

/** Rótulos das zonas, em inglês (idioma padrão do produto). */
export const REGION_LABELS: Record<BlockRegion, string> = {
  borda: PLANS.borda.zoneLabel,
  intermediaria: PLANS.intermediaria.zoneLabel,
  centro_premium: PLANS.centro_premium.zoneLabel,
};

/** Teto de blocos por região. */
export const MAX_BLOCKS: Record<BlockRegion, number> = {
  borda: PLANS.borda.maxBlocks,
  intermediaria: PLANS.intermediaria.maxBlocks,
  centro_premium: PLANS.centro_premium.maxBlocks,
};

/** Faixa (mínimo e máximo) por região. */
export const BLOCK_RANGES: Record<BlockRegion, { min: number; max: number }> = {
  borda: { min: PLANS.borda.minBlocks, max: PLANS.borda.maxBlocks },
  intermediaria: { min: PLANS.intermediaria.minBlocks, max: PLANS.intermediaria.maxBlocks },
  centro_premium: { min: PLANS.centro_premium.minBlocks, max: PLANS.centro_premium.maxBlocks },
};

// ── Cálculo ──────────────────────────────────────────────────────────────

export interface CostBreakdown {
  region: BlockRegion;
  planName: string;
  blocks: number;
  /** Assinatura base mensal. */
  base: number;
  /** Taxa mensal por bloco (unitária). */
  perBlock: number;
  /** Total da taxa por bloco: `perBlock × blocks`. */
  blocksTotal: number;
  /** Cobrança mensal total. */
  monthly: number;
  /** Equivalente em 12 meses, útil para comparação. */
  yearly: number;

  /**
   * Os mesmos valores em CENTAVOS (inteiros).
   *
   * Dinheiro em ponto flutuante não fecha: `20.99 + 35` resulta em
   * `55.989999999999995`, então somar `base + blocksTotal` produz um número
   * diferente de `monthly`. Na tela isso não aparece porque a formatação
   * arredonda, mas qualquer recálculo — no servidor, num relatório ou numa
   * conferência de fatura — divergiria por centavos.
   *
   * Use SEMPRE os campos em centavos para cálculo e comparação; os campos
   * decimais existem apenas para exibição. O Stripe também trabalha em
   * centavos, então este é o formato que vai para a cobrança.
   */
  cents: {
    base: number;
    perBlock: number;
    blocksTotal: number;
    monthly: number;
    yearly: number;
  };
}

/**
 * Custo mensal de uma configuração.
 *
 * `blocks` é limitado à faixa do plano — passar um valor fora dela é sinal de
 * bug no chamador, e silenciosamente cobrar por 30 blocos num plano que
 * permite 25 seria pior que corrigir.
 */
export function computeCost(region: BlockRegion, blocks: number): CostBreakdown {
  const plan = PLANS[region];
  const clamped = Math.max(plan.minBlocks, Math.min(plan.maxBlocks, Math.floor(blocks) || plan.minBlocks));

  // Todo o cálculo acontece em centavos inteiros. Assim a identidade
  // `base + blocksTotal === monthly` vale de forma exata, sem depender de
  // arredondamento posterior.
  const baseCents = toCents(plan.baseMonthlyUsd);
  const perBlockCents = toCents(plan.perBlockMonthlyUsd);
  const blocksTotalCents = perBlockCents * clamped;
  const monthlyCents = baseCents + blocksTotalCents;
  const yearlyCents = monthlyCents * 12;

  return {
    region,
    planName: plan.name,
    blocks: clamped,
    base: baseCents / 100,
    perBlock: perBlockCents / 100,
    blocksTotal: blocksTotalCents / 100,
    monthly: monthlyCents / 100,
    yearly: yearlyCents / 100,
    cents: {
      base: baseCents,
      perBlock: perBlockCents,
      blocksTotal: blocksTotalCents,
      monthly: monthlyCents,
      yearly: yearlyCents,
    },
  };
}

/**
 * Valida se uma quantidade de blocos é permitida no plano.
 * Retorna `null` quando válida, ou a mensagem de erro.
 */
export function validateBlockCount(region: BlockRegion, blocks: number): string | null {
  const plan = PLANS[region];
  if (!Number.isFinite(blocks) || blocks < 1) return "Select at least one block.";
  if (blocks < plan.minBlocks) {
    return `The ${plan.name} plan starts at ${plan.minBlocks} blocks.`;
  }
  if (blocks > plan.maxBlocks) {
    return `The ${plan.name} plan allows up to ${plan.maxBlocks} blocks.`;
  }
  return null;
}

/** Plano cuja faixa comporta essa quantidade de blocos. */
export function planForBlockCount(blocks: number): PlanDefinition | null {
  return BLOCK_REGIONS.map((r) => PLANS[r]).find((p) => blocks >= p.minBlocks && blocks <= p.maxBlocks) ?? null;
}

/** Preço mensal de UM bloco na região indicada. */
export function blockPriceFor(region: BlockRegion): number {
  return PLANS[region].perBlockMonthlyUsd;
}

/** Converte um valor em dólares para centavos inteiros. */
export function toCents(usd: number): number {
  return Math.round(usd * 100);
}

/** Formata USD de forma consistente em toda a aplicação. */
export function formatUsd(value: number, opts?: { cents?: boolean }): string {
  const cents = opts?.cents ?? !Number.isInteger(value);
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

// ── Stripe ───────────────────────────────────────────────────────────────

export function isStripeConfigured(): boolean {
  return BLOCK_REGIONS.every(
    (r) =>
      !PLANS[r].stripeBasePriceId.includes("TODO") &&
      !PLANS[r].stripePerBlockPriceId.includes("TODO")
  );
}

/**
 * Falha cedo e com mensagem clara se o checkout for acionado antes de os
 * preços existirem no Stripe. Sem isso, o erro apareceria como uma resposta
 * 400 opaca vinda da API.
 */
export function assertStripeConfigured(): void {
  if (!isStripeConfigured()) {
    throw new Error(
      "Stripe prices are not configured yet. Each plan needs TWO recurring monthly " +
        "prices (a flat base and a per-unit block fee). Create them in the Stripe " +
        "dashboard and fill in stripeBasePriceId / stripePerBlockPriceId in src/lib/stripe.ts."
    );
  }
}

// ── Compatibilidade ──────────────────────────────────────────────────────

/**
 * @deprecated O add-on anual "Premium Plus" foi removido. Os benefícios que
 * ele vendia (badge de destaque, animação especial, suporte prioritário)
 * passaram a fazer parte do plano Premium — cobrar os dois seria cobrar duas
 * vezes pelo mesmo benefício. Mantido em 0 para não quebrar chamadas antigas.
 */
export const PERPETUAL_ADDON_USD = 0;

/** @deprecated A assinatura é mensal e recorrente, sem prazo fixo. */
export const MAX_YEARS = 1;
