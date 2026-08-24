import {
  GRID_COLS,
  GRID_ROWS,
  PREMIUM_ZONE,
  INTERMEDIATE_ZONE,
  type Viewport,
  type MuralState,
  type ZoneName,
  type MuralBrand,
  type MuralBlock,
} from "./types";
import { useMuralConfigStore } from "@/store/useMuralConfigStore";

// ── City Districts (Distritos Temáticos) ──────────────────────

export interface CityDistrict {
  id: string;
  name: string;
  shortName: string;
  /** Grid bounds */
  x1: number; x2: number; y1: number; y2: number;
  /** Neon border color */
  neonColor: string;
  /** Subtle bg tint */
  bgTint: string;
  /** District accent for label */
  labelColor: string;
  /** Category affinities for sector connection lines */
  categories: string[];
}

/**
 * 5 curated districts sized to cover the actual brand data.
 * Mock brands live in x:8–50, y:6–50.
 * Real DB brands target the PREMIUM/INTERMEDIATE zones (x:20–80, y:8–42).
 * Districts are repositioned to guarantee brands appear INSIDE each district.
 */
export const CITY_DISTRICTS: CityDistrict[] = [
  {
    id: "financial_district",
    name: "Financial District",
    shortName: "FIN",
    // Covers mock center (Elite Plus at 24-27,12-15) + premium zone overlap
    x1: 12, x2: 32, y1: 6, y2: 22,
    neonColor: "rgba(255, 215, 0, 0.5)",
    bgTint: "rgba(255, 215, 0, 0.03)",
    labelColor: "#FFD700",
    categories: ["finanças", "finance", "fintech", "banking", "investimento"],
  },
  {
    id: "tech_hub",
    name: "Tech Hub",
    shortName: "TECH",
    // Top-right quadrant of mock data
    x1: 30, x2: 52, y1: 6, y2: 24,
    neonColor: "rgba(0, 212, 255, 0.5)",
    bgTint: "rgba(0, 212, 255, 0.03)",
    labelColor: "#00D4FF",
    categories: ["tecnologia", "tech", "software", "saas", "ia", "ai", "educação"],
  },
  {
    id: "luxury_avenue",
    name: "Luxury Avenue",
    shortName: "LUX",
    // Right side, lower half of mock data
    x1: 32, x2: 52, y1: 28, y2: 52,
    neonColor: "rgba(180, 120, 255, 0.5)",
    bgTint: "rgba(180, 120, 255, 0.03)",
    labelColor: "#B478FF",
    categories: ["moda", "luxo", "beleza", "lifestyle", "fashion", "esportes"],
  },
  {
    id: "media_plaza",
    name: "Media Plaza",
    shortName: "MID",
    // Left column of mock data
    x1: 8, x2: 16, y1: 20, y2: 52,
    neonColor: "rgba(255, 80, 120, 0.5)",
    bgTint: "rgba(255, 80, 120, 0.03)",
    labelColor: "#FF5078",
    categories: ["entretenimento", "streaming", "marketing", "publicidade", "serviços"],
  },
  {
    id: "health_district",
    name: "Health District",
    shortName: "HLT",
    // Bottom center of mock data
    x1: 14, x2: 34, y1: 34, y2: 54,
    neonColor: "rgba(0, 255, 160, 0.5)",
    bgTint: "rgba(0, 255, 160, 0.03)",
    labelColor: "#00FFA0",
    categories: ["saúde", "health", "fitness", "bem-estar", "alimentação"],
  },
];

export function getDistrictForBlock(gx: number, gy: number): CityDistrict | null {
  for (const d of CITY_DISTRICTS) {
    if (gx >= d.x1 && gx <= d.x2 && gy >= d.y1 && gy <= d.y2) return d;
  }
  return null;
}

/** Returns nearby block IDs (for gravity hover effect), radius in grid cells */
export function getGravityRadius(gx: number, gy: number, radiusCells: number): { gx: number; gy: number; dist: number }[] {
  const result: { gx: number; gy: number; dist: number }[] = [];
  for (let dy = -radiusCells; dy <= radiusCells; dy++) {
    for (let dx = -radiusCells; dx <= radiusCells; dx++) {
      if (dx === 0 && dy === 0) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radiusCells) {
        const ngx = gx + dx;
        const ngy = gy + dy;
        const { gridCols, gridRows } = useMuralConfigStore.getState();
        if (ngx >= 0 && ngx < gridCols && ngy >= 0 && ngy < gridRows) {
          result.push({ gx: ngx, gy: ngy, dist });
        }
      }
    }
  }
  return result;
}

export interface TerritoryRect {
  gx: number;
  gy: number;
  w: number;
  h: number;
  brand: MuralBrand;
}

export interface NeuralConnection {
  fromId: string;
  toId: string;
  score: number;
}

export interface MuralDataCache {
  blockMap: Map<number, MuralBrand>;
  neuralConnections: NeuralConnection[];
}

// ── Helpers de Performance Extrema ───────────────────────────

export const getBlockId = (x: number, y: number): number => {
  const { gridCols } = useMuralConfigStore.getState();
  return y * gridCols + x;
};

export const getCoordsFromId = (id: number): { x: number; y: number } => {
  const { gridCols } = useMuralConfigStore.getState();
  return {
    x: id % gridCols,
    y: (id / gridCols) | 0,
  };
};

// ── Lógica de Coordenadas (Estilo Planilha) ──────────────────

export function columnIndexToSpreadsheetLetters(col: number): string {
  let result = "";
  let n = col;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = ((n / 26) | 0) - 1;
  }
  return result;
}

export function columnToLabel(index: number): string {
  return columnIndexToSpreadsheetLetters(index);
}

export function gridToCoordinate(gx: number, gy: number): string {
  return `${columnIndexToSpreadsheetLetters(gx)}${gy + 1}`;
}

export function coordinateToGrid(coord: string): { gx: number; gy: number } | null {
  const m = coord.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const colStr = m[1];
  const row = parseInt(m[2], 10);
  const { gridCols, gridRows } = useMuralConfigStore.getState();
  if (row < 1 || row > gridRows) return null;

  let gx = 0;
  for (let i = 0; i < colStr.length; i++) {
    gx = gx * 26 + (colStr.charCodeAt(i) - 64);
  }
  gx--;
  return (gx < 0 || gx >= gridCols) ? null : { gx, gy: row - 1 };
}

// ── Zonas com Feedback de Brilho ──────────────────────────────

export interface ZoneFeedback {
  zone: ZoneName;
  glowMultiplier: number;
}

export function getZoneName(x: number, y: number, hasTopConnection: boolean = false): ZoneFeedback {
  const { premiumZone, intermediateZone } = useMuralConfigStore.getState();
  const isP = x >= premiumZone.x1 && x <= premiumZone.x2 && y >= premiumZone.y1 && y <= premiumZone.y2;
  if (isP) return { zone: "premium", glowMultiplier: hasTopConnection ? 3.0 : 1.5 };
  
  const isI = x >= intermediateZone.x1 && x <= intermediateZone.x2 && y >= intermediateZone.y1 && y <= intermediateZone.y2;
  if (isI) return { zone: "intermediate", glowMultiplier: 1.0 };
  
  return { zone: "border", glowMultiplier: 0.5 };
}

export function isZoneBorder(x: number, y: number): "premium" | "intermediate" | null {
  const { premiumZone, intermediateZone } = useMuralConfigStore.getState();
  if (
    (x === premiumZone.x1 && y >= premiumZone.y1 && y <= premiumZone.y2) ||
    (x === premiumZone.x2 && y >= premiumZone.y1 && y <= premiumZone.y2) ||
    (y === premiumZone.y1 && x >= premiumZone.x1 && x <= premiumZone.x2) ||
    (y === premiumZone.y2 && x >= premiumZone.x1 && x <= premiumZone.x2)
  )
    return "premium";
  if (
    (x === intermediateZone.x1 && y >= intermediateZone.y1 && y <= intermediateZone.y2) ||
    (x === intermediateZone.x2 && y >= intermediateZone.y1 && y <= intermediateZone.y2) ||
    (y === intermediateZone.y1 && x >= intermediateZone.x1 && x <= intermediateZone.x2) ||
    (y === intermediateZone.y2 && x >= intermediateZone.x1 && x <= intermediateZone.x2)
  )
    return "intermediate";
  return null;
}

// ── Geometria e Viewport (Culling) ───────────────────────────

export function computeCellSize(containerW: number, containerH: number): number {
  const { gridCols, gridRows } = useMuralConfigStore.getState();
  return Math.min(containerW / gridCols, containerH / gridRows);
}

export function getInitialZoom(containerW: number, containerH: number): number {
  const { gridCols, gridRows } = useMuralConfigStore.getState();
  const baseCellSize = computeCellSize(containerW, containerH);
  const zoomX = containerW / (gridCols * baseCellSize);
  const zoomY = containerH / (gridRows * baseCellSize);
  return clampZoom(Math.min(zoomX, zoomY));
}

export function getTerritoryRange(brand: MuralBrand): string {
  if (!brand.blocks.length) return "";
  const labels = brand.blocks.map((b) => gridToCoordinate(b.x, b.y));
  if (labels.length === 1) return labels[0];
  const sorted = [...labels].sort((a, b) => {
    const ga = coordinateToGrid(a);
    const gb = coordinateToGrid(b);
    if (!ga || !gb) return 0;
    return ga.gy !== gb.gy ? ga.gy - gb.gy : ga.gx - gb.gx;
  });
  return `${sorted[0]} – ${sorted[sorted.length - 1]}`;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 8;

// ── Palco (stage) ─────────────────────────────────────────────
//
// O grid tem 400×400 = 160.000 blocos, mas na prática apenas algumas
// centenas estão ocupados. Deixar o usuário afastar até enxergar o grid
// inteiro transforma todas as marcas num ponto no meio de um vazio.
//
// O "palco" resolve isso: é o retângulo que contém as marcas existentes,
// com uma folga de respiro. O zoom-out trava no ponto em que esse
// retângulo preenche a viewport, e o pan não deixa o palco sair de vista.
// Nada disso toca nas coordenadas salvas no banco — é só enquadramento.

/** Folga em células ao redor do conteúdo, para o palco não ficar apertado. */
const STAGE_PADDING_CELLS = 3;

/**
 * Quantas vezes o usuário pode aproximar além do enquadramento do palco.
 *
 * O teto de zoom precisa ser relativo, não absoluto: `computeCellSize`
 * deriva o tamanho da célula de um grid de 400×400, então numa viewport de
 * 1920×1080 uma célula mede ~2,7px e o zoom que enquadra algumas dezenas de
 * blocos já passa de 15×. Com o antigo MAX_ZOOM fixo em 8, o piso do palco
 * encostaria no teto e o zoom travaria por completo.
 */
const STAGE_ZOOM_RANGE = 6;

/**
 * Tamanho mínimo de um bloco, em pixels de tela, no zoom mais afastado.
 *
 * Enquadrar todo o conteúdo é bom até o ponto em que os blocos ficam tão
 * pequenos que a marca some — numa tela de celular com marcas espalhadas,
 * o enquadramento puro produziria blocos de ~4px, ou seja, exatamente o
 * "quadradinho sem marca" que queremos evitar. Quando os dois objetivos
 * conflitam, a legibilidade vence e o usuário navega por pan.
 */
const MIN_TILE_PX = 10;

export interface StageRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface StageState {
  rect: StageRect;
  /** Zoom em que o palco preenche exatamente a viewport (piso do zoom-out). */
  minZoom: number;
  /** Teto de aproximação, relativo ao piso. */
  maxZoom: number;
}

let stage: StageState | null = null;

/**
 * Define o palco a partir do retângulo que contém as marcas.
 * Passe `null` para voltar ao comportamento de grid inteiro (ex.: mural vazio).
 */
export function setStage(rect: StageRect | null, containerW: number, containerH: number): void {
  if (!rect) {
    stage = null;
    return;
  }

  const baseCellSize = computeCellSize(containerW, containerH);
  const cols = Math.max(1, rect.maxX - rect.minX + 1) + STAGE_PADDING_CELLS * 2;
  const rows = Math.max(1, rect.maxY - rect.minY + 1) + STAGE_PADDING_CELLS * 2;

  // Zoom em que o palco cabe inteiro na tela. É o piso do zoom-out:
  // afastar mais só produziria vazio.
  const fitZoom = Math.max(MIN_ZOOM, Math.min(containerW / (cols * baseCellSize), containerH / (rows * baseCellSize)));

  // Piso de legibilidade: zoom em que um bloco mede MIN_TILE_PX na tela.
  const readableZoom = MIN_TILE_PX / baseCellSize;

  // O maior dos dois vence. Na prática o enquadramento quase sempre ganha;
  // o piso de legibilidade só entra quando o conteúdo está muito espalhado
  // para a viewport (típico de telas pequenas).
  const floorZoom = Math.max(fitZoom, readableZoom);

  stage = {
    rect: {
      minX: rect.minX - STAGE_PADDING_CELLS,
      maxX: rect.maxX + STAGE_PADDING_CELLS,
      minY: rect.minY - STAGE_PADDING_CELLS,
      maxY: rect.maxY + STAGE_PADDING_CELLS,
    },
    minZoom: floorZoom,
    // Teto sempre acima do piso, senão o zoom ficaria travado num único valor
    maxZoom: Math.max(floorZoom * STAGE_ZOOM_RANGE, MAX_ZOOM),
  };
}

/** Zoom que enquadra o palco inteiro — o mesmo valor usado como piso do zoom-out. */
export function getStageFitZoom(): number | null {
  return stage?.minZoom ?? null;
}

export function getStageRect(): StageRect | null {
  return stage?.rect ?? null;
}

export function clampPan(state: MuralState): void {
  const cellSize = computeCellSize(state.containerWidth, state.containerHeight) * state.zoom;

  // Com palco definido, o pan é limitado ao retângulo do conteúdo.
  // Sem palco, cai no comportamento antigo (grid inteiro).
  const rect = stage?.rect;
  const originX = rect ? rect.minX : 0;
  const originY = rect ? rect.minY : 0;
  const cols = rect ? rect.maxX - rect.minX + 1 : GRID_COLS;
  const rows = rect ? rect.maxY - rect.minY + 1 : GRID_ROWS;

  const stageW = cols * cellSize;
  const stageH = rows * cellSize;

  // Deslocamento de tela da origem do palco
  const offsetX = originX * cellSize;
  const offsetY = originY * cellSize;

  // Margem de arrasto: sem palco mantém os 30% antigos; com palco é bem
  // menor, para o conteúdo não conseguir escapar para fora da viewport.
  const marginX = state.containerWidth * (rect ? 0.12 : 0.3);
  const marginY = state.containerHeight * (rect ? 0.12 : 0.3);

  const maxPanX = marginX - offsetX;
  const minPanX = state.containerWidth - stageW - marginX - offsetX;

  const maxPanY = marginY - offsetY;
  const minPanY = state.containerHeight - stageH - marginY - offsetY;

  // Quando o palco é menor que a viewport, não há o que arrastar: centraliza.
  if (minPanX > maxPanX) {
    state.panX = (state.containerWidth - stageW) / 2 - offsetX;
  } else {
    state.panX = Math.max(minPanX, Math.min(maxPanX, state.panX));
  }

  if (minPanY > maxPanY) {
    state.panY = (state.containerHeight - stageH) / 2 - offsetY;
  } else {
    state.panY = Math.max(minPanY, Math.min(maxPanY, state.panY));
  }
}

export function clampZoom(zoom: number): number {
  // Com palco definido, a faixa de zoom passa a ser relativa ao
  // enquadramento do conteúdo: o piso impede o mural de virar um ponto ao
  // afastar, e o teto acompanha o piso para sempre sobrar aproximação.
  if (stage) return Math.max(stage.minZoom, Math.min(stage.maxZoom, zoom));
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

// ── Adjacência Estratégica (Match Score) ─────────────────────

export function getMatchScore(brandA: MuralBrand, brandB: MuralBrand): number {
  if (brandA.id === brandB.id) return 0;
  let score = 0;
  
  // Categorias similares ou idênticas rendem bônus enorme (Afinidade Real)
  if (brandA.category === brandB.category) score += 50;
  
  // Mix Empresa/Influencer (Interação B2B2C) recebe bônus de Marketplace
  if (brandA.mural_type !== brandB.mural_type) score += 30;
  
  // Popularidade (Clicks) atrai gravidade
  const pop = (brandA.clicks + brandB.clicks) / 1000;
  score += Math.min(20, pop);
  
  return score;
}

// ── Gerenciamento de Dados (O(1) Map + Relações) ──────────────

export function buildBlockMap(brands: MuralBrand[]): MuralDataCache {
  const map = new Map<number, MuralBrand>();
  const connections: NeuralConnection[] = [];

  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    if (!brand.blocks) continue;
    for (let j = 0; j < brand.blocks.length; j++) {
      const b = brand.blocks[j];
      map.set(getBlockId(b.x, b.y), brand);
    }
  }

  // Gera Conexões Neurais (apenas matchings de alto valor)
  for (let i = 0; i < brands.length; i++) {
    for (let j = i + 1; j < brands.length; j++) {
      const score = getMatchScore(brands[i], brands[j]);
      if (score > 60) {
        connections.push({ fromId: brands[i].id, toId: brands[j].id, score });
      }
    }
  }

  return { blockMap: map, neuralConnections: connections };
}

// ── Viewport com "Overflow Controlado" para Linhas ────────────

export function getVisibleViewport(state: MuralState, hasActiveConnections: boolean = false): Viewport {
  const cellSize = computeCellSize(state.containerWidth, state.containerHeight) * state.zoom;
  const invCellSize = 1 / cellSize;
  
  // "Visual Culling de Linhas": Aumentamos a margem exponencialmente quando há linhas para evitar corte abrupto
  const margin = hasActiveConnections ? 12 : 2;

  const x1 = Math.max(0, ((-state.panX * invCellSize) | 0) - margin);
  const y1 = Math.max(0, ((-state.panY * invCellSize) | 0) - margin);
  const x2 = Math.min(GRID_COLS - 1, (((-state.panX + state.containerWidth) * invCellSize) | 0) + margin);
  const y2 = Math.min(GRID_ROWS - 1, (((-state.panY + state.containerHeight) * invCellSize) | 0) + margin);

  return { x: x1, y: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
}

export function getBrandCenter(brand: MuralBrand): { cx: number; cy: number } {
  if (brand.blocks.length === 0) return { cx: 0, cy: 0 };
  const cx = brand.blocks.reduce((s, b) => s + b.x, 0) / brand.blocks.length;
  const cy = brand.blocks.reduce((s, b) => s + b.y, 0) / brand.blocks.length;
  return { cx, cy };
}

export interface Cluster {
  brand: MuralBrand;
  cx: number;
  cy: number;
  blockCount: number;
}

export function clusterBrands(
  brands: MuralBrand[],
  viewport: Viewport,
  zoom: number
): Cluster[] {
  if (zoom >= 1.2) return [];
  return brands
    .filter((b) => {
      const { cx, cy } = getBrandCenter(b);
      return (
        cx >= viewport.x &&
        cx <= viewport.x + viewport.width &&
        cy >= viewport.y &&
        cy <= viewport.y + viewport.height
      );
    })
    .map((b) => {
      const { cx, cy } = getBrandCenter(b);
      return { brand: b, cx, cy, blockCount: b.blocks.length };
    });
}

// ── O Motor de Renderização Otimizado (Greedy Merge) ──────────

export function getMergedTerritoriesInViewport(
  blockMap: Map<number, MuralBrand>,
  viewport: Viewport
): TerritoryRect[] {
  const rects: TerritoryRect[] = [];
  const visited = new Uint8Array(GRID_COLS * GRID_ROWS);

  const startX = viewport.x;
  const startY = viewport.y;
  const endX = startX + viewport.width;
  const endY = startY + viewport.height;

  for (let gy = startY; gy < endY; gy++) {
    for (let gx = startX; gx < endX; gx++) {
      const id = getBlockId(gx, gy);

      if (visited[id]) continue;
      const brand = blockMap.get(id);
      if (!brand) continue;

      let w = 1;
      while (
        gx + w < endX &&
        !visited[id + w] &&
        blockMap.get(id + w)?.id === brand.id
      ) {
        w++;
      }

      let h = 1;
      outer: while (gy + h < endY) {
        for (let dx = 0; dx < w; dx++) {
          const nextId = getBlockId(gx + dx, gy + h);
          if (visited[nextId] || blockMap.get(nextId)?.id !== brand.id) {
            break outer;
          }
        }
        h++;
      }

      for (let dy = 0; dy < h; dy++) {
        const rowOffset = (gy + dy) * GRID_COLS;
        for (let dx = 0; dx < w; dx++) {
          visited[rowOffset + (gx + dx)] = 1;
        }
      }

      rects.push({ gx, gy, w, h, brand });
    }
  }
  return rects;
}

export function screenToGrid(
  screenX: number,
  screenY: number,
  state: MuralState
): { gx: number; gy: number } | null {
  const cellSize = computeCellSize(state.containerWidth, state.containerHeight) * state.zoom;
  const gx = ((screenX - state.panX) / cellSize) | 0;
  const gy = ((screenY - state.panY) / cellSize) | 0;

  if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return null;
  return { gx, gy };
}
