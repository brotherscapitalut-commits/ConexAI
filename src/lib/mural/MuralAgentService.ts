import { useMuralConfigStore } from "@/store/useMuralConfigStore";
import type { MuralBrand } from "./types";

export interface GapReport {
  x: number;
  y: number;
  size: number; // contiguous free blocks
  zone: string;
}

export class MuralAgentService {
  /**
   * Executa uma auditoria completa no grid para encontrar bolsões vazios (gaps).
   */
  static runGapDetection(brands: MuralBrand[]): GapReport[] {
    const { gridCols, gridRows, premiumZone } = useMuralConfigStore.getState();
    const occupied = new Set<string>();
    
    for (const b of brands) {
      if (!b.blocks) continue;
      for (const block of b.blocks) {
        occupied.add(`${block.x},${block.y}`);
      }
    }

    const gaps: GapReport[] = [];
    const visited = new Set<string>();

    for (let y = 0; y < gridRows; y++) {
      for (let x = 0; x < gridCols; x++) {
        const key = `${x},${y}`;
        if (!occupied.has(key) && !visited.has(key)) {
          // Iniciar flood fill para descobrir o tamanho deste gap
          let size = 0;
          const queue = [{ cx: x, cy: y }];
          visited.add(key);
          
          while (queue.length > 0) {
            const curr = queue.shift()!;
            size++;
            
            const neighbors = [
              { cx: curr.cx + 1, cy: curr.cy },
              { cx: curr.cx - 1, cy: curr.cy },
              { cx: curr.cx, cy: curr.cy + 1 },
              { cx: curr.cx, cy: curr.cy - 1 },
            ];

            for (const n of neighbors) {
              const nKey = `${n.cx},${n.cy}`;
              if (
                n.cx >= 0 && n.cx < gridCols &&
                n.cy >= 0 && n.cy < gridRows &&
                !occupied.has(nKey) &&
                !visited.has(nKey)
              ) {
                visited.add(nKey);
                queue.push(n);
              }
            }
          }

          // Determinar zona (simplificado para relatório)
          let zone = "borda";
          if (x >= premiumZone.x1 && x <= premiumZone.x2 && y >= premiumZone.y1 && y <= premiumZone.y2) {
            zone = "centro_premium";
          }
          
          gaps.push({ x, y, size, zone });
        }
      }
    }

    // Ordenar por tamanho do buraco (menores primeiro, que geram maior escassez)
    return gaps.sort((a, b) => a.size - b.size);
  }

  /**
   * Sugere ajustes automáticos de limites da zona Premium baseado na densidade.
   */
  static suggestZoneAdjustments(brands: MuralBrand[]) {
    // Placeholder lógico para o Agente propor expansão ou retração das zonas
    console.log("[MuralAgent] Auditando densidade de alocação...");
    return { action: "keep", reason: "Densidade dentro da normalidade." };
  }
}
