import {
  type MuralBrand, type MuralState, type AuctionState,
} from "./types";
import {
  computeCellSize, getVisibleViewport, getMergedTerritoriesInViewport,
  getBlockId, type NeuralConnection, type Cluster,
} from "./MuralEngine";

// ── Theming ───────────────────────────────────────────────────
export type MuralTheme = "default" | "influencer";

const THEME_COLORS = {
  default: {
    // Slate 950 difuso — o palco não compete com os módulos
    gridLine: "rgba(255, 255, 255, 0.028)",
    background1: "#0B0C10",
    background2: "#08090D",
    accentGlow: "rgba(52, 211, 153, 0.10)",
    availableDot: "rgba(255, 255, 255, 0.05)",
    zonePremiumborder: "rgba(255,215,0,0.3)",
    minimapBorder: "rgba(255,255,255,0.12)",
    districtAlpha: 0.55,
  },
  influencer: {
    gridLine: "rgba(255, 255, 255, 0.026)",
    background1: "#0C0912",
    background2: "#09070F",
    accentGlow: "rgba(217, 70, 239, 0.10)",
    availableDot: "rgba(255, 255, 255, 0.045)",
    zonePremiumborder: "rgba(217,70,239,0.35)",
    minimapBorder: "rgba(217,70,239,0.22)",
    districtAlpha: 0.45,
  },
} as const;

// ── Image cache ───────────────────────────────────────────────
const imgCache = new Map<string, HTMLImageElement | "loading" | "error">();

function getOrLoadImage(url: string): HTMLImageElement | null {
  const cached = imgCache.get(url);
  if (cached === "loading" || cached === "error") return null;
  if (cached) return cached;
  imgCache.set(url, "loading");
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => imgCache.set(url, img);
  img.onerror = () => imgCache.set(url, "error");
  img.src = url;
  return null;
}

function hexToRgba(hex: string, a: number): string {
  if (!hex || hex[0] !== "#") return `rgba(100,100,200,${a})`;
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r},${g},${b},${a})`;
}

/** Luminance-based contrast: returns "#fff" or "#111" */
function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 155 ? "#111" : "#fff";
}

/**
 * Desenha o bloco de um anunciante — a unidade visual do mural.
 *
 * Paleta Titanium: a superfície é escura e neutra em TODOS os blocos; quem
 * traz cor é o logo do anunciante. A versão anterior pintava o bloco inteiro
 * com `brand.color` saturado, o que criava um mosaico de plástico colorido em
 * que nenhuma marca se destacava — e marcas com logo claro ficavam ilegíveis.
 *
 * A profundidade é construída em camadas, com luz difusa vindo de cima:
 *   1. Sombra projetada  — ancora o módulo na superfície
 *   2. Face titanium     — gradiente escuro sutil, quase plano
 *   3. Chanfro           — hairline de luz no topo, oclusão na base
 *   4. Acento da marca   — tinta discreta da cor, só como assinatura
 *   5. Logo centralizado — `contain`, respiro nas bordas, nunca esticado
 */
function drawBrandTile(
  ctx: CanvasRenderingContext2D,
  brand: MuralBrand,
  sx: number, sy: number, sw: number, sh: number,
  isHovered: boolean,
  isHighlighted: boolean,
  isDimmed: boolean,
  isAuction: boolean,
  pulseFactor: number,
  zoom: number,
  theme: MuralTheme
) {
  const minDim = Math.min(sw, sh);
  const r = minDim / 2; // Arredondamento total (cria círculos perfeitos ou "pílulas" proporcionais)

  // Elevação no hover ou para influenciadores
  const isInfluencer = brand.mural_type === "influencers";
  const lift = (isHovered || isInfluencer) && minDim >= 12 ? Math.min(4, minDim * 0.05) : 0;
  const fx = sx;
  const fy = sy - lift;

  const alpha = isDimmed ? 0.28 : 1;

  ctx.save();
  ctx.globalAlpha = alpha;

  // ── 1. Sombra projetada (Elevando a bolha 3D) ───────────────────
  if (minDim >= 12 && !isDimmed) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,0.8)`;
    ctx.shadowBlur = isHovered ? 24 : 12;
    ctx.shadowOffsetY = isHovered ? 12 : 6;
    ctx.fillStyle = "rgba(0,0,0,0.95)";
    ctx.beginPath();
    ctx.roundRect(fx + 2, fy + 2, sw - 4, sh - 4, r);
    ctx.fill();
    ctx.restore();
  }

  // ── 2. Face 3D (Gradiente de Profundidade & Base) ────────────────
  const brandNeon = brand.color || "#00ffcc";
  const face = ctx.createLinearGradient(fx, fy, fx, fy + sh);
  if (isHovered) {
    face.addColorStop(0, "#2a2d34");
    face.addColorStop(1, "#0d0e12");
  } else {
    face.addColorStop(0, "#1d1f24");
    face.addColorStop(1, "#08090b");
  }
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.roundRect(fx, fy, sw, sh, r);
  ctx.fill();

  // Banho de luz difusa neon caindo do topo para a base
  const neonTop = hexToRgba(brandNeon, isHovered ? 0.35 : 0.15);
  const neonBase = hexToRgba(brandNeon, 0.0);
  const glowOverlay = ctx.createLinearGradient(fx, fy, fx, fy + sh);
  glowOverlay.addColorStop(0, neonTop);
  glowOverlay.addColorStop(1, neonBase);
  ctx.fillStyle = glowOverlay;
  ctx.beginPath();
  ctx.roundRect(fx, fy, sw, sh, r);
  ctx.fill();

  // ── 3. Chanfros Esféricos (Brilho Superior e Oclusão Inferior) ──
  if (minDim > 12 && !isDimmed) {
    // Brilho especular no topo simulando material polido/esférico
    const spec = ctx.createLinearGradient(fx, fy, fx, fy + sh * 0.4);
    spec.addColorStop(0, `rgba(255,255,255,${isHovered ? 0.3 : 0.15})`);
    spec.addColorStop(1, "transparent");
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.roundRect(fx, fy, sw, sh, r);
    ctx.fill();
    
    // Oclusão na base (Volume)
    const occ = ctx.createLinearGradient(fx, fy + sh * 0.6, fx, fy + sh);
    occ.addColorStop(0, "transparent");
    occ.addColorStop(1, `rgba(0,0,0,0.65)`);
    ctx.fillStyle = occ;
    ctx.beginPath();
    ctx.roundRect(fx, fy, sw, sh, r);
    ctx.fill();
  }

  // ── 4. Acento Radial Interno (Core Energy) ─────────────────────
  if (!isDimmed && minDim >= 24) {
    const tint = ctx.createRadialGradient(
      fx + sw / 2, fy + sh / 2, 0,
      fx + sw / 2, fy + sh / 2, Math.max(sw, sh) * 0.8
    );
    tint.addColorStop(0, hexToRgba(brandNeon, isHovered ? 0.3 : 0.15));
    tint.addColorStop(1, "transparent");
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.roundRect(fx, fy, sw, sh, r);
    ctx.fill();
  }

  // ── 5. Contorno Neon Energizado (Arestas brilhantes) ───────────
  ctx.save();
  if (isInfluencer) {
    ctx.strokeStyle = `rgba(217, 70, 239, ${isHovered ? 1.0 : 0.8})`;
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.shadowColor = `rgba(217, 70, 239, 0.8)`;
    ctx.shadowBlur = isHovered ? 25 : 15;
  } else if (isAuction) {
    ctx.strokeStyle = `rgba(255,100,100,${0.6 + pulseFactor * 0.4})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = `rgba(255,50,50,0.8)`;
    ctx.shadowBlur = 18;
  } else {
    ctx.strokeStyle = isHovered ? hexToRgba(brandNeon, 1.0) : hexToRgba(brandNeon, 0.6);
    ctx.lineWidth = isHovered ? 2 : 1;
    if (!isDimmed) {
      ctx.shadowColor = hexToRgba(brandNeon, isHovered ? 0.9 : 0.4);
      ctx.shadowBlur = isHovered ? 18 : 8;
    }
  }
  
  ctx.beginPath();
  ctx.roundRect(fx + 0.5, fy + 0.5, sw - 1, sh - 1, r);
  ctx.stroke();
  ctx.restore();

  // A partir daqui todo desenho usa a face elevada
  sx = fx;
  sy = fy;

  // ── 5. Logo do anunciante ──────────────────────────────────────
  //
  // `contain` com respiro: o logo é a marca de outra empresa e precisa de
  // margem para respirar — esticar ou sangrar até a borda descaracteriza a
  // identidade dela. Blocos grandes reservam a faixa inferior para o nome.
  let imgDrawn = false;
  if (brand.logo_url && minDim >= 12) {
    const img = getOrLoadImage(brand.logo_url);
    if (img && img.naturalWidth > 0) {
      const showsName = minDim >= 64;

      // Respiro interno calibrado por tamanho. Blocos grandes ganham margem
      // proporcionalmente maior — é o mesmo princípio da área de proteção de
      // um manual de marca: quanto maior a aplicação, mais folga ela pede.
      const insetRatio = minDim >= 96 ? 0.2 : minDim >= 40 ? 0.16 : 0.11;
      const inset = Math.max(2, minDim * insetRatio);

      // Blocos largos não devem esticar a caixa do logo até as pontas:
      // limita a largura útil para o logo ficar opticamente centrado.
      const maxBoxW = Math.min(sw - inset * 2, sh * 2.4);
      const boxW = Math.max(1, maxBoxW);
      const boxX = sx + (sw - boxW) / 2;
      const boxY = sy + inset;
      // Espaço reservado para a legenda embaixo, quando ela existe
      const boxH = sh - inset * 2 - (showsName ? minDim * 0.18 : 0);

      if (boxW > 1 && boxH > 1) {
        // "contain": escala pelo menor lado, preserva a proporção original
        const scale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
        const rw = img.naturalWidth * scale;
        const rh = img.naturalHeight * scale;

        // Contraste calibrado: logos vivem sobre uma superfície escura, e
        // muitos são monocromáticos escuros (feitos para fundo claro). Um
        // leve realce de luminosidade evita que sumam, sem lavar a cor de
        // marcas com logo colorido.
        ctx.save();
        ctx.globalAlpha = alpha * (isHovered ? 1 : 0.94);
        ctx.drawImage(img, boxX + (boxW - rw) / 2, boxY + (boxH - rh) / 2, rw, rh);
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = alpha * 0.14;
        ctx.drawImage(img, boxX + (boxW - rw) / 2, boxY + (boxH - rh) / 2, rw, rh);
        ctx.restore();

        imgDrawn = true;
      }
    }
  }

  // ── Nome / inicial ─────────────────────────────────────────────
  //
  // Um bloco nunca fica sem identidade: se o logo não entrou (sem cadastro,
  // ainda carregando, ou bloco pequeno demais), a inicial assume.
  if (!isDimmed) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (imgDrawn) {
      if (minDim >= 64) {
        const fontSize = Math.min(minDim * 0.11, 13);
        ctx.font = `600 ${fontSize}px 'Plus Jakarta Sans', 'Inter', sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillText(brand.name, sx + sw / 2, sy + sh - minDim * 0.11, sw - 12);
      }
    } else if (minDim >= 44) {
      // Sem logo: nome como wordmark, tipografia refinada em vez de bloco de cor
      const fontSize = Math.min(minDim * 0.17, sw * 0.15, 19);
      ctx.font = `700 ${fontSize}px 'Plus Jakarta Sans', 'Inter', sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(brand.name, sx + sw / 2, sy + sh / 2 - fontSize * 0.15, sw - 14);

      if (sh > 76 && brand.category) {
        const capSize = Math.max(7, fontSize * 0.42);
        ctx.font = `500 ${capSize}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = hexToRgba(brand.color, 0.75);
        ctx.fillText(brand.category.toUpperCase(), sx + sw / 2, sy + sh / 2 + fontSize * 0.9, sw - 14);
      }
    } else if (minDim >= 7) {
      // Bloco pequeno: monograma na cor da marca sobre a superfície escura
      const fontSize = Math.max(5, Math.min(minDim * 0.44, 20));
      ctx.font = `700 ${fontSize}px 'Plus Jakarta Sans', 'Inter', sans-serif`;
      ctx.fillStyle = hexToRgba(brand.color, 0.95);
      const label = minDim < 18 ? (brand.logo || brand.name).charAt(0).toUpperCase() : brand.logo;
      ctx.fillText(label, sx + sw / 2, sy + sh / 2, sw - 2);
    }
  } else {
    // Filtrado pela busca: presença mínima, sem chamar atenção
    if (minDim > 16) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${Math.max(7, minDim * 0.28)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillText((brand.logo || brand.name).charAt(0).toUpperCase(), sx + sw / 2, sy + sh / 2);
    }
  }

  ctx.restore();
}

function drawFuturisticGrid(
  ctx: CanvasRenderingContext2D,
  state: MuralState,
  cellSize: number,
  viewport: { x: number; y: number; width: number; height: number },
  theme: MuralTheme
) {
  const { containerWidth, containerHeight, panX, panY } = state;
  const tc = THEME_COLORS[theme];
  ctx.save();
  ctx.lineWidth = 0.4;
  ctx.strokeStyle = tc.gridLine;
  for (let gx = viewport.x; gx <= viewport.x + viewport.width + 1; gx++) {
    const sx = panX + gx * cellSize;
    if (sx < -1 || sx > containerWidth + 1) continue;
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, containerHeight); ctx.stroke();
  }
  for (let gy = viewport.y; gy <= viewport.y + viewport.height + 1; gy++) {
    const sy = panY + gy * cellSize;
    if (sy < -1 || sy > containerHeight + 1) continue;
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(containerWidth, sy); ctx.stroke();
  }
  ctx.restore();
}

/** Draw the canvas background (theme-specific gradient) */
function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: MuralTheme
) {
  ctx.save();

  // Base sólida slate-950
  ctx.fillStyle = theme === "influencer" ? "#09070F" : "#08090D";
  ctx.fillRect(0, 0, w, h);

  // Gradiente radial difuso — luz ambiente vinda do topo do palco
  const key = ctx.createRadialGradient(w * 0.5, h * 0.05, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.9);
  if (theme === "influencer") {
    key.addColorStop(0, "#171026");
    key.addColorStop(0.35, "#100B1B");
    key.addColorStop(0.7, "#0B0812");
    key.addColorStop(1, "#09070F");
  } else {
    key.addColorStop(0, "#151821");
    key.addColorStop(0.35, "#0F1219");
    key.addColorStop(0.7, "#0B0C10");
    key.addColorStop(1, "#08090D");
  }
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, w, h);

  // Fill light de canto — tira o "flat" e sugere um segundo emissor
  const fill = ctx.createRadialGradient(w * 0.82, h * 0.85, 0, w * 0.82, h * 0.85, Math.max(w, h) * 0.55);
  fill.addColorStop(0, theme === "influencer" ? "rgba(217,70,239,0.055)" : "rgba(52,211,153,0.045)");
  fill.addColorStop(1, "transparent");
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

export function renderMural(
  ctx: CanvasRenderingContext2D,
  state: MuralState,
  blockMap: Map<number, MuralBrand>,
  searchHighlight: string | null,
  highlightedBrand: MuralBrand | null,
  hoveredCoord: { gx: number; gy: number } | null,
  clusters: Cluster[],
  brandsCount: number,
  reservedBlocks?: Set<string>,
  auctionBlocks?: Map<string, AuctionState>,
  blocksWithIncomingBids?: Set<string>,
  categoryHighlight?: string | null,
  explosions?: { gx: number; gy: number; startTime: number }[],
  neuralConnections?: NeuralConnection[],
  sectorConnections?: { fromBrand: MuralBrand; toBrand: MuralBrand }[],
  gravityBlocks?: { gx: number; gy: number; dist: number }[],
  theme: MuralTheme = "default"
) {
  const { containerWidth, containerHeight, zoom, panX, panY } = state;
  const baseCellSize = computeCellSize(containerWidth, containerHeight);
  const cellSize = (baseCellSize * zoom) || 1;
  const viewport = getVisibleViewport(state);
  if (!viewport || viewport.width <= 0) return;

  const now = Date.now();
  const pulseFactor = (Math.sin(now / 380) + 1) / 2;
  const tc = THEME_COLORS[theme];

  // 0. Background
  drawBackground(ctx, containerWidth, containerHeight, theme);
  ctx.save();

  const hasSearch = Boolean(searchHighlight?.length);
  const hasCatFocus = Boolean(categoryHighlight && categoryHighlight !== "Todos");
  // Respiro entre blocos, proporcional ao zoom. Um gap fixo de 2px fazia os
  // blocos quase se encostarem quando ampliados, e a grade lia como um bloco
  // sólido em vez de módulos independentes. O teto de 6px evita que o vazio
  // domine em aproximação máxima.
  const GAP = Math.max(1.5, Math.min(cellSize * 0.09, 6));

  // 1. Background grid lines
  drawFuturisticGrid(ctx, state, cellSize, viewport, theme);

  // 2. (removido) Tints de distrito.
  //    A tela é dos anunciantes: retângulos coloridos de fundo competiam
  //    com os próprios blocos e sujavam a superfície.

  // 3. LOW ZOOM clusters (Bolhas Neon 3D)
  const LOW_ZOOM = 1.1;
  if (clusters.length > 0 && zoom < LOW_ZOOM) {
    for (const cluster of clusters) {
      const radius = Math.max(6, Math.sqrt(cluster.blockCount) * cellSize * 0.45);
      const sx = panX + cluster.cx * cellSize;
      const sy = panY + cluster.cy * cellSize;
      
      ctx.save();
      // Glow do cluster
      ctx.shadowColor = hexToRgba(cluster.brand.color, 0.8);
      ctx.shadowBlur = 15;
      
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(cluster.brand.color, 0.85);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(cluster.brand.color, 1);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Reflexo 3D na bolha
      const spec = ctx.createLinearGradient(sx, sy - radius, sx, sy + radius);
      spec.addColorStop(0, "rgba(255,255,255,0.2)");
      spec.addColorStop(0.5, "transparent");
      spec.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();

      let clusterImgDrawn = false;
      if (cluster.brand.logo_url && radius > 7) {
        const cimg = getOrLoadImage(cluster.brand.logo_url);
        if (cimg && cimg.naturalWidth > 0) {
          const d = radius * 2;
          const cscale = Math.max(d / cimg.naturalWidth, d / cimg.naturalHeight);
          const cw = cimg.naturalWidth * cscale;
          const ch = cimg.naturalHeight * cscale;
          ctx.save();
          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(cimg, sx - cw / 2, sy - ch / 2, cw, ch);
          ctx.restore();
          clusterImgDrawn = true;
        }
      }

      if (!clusterImgDrawn && radius > 6) {
        ctx.fillStyle = contrastColor(cluster.brand.color);
        ctx.font = `800 ${Math.max(8, radius * 0.8)}px 'Plus Jakarta Sans', 'Lexend', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const clabel = radius < 12 ? (cluster.brand.logo || cluster.brand.name).charAt(0).toUpperCase() : cluster.brand.logo;
        ctx.fillText(clabel, sx, sy);
      }
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  // 4. Gravity offset map
  const gravityMap = new Map<string, number>();
  if (gravityBlocks && hoveredCoord) {
    for (const g of gravityBlocks) {
      gravityMap.set(`${g.gx},${g.gy}`, g.dist);
    }
  }

  // 5. BRAND TILES (merged territories = bento layout)
  const territories = getMergedTerritoriesInViewport(blockMap, viewport);

  for (const rect of territories) {
    const { gx, gy, w, h, brand } = rect;
    const dist = gravityMap.get(`${gx},${gy}`);
    const gravOff = dist !== undefined ? Math.max(0, (3.5 - dist) * 0.5) : 0;

    const sx = panX + gx * cellSize + GAP + gravOff;
    const sy = panY + gy * cellSize + GAP + gravOff;
    const sw = w * cellSize - GAP * 2 - gravOff * 2;
    const sh = h * cellSize - GAP * 2 - gravOff * 2;

    if (sx + sw < 0 || sy + sh < 0 || sx > containerWidth || sy > containerHeight) continue;
    if (sw < 2 || sh < 2) continue;

    const brandName = (brand.name || "").toLowerCase();
    const brandCat = (brand.category || "").toLowerCase();
    const matchesSearch = hasSearch && (brandName.includes((searchHighlight || "").toLowerCase()) || brandCat.includes((searchHighlight || "").toLowerCase()));
    const matchesCat = hasCatFocus && brandCat === (categoryHighlight || "").toLowerCase();
    const isHighlighted = matchesSearch || matchesCat;
    const isDimmed = (hasSearch || hasCatFocus) && !isHighlighted;
    const isHovered = highlightedBrand?.id === brand.id && hoveredCoord &&
      hoveredCoord.gx >= gx && hoveredCoord.gx < gx + w &&
      hoveredCoord.gy >= gy && hoveredCoord.gy < gy + h;
    const auctionKey = `${gx},${gy}`;
    const isAuction = auctionBlocks?.has(auctionKey) ?? false;

    drawBrandTile(ctx, brand, sx, sy, sw, sh, !!isHovered, isHighlighted, isDimmed, isAuction, pulseFactor, zoom, theme);
  }

  // 6. (removido) Linhas de conexão entre marcas.
  //    Cada anunciante é um módulo independente: traçar arcos luminosos
  //    entre marcas da mesma categoria inventava uma relação que não
  //    existe no produto e poluía a leitura da grade.

  // 7. Neural connections — DISABLED: too many lines create visual noise.
  // Only sector connections (on hover) are shown, which are controlled by the UI layer.
  // Uncomment this block to re-enable neural network visualization.
  /*
  const NEURAL_SCORE_MIN = 80;
  if (neuralConnections?.length && zoom > 1.5) {
    // ... neural rendering ...
  }
  */

  // 8. Empty cells (Pontos neutros redondos novamente, suaves)
  for (let gy2 = viewport.y; gy2 < viewport.y + viewport.height; gy2++) {
    for (let gx2 = viewport.x; gx2 < viewport.x + viewport.width; gx2++) {
      if (gx2 < 0 || gx2 >= GRID_COLS || gy2 < 0 || gy2 >= GRID_ROWS) continue;
      if (blockMap.has(getBlockId(gx2, gy2))) continue;
      const sx = panX + gx2 * cellSize + GAP;
      const sy2 = panY + gy2 * cellSize + GAP;
      const size = cellSize - GAP * 2;
      if (sx + size < 0 || sy2 + size < 0 || sx > containerWidth || sy2 > containerHeight) continue;
      const key = `${gx2},${gy2}`;
      const isReserved = reservedBlocks?.has(key);
      const isAuction2 = auctionBlocks?.has(key);
      if (isAuction2) {
        ctx.fillStyle = `rgba(255,60,60,${0.2 + pulseFactor * 0.12})`;
        ctx.beginPath(); ctx.roundRect(sx, sy2, size, size, size/2); ctx.fill();
      } else if (isReserved) {
        ctx.fillStyle = "rgba(253,224,71,0.18)";
        ctx.beginPath(); ctx.roundRect(sx, sy2, size, size, size/2); ctx.fill();
      } else if (size > 6) {
        ctx.fillStyle = tc.availableDot;
        ctx.beginPath();
        ctx.arc(sx + size / 2, sy2 + size / 2, Math.max(1, size * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 9 e 10. (removidos) Rótulos de distrito e bordas de zona.
  //    "FINANCIAL DISTRICT", "TECH HUB", "LUXURY AVENUE" e os retângulos
  //    tracejados de zona premium eram cenário: texto e traço sobre a
  //    grade que não pertencem a nenhum anunciante. A hierarquia de preço
  //    por zona continua no MuralMarketplace — só deixou de ser desenhada.

  // 11. Explosions (Ondas circulares radiais)
  if (explosions?.length) {
    for (const exp of explosions) {
      const age = now - exp.startTime;
      if (age > 2000) continue;
      const progress = age / 2000; // 0 to 1
      const sx = panX + exp.gx * cellSize + cellSize / 2;
      const sy = panY + exp.gy * cellSize + cellSize / 2;
      const radius = progress * cellSize * 12;
      
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      grad.addColorStop(0, `rgba(255,255,255,${1 - progress})`);
      grad.addColorStop(0.2, theme === "influencer"
        ? `rgba(217,70,239,${(1 - progress) * 0.8})`
        : `rgba(34,197,94,${(1 - progress) * 0.8})`);
      grad.addColorStop(1, "transparent");
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// ── Minimap ───────────────────────────────────────────────────
const MINIMAP_SIZE = 148;
const PAD = 8;
const INSET = 14;

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  state: MuralState,
  blockMap: Map<number, MuralBrand>,
  theme: MuralTheme = "default"
) {
  const { containerWidth, containerHeight, zoom, panX, panY } = state;
  const baseCellSize = computeCellSize(containerWidth, containerHeight);
  const cellSize = baseCellSize * zoom;
  const w = MINIMAP_SIZE, h = MINIMAP_SIZE;
  const x = containerWidth - w - INSET, y = INSET;
  const innerW = w - PAD * 2, innerH = h - PAD * 2;
  const scale = Math.min(innerW / GRID_COLS, innerH / GRID_ROWS);
  const offX = x + PAD, offY = y + PAD;

  const tc = THEME_COLORS[theme];

  ctx.save();
  ctx.fillStyle = theme === "influencer" ? "rgba(10,4,20,0.88)" : "rgba(5,5,10,0.88)";
  ctx.strokeStyle = tc.minimapBorder;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke();

  ctx.translate(offX, offY); ctx.scale(scale, scale);

  // Sem tints de distrito: no minimapa também, os únicos pixels acesos são
  // os das marcas. O resto é superfície vazia.

  const step = Math.max(1, Math.floor(GRID_COLS / 80));
  for (let gy = 0; gy < GRID_ROWS; gy += step) {
    for (let gx = 0; gx < GRID_COLS; gx += step) {
      const brand = blockMap.get(getBlockId(gx, gy));
      if (brand) { ctx.fillStyle = hexToRgba(brand.color, 0.9); ctx.fillRect(gx, gy, step, step); }
    }
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const safe = cellSize || 1;
  const viewportColor = theme === "influencer" ? "rgba(217,70,239,0.6)" : "rgba(255,255,255,0.5)";
  ctx.strokeStyle = viewportColor; ctx.lineWidth = 2;
  ctx.strokeRect(offX + (-panX / safe) * scale, offY + (-panY / safe) * scale,
    (containerWidth / safe) * scale, (containerHeight / safe) * scale);
  ctx.restore();
}

// ── Shimmer ───────────────────────────────────────────────────
export function renderShimmer(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, theme: MuralTheme = "default") {
  const gradient = ctx.createLinearGradient(0, 0, w, 0);
  const pos = (Math.sin(time * 0.0008) + 1) / 2;
  const s = Math.max(0, pos - 0.12), e = Math.min(1, pos + 0.12);
  const shimmerColor = theme === "influencer" ? "rgba(217,70,239,0.035)" : "rgba(255,255,255,0.04)";
  gradient.addColorStop(0, "transparent");
  gradient.addColorStop(s, "transparent");
  gradient.addColorStop((s + e) / 2, shimmerColor);
  gradient.addColorStop(e, "transparent");
  gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}
