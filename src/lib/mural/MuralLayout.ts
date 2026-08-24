import type { MuralBrand, MuralState } from "./types";
import { useMuralConfigStore } from "@/store/useMuralConfigStore";
import { computeCellSize, clampZoom, getZoneName } from "./MuralEngine";

export interface ContentBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function getBrandsBoundingBox(brands: MuralBrand[]): ContentBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const { gridCols, gridRows } = useMuralConfigStore.getState();
  for (const brand of brands) {
    if (!brand.blocks || brand.blocks.length === 0) continue;
    for (const block of brand.blocks) {
      if (block.x < 0 || block.x >= gridCols || block.y < 0 || block.y >= gridRows) continue;
      if (block.x < minX) minX = block.x;
      if (block.x > maxX) maxX = block.x;
      if (block.y < minY) minY = block.y;
      if (block.y > maxY) maxY = block.y;
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;

  return { minX, maxX, minY, maxY };
}

export function getInitialViewForBounds(
  bounds: ContentBounds,
  containerWidth: number,
  containerHeight: number
): Pick<MuralState, "zoom" | "panX" | "panY"> {
  const baseCellSize = computeCellSize(containerWidth, containerHeight);

  // Sem padding para garantir que as margens do grid encostem no fim da tela (full-screen bleed)
  const PAD_CELLS = 0;
  const contentCols = Math.max(1, bounds.maxX - bounds.minX + 1) + PAD_CELLS * 2;
  const contentRows = Math.max(1, bounds.maxY - bounds.minY + 1) + PAD_CELLS * 2;

  // Utilizando 1.0 (sem redução) para garantir preenchimento total das margens da tela
  const zoomX = (containerWidth / (contentCols * baseCellSize)) * 1.0;
  const zoomY = (containerHeight / (contentRows * baseCellSize)) * 1.0;
  const rawZoom = Math.min(zoomX, zoomY);

  // Cap the initial fit zoom at 5x to prevent the "800%" situation when content
  // occupies only a small region of a large grid. User can still zoom in further.
  const INITIAL_MAX_ZOOM = 5;
  const zoom = clampZoom(Math.min(rawZoom, INITIAL_MAX_ZOOM));
  const cellSize = baseCellSize * zoom;

  // Center on the content bounding box midpoint
  const centerX = (bounds.minX + bounds.maxX + 1) / 2;
  const centerY = (bounds.minY + bounds.maxY + 1) / 2;

  // Centro perfeito sem offsets que causariam vazios em margens inferiores
  const panX = containerWidth / 2 - centerX * cellSize;
  const panY = containerHeight / 2 - centerY * cellSize;

  return { zoom, panX, panY };
}


export function getBlockPrice(gx: number, gy: number): number {
  const { zone } = getZoneName(gx, gy);
  switch (zone) {
    case "premium":
      return 100;
    case "intermediate":
      return 50;
    default:
      return 20;
  }
}

