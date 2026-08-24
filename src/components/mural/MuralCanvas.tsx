import { useRef, useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  computeCellSize,
  getVisibleViewport,
  buildBlockMap,
  screenToGrid,
  getBrandCenter,
  clusterBrands,
  clampPan,
  clampZoom,
  gridToCoordinate,
  coordinateToGrid,
  getTerritoryRange,
  getBlockId,
  getGravityRadius,
  setStage,
  getStageFitZoom,
  type NeuralConnection,
} from "@/lib/mural/MuralEngine";
import { getBrandsBoundingBox, getInitialViewForBounds } from "@/lib/mural/MuralLayout";
import { renderMural, renderShimmer, renderMinimap, type MuralTheme } from "@/lib/mural/MuralRenderer";
import { loadBrands, recordClick } from "@/lib/mural/MuralDataLoader";
import {
  GRID_COLS,
  GRID_ROWS,
  type MuralBrand,
  type MuralState,
  type AuctionState,
  type BlockStateKind,
} from "@/lib/mural/types";
import { supabase } from "@/integrations/supabase/client";
import { computeDynamicBlockPrice, regionForBlock } from "@/lib/mural/MuralMarketplace";
import { blockPriceFor } from "@/lib/stripe";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useToast } from "@/hooks/use-toast";
import { localDb } from "@/lib/localDbClient";
import { MOCK_BRANDS } from "@/data/mockData";
import { isUuidV4Like } from "@/lib/uuid";
import { HostileTakeoverModal } from "./HostileTakeoverModal";
import MuralMinimap from "./MuralMinimap";
import BrandModal from "@/components/BrandModal";
import { TiltStage, TilePreviewCard, ClaimPixelsModal } from "@/components/mural3d";

interface MuralCanvasProps {
  searchHighlight?: string | null;
  categoryHighlight?: string | null;
  categoryFilter?: string | null; // Alias for categoryHighlight
  focusBrand?: string | null;
  onFocusComplete?: () => void;
  theme?: "default" | "influencer";
  onBrandSelect?: (brand: MuralBrand) => void;
}

const MuralCanvas = ({ searchHighlight, categoryHighlight, categoryFilter, focusBrand, onFocusComplete, theme = "default", onBrandSelect }: MuralCanvasProps) => {
  const muralTheme: MuralTheme = theme === "influencer" ? "influencer" : "default";
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const shimmerRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafLoopRef = useRef<number>(0);

  const [brands, setBrands] = useState<MuralBrand[]>([]);
  const blockMapRef = useRef<Map<number, MuralBrand>>(new Map());
  const neuralConnectionsRef = useRef<NeuralConnection[]>([]);
  const reservedBlocksRef = useRef<Set<string>>(new Set());
  const auctionBlocksRef = useRef<Map<string, AuctionState>>(new Map());
  // Gravity hover & sector connections
  const gravityBlocksRef = useRef<{ gx: number; gy: number; dist: number }[]>([]);
  const sectorConnectionsRef = useRef<{ fromBrand: MuralBrand; toBrand: MuralBrand }[]>([]);

  const stateRef = useRef<MuralState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    containerWidth: window.innerWidth,
    containerHeight: window.innerHeight,
  });

  const [explosions, setExplosions] = useState<{ gx: number; gy: number; startTime: number }[]>([]);
  const explosionsRef = useRef<{ gx: number; gy: number; startTime: number }[]>([]);

  const [zoom, setZoom] = useState(1);
  const [hoveredBrand, setHoveredBrand] = useState<MuralBrand | null>(null);
  const [hoveredCoord, setHoveredCoord] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [selectedBrand, setSelectedBrand] = useState<MuralBrand | null>(null);
  const [selectedBlockCoord, setSelectedBlockCoord] = useState<string | null>(null);
  const [selectedTerritoryRange, setSelectedTerritoryRange] = useState<string | null>(null);
  const [pendingReservation, setPendingReservation] = useState<{
    coord: string;
    gx: number;
    gy: number;
    price: number;
    status: BlockStateKind;
    auctionInfo?: AuctionState | null;
  } | null>(null);

  const [pendingBid, setPendingBid] = useState<{
    coord: string;
    blockKey: string;
    gx: number;
    gy: number;
    price: number;
    blockId?: string;
    targetBrand?: MuralBrand;
  } | null>(null);

  const { profileType, user } = useUserProfile();
  const isCompany = profileType === "company";
  const [myCompanyId, setMyCompanyId] = useState<string | null>(null);
  const { toast } = useToast();
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const cursorCoordRef = useRef<HTMLDivElement>(null);

  const hoverRef = useRef<{ brand: MuralBrand | null; coord: string | null }>({
    brand: null,
    coord: null,
  });
  const tooltipPosRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const dragMoved = useRef(false);
  const lastTouchDist = useRef<number | null>(null);

  // Realtime Blocks subscription
  useEffect(() => {
    const channel = supabase
      .channel("blocks_nexus")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "blocks" },
        (payload) => {
          const newBlock = payload.new as any;
          const oldBlock = payload.old as any;
          if (newBlock.company_id !== oldBlock.company_id) {
            // Trigger Explosion!
            const explosion = { gx: newBlock.x, gy: newBlock.y, startTime: Date.now() };
            explosionsRef.current = [...explosionsRef.current, explosion];
            setExplosions([...explosionsRef.current]);
            
            // Invalidate cache to reload brands
            loadBrands().then((data) => {
              setBrands(data);
              const cache = buildBlockMap(data);
              blockMapRef.current = cache.blockMap;
              neuralConnectionsRef.current = cache.neuralConnections;
            });

            // Cleanup old explosions after 2s
            setTimeout(() => {
              explosionsRef.current = explosionsRef.current.filter(e => e.startTime !== explosion.startTime);
              setExplosions([...explosionsRef.current]);
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Load data
  useEffect(() => {
    setIsInitialLoading(true);
    loadBrands().then((data) => {
      // Always fallback to MOCK_BRANDS if DB returns nothing
      const resolved = (data && data.length > 0) ? data : MOCK_BRANDS;
      setBrands(resolved);
      const cache = buildBlockMap(resolved);
      blockMapRef.current = cache.blockMap;
      neuralConnectionsRef.current = cache.neuralConnections;
      setIsInitialLoading(false);
    }).catch(() => {
      // On any error: use mock data
      const resolved = MOCK_BRANDS;
      setBrands(resolved);
      const cache = buildBlockMap(resolved);
      blockMapRef.current = cache.blockMap;
      neuralConnectionsRef.current = cache.neuralConnections;
      setIsInitialLoading(false);
    });
  }, []);

  // Resolve empresa do usuário logado (para bids reais)
  useEffect(() => {
    if (!user || !isCompany) {
      setMyCompanyId(null);
      return;
    }
    localDb
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .single()
      .then(({ data }) => {
        const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
        setMyCompanyId(row?.id ?? null);
      });
  }, [user, isCompany]);

  // Responsive initial view: fit content (brand bounding box) or full grid
  const applyFitToViewport = useCallback(() => {
    const s = stateRef.current;
    const bounds = getBrandsBoundingBox(brands);

    // Define o palco antes de qualquer clamp: é ele que passa a ditar o
    // piso do zoom e os limites de pan. Sem marcas, não há palco e o
    // engine volta ao comportamento de grid inteiro.
    setStage(bounds, s.containerWidth, s.containerHeight);

    if (bounds) {
      const view = getInitialViewForBounds(bounds, s.containerWidth, s.containerHeight);
      // Nunca abrir mais afastado do que o enquadramento do palco
      const fit = getStageFitZoom();
      s.zoom = clampZoom(fit !== null ? Math.max(view.zoom, fit) : view.zoom);
      setZoom(s.zoom);

      // O pan é recalculado com o zoom final (e não reaproveitado do
      // `view`), senão o centro sai deslocado sempre que o piso do palco
      // sobrescreve o zoom sugerido.
      const cellSize = computeCellSize(s.containerWidth, s.containerHeight) * s.zoom;
      const centerX = (bounds.minX + bounds.maxX + 1) / 2;
      const centerY = (bounds.minY + bounds.maxY + 1) / 2;
      s.panX = s.containerWidth / 2 - centerX * cellSize;
      s.panY = s.containerHeight / 2 - centerY * cellSize;
    } else {
      // No brands yet — use a low default zoom (not MAX_ZOOM!) centered on the grid
      const baseCellSize = computeCellSize(s.containerWidth, s.containerHeight);
      // Show a 60x60 block area centered — zoom will be low enough to show context
      const targetCols = 60;
      const targetRows = 60;
      const zoomX = (s.containerWidth / (targetCols * baseCellSize)) * 0.9;
      const zoomY = (s.containerHeight / (targetRows * baseCellSize)) * 0.9;
      // Cap at 3x so we never start zoomed in too far before data loads
      const initialZoom = clampZoom(Math.min(zoomX, zoomY, 3));
      s.zoom = initialZoom;
      setZoom(initialZoom);

      const cellSize = baseCellSize * initialZoom;
      // Center on a reasonable starting area (where mock data lives: ~x:25, y:25)
      const centerGx = 25;
      const centerGy = 25;
      s.panX = s.containerWidth / 2 - centerGx * cellSize;
      s.panY = s.containerHeight / 2 - centerGy * cellSize;
    }

    clampPan(s);
  }, [brands]);

  // Resize + initial fit
  useEffect(() => {
    const onResize = () => {
      const s = stateRef.current;
      s.containerWidth = window.innerWidth;
      s.containerHeight = window.innerHeight;
      if (canvasRef.current) {
        const dpr = window.devicePixelRatio ?? 1;
        canvasRef.current.width = s.containerWidth * dpr;
        canvasRef.current.height = s.containerHeight * dpr;
        canvasRef.current.style.width = `${s.containerWidth}px`;
        canvasRef.current.style.height = `${s.containerHeight}px`;
      }
      if (minimapRef.current) {
        const dpr = window.devicePixelRatio ?? 1;
        minimapRef.current.width = 156 * dpr;
        minimapRef.current.height = 156 * dpr;
        minimapRef.current.style.width = "156px";
        minimapRef.current.style.height = "156px";
      }
      if (shimmerRef.current) {
        const dpr = window.devicePixelRatio ?? 1;
        shimmerRef.current.width = s.containerWidth * dpr;
        shimmerRef.current.height = s.containerHeight * dpr;
        shimmerRef.current.style.width = `${s.containerWidth}px`;
        shimmerRef.current.style.height = `${s.containerHeight}px`;
      }
      applyFitToViewport();
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [applyFitToViewport]);

  // Recenter when brand data finishes loading
  useEffect(() => {
    if (brands.length === 0) return;
    applyFitToViewport();
  }, [brands, applyFitToViewport]);

  // Focus on brand
  useEffect(() => {
    if (!focusBrand || brands.length === 0) return;
    const brand = brands.find((b) => b.name.toLowerCase() === focusBrand.toLowerCase());
    if (!brand || brand.blocks.length === 0) return;

    const { cx, cy } = getBrandCenter(brand);
    const s = stateRef.current;
    const targetZoom = 4;
    const cellSize = computeCellSize(s.containerWidth, s.containerHeight) * targetZoom;

    s.zoom = clampZoom(targetZoom);
    s.panX = s.containerWidth / 2 - cx * cellSize;
    s.panY = s.containerHeight / 2 - cy * cellSize;
    clampPan(s);
    setZoom(s.zoom);
    setTimeout(() => onFocusComplete?.(), 500);
  }, [focusBrand, brands, onFocusComplete]);

  // Continuous RAF loop: single source of render, refs for hover (no React re-renders during pan/zoom)
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      const canvas = canvasRef.current;
      const minimap = minimapRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const dpr = window.devicePixelRatio ?? 1;
          ctx.save();
          ctx.scale(dpr, dpr);
          const s = stateRef.current;
          const viewport = getVisibleViewport(s, neuralConnectionsRef.current.length > 0);
          const clusters = clusterBrands(brands, viewport, s.zoom);
          const hoverCoordParsed = hoverRef.current.coord
            ? coordinateToGrid(hoverRef.current.coord)
            : null;
          renderMural(
            ctx,
            s,
            blockMapRef.current,
            searchHighlight ?? null,
            hoverRef.current.brand,
            hoverCoordParsed,
            clusters,
            brands.length,
            reservedBlocksRef.current,
            auctionBlocksRef.current,
            undefined,
            categoryFilter || categoryHighlight,
            explosionsRef.current,
            neuralConnectionsRef.current,
            sectorConnectionsRef.current,
            gravityBlocksRef.current,
            muralTheme
          );
          ctx.restore();
        }
      }
      if (minimap) {
        const mctx = minimap.getContext("2d");
        if (mctx) {
          const dpr = window.devicePixelRatio ?? 1;
          mctx.save();
          mctx.scale(dpr, dpr);
          renderMinimap(mctx, stateRef.current, blockMapRef.current, muralTheme);
          mctx.restore();
        }
      }
      rafLoopRef.current = requestAnimationFrame(loop);
    };
    rafLoopRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      if (rafLoopRef.current) cancelAnimationFrame(rafLoopRef.current);
    };
  }, [brands, searchHighlight, categoryHighlight, explosions]);

  // Sync hover ref to state for tooltip (batched, no re-render during drag)
  useEffect(() => {
    const id = setInterval(() => {
      if (isDragging.current) return;
      const { brand, coord } = hoverRef.current;
      setHoveredBrand((prev) => (prev?.id === brand?.id ? prev : brand ?? null));
      setHoveredCoord((prev) => (prev === coord ? prev : coord ?? null));
      setTooltipPos((prev) =>
        prev.x === tooltipPosRef.current.x && prev.y === tooltipPosRef.current.y
          ? prev
          : { ...tooltipPosRef.current }
      );
    }, 50);
    return () => clearInterval(id);
  }, []);

  // Shimmer
  useEffect(() => {
    const shimmer = shimmerRef.current;
    if (!shimmer) return;
    const ctx = shimmer.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const animate = (time: number) => {
      const dpr = window.devicePixelRatio ?? 1;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(
        0,
        0,
        stateRef.current.containerWidth,
        stateRef.current.containerHeight
      );
      renderShimmer(
        ctx,
        stateRef.current.containerWidth,
        stateRef.current.containerHeight,
        time,
        muralTheme
      );
      ctx.restore();
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const s = stateRef.current;
    const oldZoom = s.zoom;
    // Passo multiplicativo, não aditivo: a faixa de zoom do palco é relativa
    // ao conteúdo e pode ficar na casa das dezenas, onde somar 0.15 por
    // scroll seria imperceptível. Multiplicar mantém a sensação constante
    // em qualquer nível de aproximação.
    const newZoom = clampZoom(oldZoom * (e.deltaY > 0 ? 0.9 : 1 / 0.9));
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const scale = newZoom / oldZoom;
    s.panX = mouseX - (mouseX - s.panX) * scale;
    s.panY = mouseY - (mouseY - s.panY) * scale;
    s.zoom = newZoom;
    clampPan(s);
    setZoom(s.zoom);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  /**
   * O container do mural é `fixed inset-0` e os modais (takeover, reserva,
   * detalhe da marca) são renderizados COMO FILHOS dele. Eventos de mouse do
   * React sobem pela árvore de componentes, então um clique num botão dentro
   * do modal chegava aqui em `onMouseUp` e era interpretado como clique na
   * grade — foi por isso que clicar num preset de lance fechava o modal de
   * takeover e abria o de reserva do bloco que estava atrás.
   *
   * A guarda: só tratamos o evento se ele nasceu no próprio <canvas>.
   */
  const isCanvasEvent = (target: EventTarget | null): boolean =>
    target === canvasRef.current;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!isCanvasEvent(e.target)) return;
    isDragging.current = true;
    dragMoved.current = false;
    const s = stateRef.current;
    dragStart.current = { x: e.clientX, y: e.clientY, panX: s.panX, panY: s.panY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Sobre um modal ou HUD: nada de hover na grade nem de arrasto.
    if (!isCanvasEvent(e.target) && !isDragging.current) {
      hoverRef.current = { brand: null, coord: null };
      gravityBlocksRef.current = [];
      sectorConnectionsRef.current = [];
      return;
    }
    const s = stateRef.current;
    const hit = screenToGrid(e.clientX, e.clientY, s);
    const cursorLabel = hit ? gridToCoordinate(hit.gx, hit.gy) : "—";
    if (cursorCoordRef.current) cursorCoordRef.current.textContent = `Cursor: ${cursorLabel}`;

    if (isDragging.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true;
      s.panX = dragStart.current.panX + dx;
      s.panY = dragStart.current.panY + dy;
      clampPan(s);
    } else {
      if (hit) {
        const brand = blockMapRef.current.get(getBlockId(hit.gx, hit.gy));
        const coord = gridToCoordinate(hit.gx, hit.gy);
        hoverRef.current = { brand: brand ?? null, coord };
        tooltipPosRef.current = { x: e.clientX, y: e.clientY };
        // Gravity effect: nearby blocks shift slightly
        gravityBlocksRef.current = getGravityRadius(hit.gx, hit.gy, 3);
        // Sector connection lines: same category brands
        if (brand) {
          const cat = (brand.category || "").toLowerCase();
          sectorConnectionsRef.current = brands
            .filter(b => b.id !== brand.id && (b.category || "").toLowerCase() === cat && b.blocks.length > 0)
            .slice(0, 5)
            .map(b => ({ fromBrand: brand, toBrand: b }));
        } else {
          sectorConnectionsRef.current = [];
        }
      } else {
        hoverRef.current = { brand: null, coord: null };
        gravityBlocksRef.current = [];
        sectorConnectionsRef.current = [];
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // O arrasto sempre termina, inclusive se o ponteiro soltou sobre um HUD —
    // caso contrário o mural ficaria "colado" no cursor.
    isDragging.current = false;
    // Mas um clique que nasceu num overlay nunca seleciona bloco.
    if (!isCanvasEvent(e.target)) return;
    if (!dragMoved.current) {
      const s = stateRef.current;
      const hit = screenToGrid(e.clientX, e.clientY, s);
      if (hit) {
        const key = `${hit.gx},${hit.gy}`;
        const id = getBlockId(hit.gx, hit.gy);
        const brand = blockMapRef.current.get(id);
        if (brand && brand.blocks && brand.blocks.length > 0) {
          recordClick(brand);
          if (onBrandSelect) {
            onBrandSelect(brand);
          } else {
            const coord = gridToCoordinate(hit.gx, hit.gy);
            setSelectedBrand(brand);
            setSelectedBlockCoord(coord);
            setSelectedTerritoryRange(getTerritoryRange(brand));
            
            // Não engatilhamos mais setPendingBid aqui.
            // O clique em bloco ocupado apenas abre a Ficha de Território.
          }
        } else {
          const coord = gridToCoordinate(hit.gx, hit.gy);
          const price = computeDynamicBlockPrice(brands, hit.gx, hit.gy);
          setSelectedBrand(null);
          setSelectedBlockCoord(null);
          setSelectedTerritoryRange(null);
          setPendingBid(null);
          setPendingReservation({
            coord,
            gx: hit.gx,
            gy: hit.gy,
            price,
            status: "available",
            auctionInfo: null,
          });
        }
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isCanvasEvent(e.target)) return;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      isDragging.current = true;
      dragMoved.current = false;
      const s = stateRef.current;
      dragStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: s.panX,
        panY: s.panY,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const s = stateRef.current;
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastTouchDist.current !== null) {
        s.zoom = clampZoom(s.zoom * (dist / lastTouchDist.current));
        setZoom(s.zoom);
      }
      lastTouchDist.current = dist;
      clampPan(s);
    } else if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true;
      s.panX = dragStart.current.panX + dx;
      s.panY = dragStart.current.panY + dy;
      clampPan(s);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isCanvasEvent(e.target)) {
      isDragging.current = false;
      lastTouchDist.current = null;
      return;
    }
    if (lastTouchDist.current !== null) {
      lastTouchDist.current = null;
      isDragging.current = false;
      return;
    }
    if (e.changedTouches.length === 0) {
      isDragging.current = false;
      return;
    }
    const touch = e.changedTouches[0];
    if (!dragMoved.current) {
      const s = stateRef.current;
      const hit = screenToGrid(touch.clientX, touch.clientY, s);
      if (hit) {
        const key = `${hit.gx},${hit.gy}`;
        const id = getBlockId(hit.gx, hit.gy);
        const brand = blockMapRef.current.get(id);
        if (brand && brand.blocks && brand.blocks.length > 0) {
          recordClick(brand);
          const coord = gridToCoordinate(hit.gx, hit.gy);
          setPendingReservation(null);
          setSelectedBrand(brand);
          setSelectedBlockCoord(coord);
          setSelectedTerritoryRange(getTerritoryRange(brand));
          const price = computeDynamicBlockPrice(brands, hit.gx, hit.gy);
          setPendingBid({ coord, blockKey: key, gx: hit.gx, gy: hit.gy, price });
        } else {
          const coord = gridToCoordinate(hit.gx, hit.gy);
          const price = computeDynamicBlockPrice(brands, hit.gx, hit.gy);
          setSelectedBrand(null);
          setSelectedBlockCoord(null);
          setSelectedTerritoryRange(null);
          setPendingBid(null);
          setPendingReservation({
            coord,
            gx: hit.gx,
            gy: hit.gy,
            price,
            status: "available",
            auctionInfo: null,
          });
        }
      }
    }
    isDragging.current = false;
  };

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 overflow-hidden cursor-grab active:cursor-grabbing touch-none ${muralTheme === "influencer" ? "bg-[#09070F]" : "bg-stage-void"}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        isDragging.current = false;
        hoverRef.current = { brand: null, coord: null };
        setHoveredBrand(null);
        setHoveredCoord(null);
        if (cursorCoordRef.current) cursorCoordRef.current.textContent = "Cursor: —";
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/*
        Ordem das camadas do palco 3D:
          1. TiltStage (decorativa)  — luz ambiente com parallax, atrás de tudo
          2. canvas principal        — recebe pan/zoom/clique, SEM transform
          3. shimmer + vinheta       — brilho e foco, sem capturar ponteiro

        O canvas fica deliberadamente fora do transform 3D: `screenToGrid`
        converte clientX/clientY direto em coordenadas de grade, e qualquer
        rotação na árvore quebraria esse mapeamento. A profundidade vem do
        renderer (tiles com extrusão e chanfro) e do parallax ao redor.
      */}
      <TiltStage className="pointer-events-none absolute inset-0 z-0" maxTilt={2.2}>
        <div className="h-full w-full" />
      </TiltStage>

      <canvas ref={canvasRef} className="absolute inset-0 z-10" />
      <canvas ref={shimmerRef} className="absolute inset-0 z-20 pointer-events-none" />
      <div className="stage-3d__vignette z-20" aria-hidden />

      {isInitialLoading && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{
            background: "hsl(var(--stage-void) / 0.82)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div className="flex flex-col items-center gap-5">
            {/* Chip 3D pulsando — o mesmo módulo que compõe o mural */}
            <div
              className="tile-3d ambient-breathe h-11 w-11"
              style={{
                background: "linear-gradient(145deg, hsl(var(--stream-core)), hsl(var(--stream-halo)))",
                boxShadow: "0 0 40px -6px hsl(var(--stream-core) / 0.65)",
              }}
            />
            <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-white/40">
              building the wall
            </p>
          </div>
        </div>
      )}




      {/* Instrumentos de navegação — leitura mono, superfície de vidro */}
      <div className="absolute bottom-6 right-6 z-30 flex flex-col items-end gap-1.5">
        {/*
          O zoom é exibido relativo ao enquadramento do palco (100% = mural
          inteiro visível), não ao valor bruto do engine — que depende do
          grid de 400×400 e mostraria algo como "1540%" logo na abertura.
        */}
        <div className="glass-panel glass-panel--beveled rounded-full px-3 py-1.5 font-mono text-[11px] tabular-nums text-white/60">
          {Math.round((zoom / (getStageFitZoom() ?? 1)) * 100)}%
        </div>
        <div
          ref={cursorCoordRef}
          className="glass-panel glass-panel--beveled pointer-events-none rounded-full px-3 py-1.5 font-mono text-[11px] tabular-nums text-white/60"
        >
          Cursor: —
        </div>
      </div>

      {/*
        O canto inferior esquerdo ficava com badge de tipo de mural, legenda
        de distritos e legenda de status — três camadas de texto sobre os
        blocos. Retiradas: a identidade do mural já está no alternador do
        topo, e as cores de status se explicam ao clicar num bloco.
      */}

      <MuralMinimap ref={minimapRef} />

      <TilePreviewCard
        brand={hoveredBrand}
        coordinate={hoveredCoord}
        position={tooltipPos}
        isDragging={isDragging.current}
      />
      <BrandModal
        brand={selectedBrand}
        blockCoord={selectedBlockCoord}
        territoryRange={selectedTerritoryRange}
        onClose={() => {
          setSelectedBrand(null);
          setSelectedBlockCoord(null);
          setSelectedTerritoryRange(null);
          setPendingBid(null);
        }}
        onMakeOffer={() => {
          if (!selectedBlockCoord || !selectedBrand) return;
          const coord = selectedBlockCoord;
          const hit = coordinateToGrid(coord);
          if (!hit) return;
          const key = `${hit.gx},${hit.gy}`;
          const price = computeDynamicBlockPrice(brands, hit.gx, hit.gy);
          setPendingBid({
            coord,
            blockKey: key,
            gx: hit.gx,
            gy: hit.gy,
            price,
          });
        }}
      />

      <ClaimPixelsModal
        open={!!pendingReservation}
        blockCoord={pendingReservation?.coord ?? null}
        price={pendingReservation?.price ?? null}
        status={(pendingReservation?.status as any) ?? "available"}
        auctionInfo={pendingReservation?.auctionInfo ?? null}
        onClose={() => setPendingReservation(null)}
        onGoToPurchase={() => {
          if (pendingReservation) {
            navigate("/dashboard", { state: { openPurchase: true, blockCoord: pendingReservation.coord } });
            setPendingReservation(null);
          }
        }}
        onReserve={() => {
          if (!pendingReservation) return;
          const key = `${pendingReservation.gx},${pendingReservation.gy}`;
          const next = new Set(reservedBlocksRef.current);
          next.add(key);
          reservedBlocksRef.current = next;
          auctionBlocksRef.current.delete(key);
          setPendingReservation(null);
        }}
        onStartAuction={() => {
          if (!pendingReservation) return;
          const key = `${pendingReservation.gx},${pendingReservation.gy}`;
          const now = Date.now();
          const durationMs = 24 * 60 * 60 * 1000;
          const auction: AuctionState = {
            startingPrice: pendingReservation.price,
            highestBid: pendingReservation.price,
            auctionEndTime: now + durationMs,
          };
          const next = new Map(auctionBlocksRef.current);
          next.set(key, auction);
          auctionBlocksRef.current = next;
          reservedBlocksRef.current.delete(key);
          setPendingReservation(null);
        }}
      />

      <HostileTakeoverModal
        open={!!pendingBid}
        blockCoord={pendingBid?.coord ?? null}
        originalPrice={pendingBid?.price ?? 0}
        brandName={pendingBid?.targetBrand?.name ?? ""}
        brandId={pendingBid?.targetBrand?.id ?? ""}
        myCompanyId={myCompanyId}
        onClose={() => setPendingBid(null)}
        onSubmit={async (value) => {
          if (!pendingBid || !pendingBid.targetBrand) return;
          if (!isCompany || !myCompanyId) {
            toast({
              title: "Entre como empresa",
              description: "Apenas empresas podem fazer ofertas de posição.",
              variant: "destructive",
            });
            return;
          }
          
          const targetBrand = pendingBid.targetBrand;
          const isRealCompany = isUuidV4Like(targetBrand.id);
          if (!isRealCompany) {
            toast({
              title: "Empresa de demonstração",
              description: "Não é possível fazer oferta para empresas de demonstração.",
              variant: "destructive",
            });
            return;
          }
          if (targetBrand.id === myCompanyId) {
            toast({
              title: "Oferta inválida",
              description: "Você não pode dar lance na posição da sua própria empresa.",
              variant: "destructive",
            });
            return;
          }

          const { error } = await localDb.from("position_bids").insert({
            from_company_id: myCompanyId,
            to_brand_id: targetBrand.id,
            amount: value,
            status: "pending",
          });

          if (error) {
            toast({
              title: "Erro ao enviar oferta",
              description: error.message,
              variant: "destructive",
            });
            return;
          }

          // Criar evento no Pulse (simulado por enquanto ou via tabela se implementada)
          await localDb.from("pulse_events").insert({
            content: `🚨 HOSTILE TAKEOVER: Uma nova oferta de $${value.toLocaleString()} foi feita pela posição de ${targetBrand.name} em ${pendingBid.coord}!`,
          });

          toast({
            title: "Oferta enviada!",
            description: "O dono da posição foi notificado. Se ele aceitar, a posição será sua!",
          });
          setPendingBid(null);
        }}
      />
    </div>
  );
};

export default MuralCanvas;
