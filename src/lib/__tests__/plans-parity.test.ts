import { describe, it, expect } from "vitest";
import { PLANS as CLIENT_PLANS, BLOCK_REGIONS, computeCost } from "@/lib/stripe";
import {
  PLANS as SERVER_PLANS,
  computeCostCents,
  validateBlockCount as serverValidate,
} from "../../../server/plans.js";

/**
 * Paridade entre a tabela de planos do cliente e a do servidor.
 *
 * O servidor é JS puro e não importa `src/lib/stripe.ts`, então a tabela de
 * preços existe duplicada. Duplicação de regra de dinheiro é perigosa: alguém
 * reajusta o preço no arquivo do frontend, a tela passa a mostrar o valor
 * novo, e o Stripe continua cobrando o antigo — sem nenhum erro visível.
 *
 * Estes testes falham no instante em que as duas divergirem.
 */

interface ServerPlan {
  region: string;
  name: string;
  baseMonthlyUsd: number;
  perBlockMonthlyUsd: number;
  minBlocks: number;
  maxBlocks: number;
}

const serverPlans = SERVER_PLANS as Record<string, ServerPlan>;

describe("Paridade cliente ↔ servidor da tabela de planos", () => {
  it("cobre exatamente as mesmas regiões", () => {
    expect(Object.keys(serverPlans).sort()).toEqual([...BLOCK_REGIONS].sort());
  });

  it("os valores de cada plano são idênticos nos dois lados", () => {
    for (const region of BLOCK_REGIONS) {
      const client = CLIENT_PLANS[region];
      const server = serverPlans[region];

      expect(server, `região ${region} ausente no servidor`).toBeDefined();
      expect(server.name).toBe(client.name);
      expect(server.baseMonthlyUsd).toBe(client.baseMonthlyUsd);
      expect(server.perBlockMonthlyUsd).toBe(client.perBlockMonthlyUsd);
      expect(server.minBlocks).toBe(client.minBlocks);
      expect(server.maxBlocks).toBe(client.maxBlocks);
    }
  });

  it("o total cobrado pelo servidor bate com o exibido pelo cliente", () => {
    // O que o usuário vê na tela precisa ser exatamente o que a fatura mostra.
    for (const region of BLOCK_REGIONS) {
      const { minBlocks, maxBlocks } = CLIENT_PLANS[region];
      for (let n = minBlocks; n <= maxBlocks; n++) {
        const client = computeCost(region, n);
        const server = computeCostCents(region, n);

        expect(server.monthlyCents).toBe(client.cents.monthly);
        expect(server.baseCents).toBe(client.cents.base);
        expect(server.blocksTotalCents).toBe(client.cents.blocksTotal);
        expect(server.blocks).toBe(client.blocks);
      }
    }
  });

  it("as duas validações de faixa concordam sobre o que aceitar", () => {
    for (const region of BLOCK_REGIONS) {
      for (let n = 0; n <= 30; n++) {
        const clientRejects = Boolean(
          n < CLIENT_PLANS[region].minBlocks || n > CLIENT_PLANS[region].maxBlocks || n < 1
        );
        const serverRejects = serverValidate(region, n) !== null;
        expect(serverRejects, `região ${region}, ${n} blocos`).toBe(clientRejects);
      }
    }
  });

  it("o servidor recusa região desconhecida em vez de assumir um padrão", () => {
    // Cair silenciosamente no plano mais barato seria uma brecha de preço.
    expect(serverValidate("centro_de_ouro", 5)).toBeTruthy();
    expect(() => computeCostCents("centro_de_ouro", 5)).toThrow();
  });
});
