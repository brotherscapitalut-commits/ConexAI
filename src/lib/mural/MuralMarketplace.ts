// src/lib/mural/MuralMarketplace.ts

import { BlockBid, MuralBrand } from "./types";
import { blockPriceFor, type BlockRegion } from "@/lib/stripe";
import { REVENUE_SPLIT } from "./MuralBidding";
import { useMuralConfigStore } from "@/store/useMuralConfigStore";

/**
 * Zona de um bloco a partir das coordenadas.
 *
 * Os limites são os mesmos de PREMIUM_ZONE / INTERMEDIATE_ZONE em types.ts,
 * repetidos aqui porque este módulo não deve depender do renderer.
 */
export function regionForBlock(x: number, y: number): BlockRegion {
  const { premiumZone, intermediateZone } = useMuralConfigStore.getState();
  
  if (x >= premiumZone.x1 && x <= premiumZone.x2 && y >= premiumZone.y1 && y <= premiumZone.y2) {
    return "centro_premium";
  }
  if (x >= intermediateZone.x1 && x <= intermediateZone.x2 && y >= intermediateZone.y1 && y <= intermediateZone.y2) {
    return "intermediaria";
  }
  return "borda";
}

/**
 * Preço MENSAL de um bloco, conforme a zona onde ele está.
 *
 * No modelo híbrido, este é apenas o componente por bloco — a assinatura base
 * do plano é cobrada à parte (ver `computeCost` em lib/stripe).
 *
 * A versão original cobrava 299 / 899 / 1499 por zona e ainda aplicava +5%
 * por marca vizinha, o que fazia o preço do mesmo bloco mudar conforme os
 * vizinhos entravam e saíam — o comprador não tinha como prever o valor.
 * A assinatura mantém `brands` para não quebrar chamadores; ele é ignorado.
 */
export function computeDynamicBlockPrice(
  brands: MuralBrand[],
  x: number,
  y: number
): number {
  const region = regionForBlock(x, y);
  let basePrice = blockPriceFor(region);
  
  // Regra de Escassez: Se sobrar blocos isolados no Centro Premium (1 ou 2 blocos de espaço)
  if (region === "centro_premium" && brands.length > 0) {
    // Conta espaço livre contíguo (flood fill simplificado limitando a 3 blocos)
    const { gridCols, gridRows, scarcityMultiplier } = useMuralConfigStore.getState();
    const occupied = new Set<string>();
    for (const b of brands) {
      if (!b.blocks) continue;
      for (const block of b.blocks) occupied.add(`${block.x},${block.y}`);
    }
    
    if (!occupied.has(`${x},${y}`)) {
      let freeCount = 0;
      const visited = new Set<string>();
      const queue = [{ cx: x, cy: y }];
      
      while (queue.length > 0 && freeCount <= 3) {
        const { cx, cy } = queue.shift()!;
        const key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        visited.add(key);
        
        if (cx >= 0 && cx < gridCols && cy >= 0 && cy < gridRows && !occupied.has(key)) {
          freeCount++;
          // Adiciona vizinhos ortogonais
          queue.push({ cx: cx + 1, cy });
          queue.push({ cx: cx - 1, cy });
          queue.push({ cx, cy: cy + 1 });
          queue.push({ cx, cy: cy - 1 });
        }
      }
      
      // Se houver apenas 1 ou 2 blocos de espaço livre formando este bolsão
      if (freeCount > 0 && freeCount <= 2) {
        basePrice = basePrice * scarcityMultiplier;
      }
    }
  }
  
  return basePrice;
}

/**
 * PROCESSADOR DE OFERTAS GAIMIFICADO
 * Se o dono aceitar, a transferência de propriedade deve ser atômica.
 */
export async function processBidAcceptance(
  bid: BlockBid,
  ownerBrand: MuralBrand,
  bidderBrand: MuralBrand
) {
  // 1. Verificação de Integridade
  if (bid.status !== "pending") throw new Error("Este lance já foi processado.");

  try {
    // 2. Gateway de Pagamento (Integração com Stripe/Carteira)
    // Aqui o sistema valida se o 'bid.value' foi capturado
    console.log(`Processando pagamento de $${bid.value} de ${bidderBrand.name}...`);

    // 3. TRANSFERÊNCIA DE BLOCO (O Coração do Sistema)
    // Remove o bloco do dono atual e adiciona ao comprador
    const blockToTransfer = ownerBrand.blocks.find(b => `${b.x},${b.y}` === bid.blockKey);

    if (blockToTransfer) {
      ownerBrand.blocks = ownerBrand.blocks.filter(b => `${b.x},${b.y}` !== bid.blockKey);
      bidderBrand.blocks.push(blockToTransfer);
    }

    // 4. Liquidação: 55% para o dono, 45% para a plataforma.
    //    Os percentuais vêm de REVENUE_SPLIT para que a divisão praticada
    //    aqui e a divulgada nos Termos de Uso nunca divirjam.
    const ownerNet = Math.round(bid.value * REVENUE_SPLIT.owner);
    const platformFee = bid.value - ownerNet;
    console.log(`Split: owner $${ownerNet}, platform $${platformFee}`);

    bid.status = "accepted";

    return { success: true, message: "Position transferred.", ownerNet, platformFee };
  } catch (error) {
    bid.status = "failed";
    return { success: false, error };
  }
}