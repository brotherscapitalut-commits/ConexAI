import { describe, it, expect } from "vitest";
import {
  PLANS,
  BLOCK_REGIONS,
  BLOCK_RANGES,
  computeCost,
  validateBlockCount,
  planForBlockCount,
  blockPriceFor,
  formatUsd,
  isStripeConfigured,
} from "@/lib/stripe";
import {
  MIN_BID_MULTIPLIER,
  REVENUE_SPLIT,
  splitBid,
  minimumBidFor,
  MuralBiddingService,
} from "@/lib/mural/MuralBidding";
import { regionForBlock, computeDynamicBlockPrice } from "@/lib/mural/MuralMarketplace";

/**
 * Regras de negócio que envolvem dinheiro.
 *
 * Estes testes cobrem as decisões que, se quebrarem em produção, cobram o
 * valor errado de alguém: preço dos planos, piso do leilão e divisão da
 * receita. São funções puras, então dá para verificá-las de ponta a ponta sem
 * banco, sem rede e sem navegador.
 */

describe("Planos e preços (modelo híbrido)", () => {
  it("reproduz os exemplos oficiais do modelo de negócio", () => {
    // Basic: 4 blocos → $9,99 + (2,50 × 4)
    expect(computeCost("borda", 4).monthly).toBe(19.99);
    // Basic cheio: 6 blocos
    expect(computeCost("borda", 6).monthly).toBe(24.99);
    // Standard: 10 blocos → $20,99 + (3,50 × 10)
    expect(computeCost("intermediaria", 10).monthly).toBe(55.99);
    // Premium: 20 blocos → $49,99 + (5,00 × 20)
    expect(computeCost("centro_premium", 20).monthly).toBe(149.99);
  });

  it("nunca produz erro de ponto flutuante no total", () => {
    // 9.99 + 3 * 3.5 em float puro dá 20.490000000000002.
    for (const region of BLOCK_REGIONS) {
      const { min, max } = BLOCK_RANGES[region];
      for (let n = min; n <= max; n++) {
        const { monthly } = computeCost(region, n);
        expect(Number.isInteger(Math.round(monthly * 100))).toBe(true);
        expect(monthly).toBe(Math.round(monthly * 100) / 100);
      }
    }
  });

  it("decompõe o total em base + taxa por bloco", () => {
    const c = computeCost("intermediaria", 10);
    expect(c.base).toBe(20.99);
    expect(c.perBlock).toBe(3.5);
    expect(c.blocksTotal).toBe(35);
    // A identidade só é exata em CENTAVOS. Em float, 20.99 + 35 resulta em
    // 55.989999999999995 — foi este teste que expôs o problema e motivou o
    // cálculo interno em inteiros.
    expect(c.cents.base + c.cents.blocksTotal).toBe(c.cents.monthly);
  });

  it("a identidade base + blocos = total vale em TODA combinação (em centavos)", () => {
    for (const region of BLOCK_REGIONS) {
      const { min, max } = BLOCK_RANGES[region];
      for (let n = min; n <= max; n++) {
        const c = computeCost(region, n);
        expect(c.cents.base + c.cents.blocksTotal).toBe(c.cents.monthly);
        expect(c.cents.perBlock * c.blocks).toBe(c.cents.blocksTotal);
        expect(c.cents.monthly * 12).toBe(c.cents.yearly);
        // Todos os valores em centavos são inteiros — requisito do Stripe.
        expect(Number.isInteger(c.cents.monthly)).toBe(true);
      }
    }
  });

  it("as faixas dos planos são contíguas e sem sobreposição", () => {
    const ordered = BLOCK_REGIONS.map((r) => BLOCK_RANGES[r]).sort((a, b) => a.min - b.min);
    expect(ordered[0].min).toBe(1);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i].min).toBe(ordered[i - 1].max + 1);
    }
  });

  it("recusa quantidade fora da faixa do plano", () => {
    // Mínimo obrigatório: Standard começa em 7.
    expect(validateBlockCount("intermediaria", 6)).toMatch(/starts at 7/);
    expect(validateBlockCount("centro_premium", 12)).toMatch(/starts at 13/);
    // Teto.
    expect(validateBlockCount("borda", 7)).toMatch(/up to 6/);
    expect(validateBlockCount("centro_premium", 26)).toMatch(/up to 25/);
    // Zero ou negativo.
    expect(validateBlockCount("borda", 0)).toBeTruthy();
    // Dentro da faixa.
    expect(validateBlockCount("borda", 3)).toBeNull();
    expect(validateBlockCount("intermediaria", 7)).toBeNull();
    expect(validateBlockCount("centro_premium", 25)).toBeNull();
  });

  it("mapeia uma quantidade de blocos para exatamente um plano", () => {
    expect(planForBlockCount(1)?.region).toBe("borda");
    expect(planForBlockCount(6)?.region).toBe("borda");
    expect(planForBlockCount(7)?.region).toBe("intermediaria");
    expect(planForBlockCount(13)?.region).toBe("centro_premium");
    expect(planForBlockCount(26)).toBeNull();
  });

  it("limita a quantidade à faixa em vez de cobrar valor inválido", () => {
    // Passar 99 blocos num plano de 6 não pode gerar cobrança de 99.
    expect(computeCost("borda", 99).blocks).toBe(6);
    expect(computeCost("centro_premium", 1).blocks).toBe(13);
  });

  it("formata valores em USD de forma consistente", () => {
    expect(formatUsd(19.99)).toBe("$19.99");
    expect(formatUsd(3.5)).toBe("$3.50");
    expect(formatUsd(150)).toBe("$150");
  });

  it("sinaliza que o Stripe ainda não está configurado", () => {
    // Guarda de lançamento: enquanto os price_id forem placeholders, o
    // checkout real precisa falhar de forma explícita.
    expect(isStripeConfigured()).toBe(false);
  });
});

describe("Zonas do mural", () => {
  it("classifica coordenadas nas três zonas", () => {
    expect(regionForBlock(50, 25)).toBe("centro_premium");
    expect(regionForBlock(25, 20)).toBe("intermediaria");
    expect(regionForBlock(0, 0)).toBe("borda");
    expect(regionForBlock(399, 399)).toBe("borda");
  });

  it("o preço do bloco acompanha a zona e é estável", () => {
    expect(computeDynamicBlockPrice([], 50, 25)).toBe(PLANS.centro_premium.perBlockMonthlyUsd);
    expect(computeDynamicBlockPrice([], 25, 20)).toBe(PLANS.intermediaria.perBlockMonthlyUsd);
    expect(computeDynamicBlockPrice([], 0, 0)).toBe(PLANS.borda.perBlockMonthlyUsd);

    // Determinístico: o mesmo bloco custa o mesmo independentemente dos
    // vizinhos. A versão antiga aplicava +5% por marca adjacente.
    const semVizinhos = computeDynamicBlockPrice([], 50, 25);
    const comVizinhos = computeDynamicBlockPrice(
      [{ blocks: [{ x: 49, y: 25 }], id: "a" } as never, { blocks: [{ x: 51, y: 25 }], id: "b" } as never],
      50,
      25
    );
    expect(comVizinhos).toBe(semVizinhos);
  });

  it("blockPriceFor concorda com a tabela de planos", () => {
    for (const r of BLOCK_REGIONS) {
      expect(blockPriceFor(r)).toBe(PLANS[r].perBlockMonthlyUsd);
    }
  });
});

describe("Leilão de posições (takeover)", () => {
  it("o lance mínimo é 5× o valor pago", () => {
    expect(MIN_BID_MULTIPLIER).toBe(5);
    expect(minimumBidFor(100)).toBe(500);
    expect(minimumBidFor(3.99)).toBe(20); // arredonda para cima
    expect(minimumBidFor(0)).toBe(0);
  });

  it("recusa lances abaixo do piso", () => {
    const paid = 100;
    expect(MuralBiddingService.validateBid(499, paid).ok).toBe(false);
    expect(MuralBiddingService.validateBid(500, paid).ok).toBe(true);
    expect(MuralBiddingService.validateBid(501, paid).ok).toBe(true);
  });

  it("recusa valores inválidos sem quebrar", () => {
    for (const bad of [0, -10, NaN, Infinity]) {
      const r = MuralBiddingService.validateBid(bad, 100);
      expect(r.ok).toBe(false);
      expect(r.error).toBeTruthy();
    }
  });

  it("oferece presets de 5×, 10× e 20×", () => {
    const stats = MuralBiddingService.calculateBidStats(100);
    expect(stats.options.map((o) => o.multiplier)).toEqual([5, 10, 20]);
    expect(stats.options.map((o) => o.value)).toEqual([500, 1000, 2000]);
    expect(stats.minBid).toBe(500);
  });

  it("todo preset é sempre aceito pela validação", () => {
    for (const paid of [1, 3.99, 24.99, 149.99, 1000]) {
      for (const opt of MuralBiddingService.calculateBidStats(paid).options) {
        expect(MuralBiddingService.validateBid(opt.value, paid).ok).toBe(true);
      }
    }
  });
});

describe("Divisão da receita de takeover (30% plataforma / 70% dono)", () => {
  it("usa os percentuais acordados", () => {
    expect(REVENUE_SPLIT.platform).toBe(0.3);
    expect(REVENUE_SPLIT.owner).toBe(0.7);
    expect(REVENUE_SPLIT.owner + REVENUE_SPLIT.platform).toBe(1);
  });

  it("a soma das partes é SEMPRE igual ao total (nenhum centavo se perde)", () => {
    // Esta é a propriedade crítica: arredondar as duas partes de forma
    // independente faria a soma divergir do valor cobrado.
    for (let total = 1; total <= 3000; total++) {
      const { ownerNet, platformFee } = splitBid(total);
      expect(ownerNet + platformFee).toBe(total);
      expect(ownerNet).toBeGreaterThanOrEqual(0);
      expect(platformFee).toBeGreaterThanOrEqual(0);
    }
  });

  it("mantém a proporção dentro de 1 centavo", () => {
    for (const total of [20, 120, 499, 998, 1995, 149.99 * 5]) {
      const { ownerNet, platformFee } = splitBid(total);
      expect(Math.abs(ownerNet / total - 0.7)).toBeLessThan(0.01);
      expect(Math.abs(platformFee / total - 0.3)).toBeLessThan(0.01);
    }
  });

  it("exemplo dos Termos de Uso: oferta de $500 → $350 dono / $150 plataforma", () => {
    const { ownerNet, platformFee } = splitBid(500);
    expect(ownerNet).toBe(350);
    expect(platformFee).toBe(150);
  });
});
