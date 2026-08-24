import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────
// Regras do leilão (takeover de posição)
//
// Um anunciante pode ofertar pela posição de outro. As regras econômicas
// vivem todas aqui, para que interface, validação e liquidação nunca
// divirjam — antes o multiplicador mínimo estava neste arquivo, mas o
// modal tinha sua própria cópia dos cálculos.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Multiplicador mínimo sobre o valor pago pelo dono atual.
 *
 * Um piso alto é intencional: sem ele, qualquer marca poderia hostilizar
 * posições por centavos acima do valor original, e ninguém teria segurança
 * para investir numa posição central.
 */
export const MIN_BID_MULTIPLIER = 5;

/** Presets oferecidos na interface, como múltiplos do valor pago. */
export const BID_MULTIPLIERS = [
  { key: "opportunity", label: "Opportunity", multiplier: 5 },
  { key: "dominance", label: "Dominance", multiplier: 10 },
  { key: "open", label: "Open", multiplier: 20 },
] as const;

/**
 * Divisão da receita de um takeover aceito.
 *
 * A plataforma retém 30% de toda negociação de bid; 70% vão para o dono do
 * bloco. O mesmo percentual da comissão de campanhas, para o usuário não
 * precisar memorizar duas regras diferentes.
 *
 * ⚠️ Intencionalmente NÃO exibido na interface do lance. O ofertante vê
 * apenas o valor que vai pagar; o dono vê o valor líquido que vai receber.
 * O percentual é divulgado nos Termos de Uso (`src/pages/TermosPage.tsx`).
 */
export const REVENUE_SPLIT = {
  /** Parcela do dono do bloco. */
  owner: 0.7,
  /** Parcela da plataforma. */
  platform: 0.3,
} as const;

export interface BidOption {
  key: string;
  label: string;
  multiplier: number;
  value: number;
  description: string;
}

/**
 * Resultado da validação de um lance.
 *
 * `error` é sempre presente (nulo quando válido) em vez de uma união
 * discriminada: o TypeScript não estreita a união de forma confiável dentro
 * de expressões JSX, e a versão anterior obrigava cada chamador a duplicar
 * um `ok ? ... : ...` só para acessar a mensagem.
 */
export interface BidValidation {
  ok: boolean;
  error: string | null;
}

export interface BidStats {
  /** Valor pago pelo dono atual — base de todo o cálculo. */
  marketValue: number;
  /** Menor lance aceitável. */
  minBid: number;
  options: BidOption[];
}

/** Valor líquido para o dono e a taxa da plataforma, dado um lance. */
export function splitBid(total: number): { ownerNet: number; platformFee: number } {
  // O líquido do dono é arredondado e a taxa é o resto, para que
  // ownerNet + platformFee === total sempre — sem centavos evaporando.
  const ownerNet = Math.round(total * REVENUE_SPLIT.owner);
  return { ownerNet, platformFee: total - ownerNet };
}

/** Menor lance aceitável para uma posição comprada por `purchaseValue`. */
export function minimumBidFor(purchaseValue: number): number {
  return Math.ceil(Math.max(0, purchaseValue) * MIN_BID_MULTIPLIER);
}

export const MuralBiddingService = {
  /** Calcula o piso e os presets de lance para uma posição. */
  calculateBidStats(purchaseValue: number): BidStats {
    const base = Math.max(0, purchaseValue);
    return {
      marketValue: base,
      minBid: minimumBidFor(base),
      options: BID_MULTIPLIERS.map((m) => ({
        key: m.key,
        label: m.label,
        multiplier: m.multiplier,
        value: Math.ceil(base * m.multiplier),
        description: `${m.multiplier}× the amount paid`,
      })),
    };
  },

  /**
   * Valida um lance contra as regras do leilão.
   *
   * Existe como função pura para poder ser chamada tanto pelo formulário
   * (feedback imediato) quanto pelo envio (última barreira no cliente).
   */
  validateBid(amount: number, purchaseValue: number): BidValidation {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "Enter a valid amount." };
    }
    const min = minimumBidFor(purchaseValue);
    if (amount < min) {
      return {
        ok: false,
        error: `The minimum bid for this position is $${min.toLocaleString("en-US")} (${MIN_BID_MULTIPLIER}× the amount paid).`,
      };
    }
    return { ok: true, error: null };
  },

  /** Envia um lance, revalidando as regras antes de tocar no banco. */
  async submitBid(params: {
    fromCompanyId: string;
    toBrandId: string;
    blockId?: string;
    amount: number;
    /** Valor pago pelo dono atual, para revalidar o piso no envio. */
    purchaseValue: number;
  }) {
    const check = this.validateBid(params.amount, params.purchaseValue);
    if (!check.ok) throw new Error(check.error);

    // `position_bids` não existe nos tipos gerados do Supabase (a tabela foi
    // criada por migração posterior). O cast evita o erro de sobrecarga sem
    // afrouxar a tipagem do resto do arquivo.
    const { data, error } = await (supabase.from("position_bids" as never) as never as {
      insert: (v: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).insert({
      from_company_id: params.fromCompanyId,
      to_brand_id: params.toBrandId,
      block_id: params.blockId,
      amount: params.amount,
      status: "pending",
    });

    if (error) throw new Error(error.message);
    return data;
  },
};
