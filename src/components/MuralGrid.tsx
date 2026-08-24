import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MOCK_BRANDS, Brand } from "@/data/mockData";
import { ExternalLink, ZoomIn, ZoomOut, RotateCcw, Globe, Instagram, Zap, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

const GRID_SIZE = 50;

// Paleta neon cyberpunk dos blocos — cada marca herda a cor real,
// mas blocos vazios na zona premium ganham um glow violeta sutil.
const NEON_VIOLET = "rgba(124,58,237,0.6)";
const NEON_EMERALD = "rgba(16,185,129,0.6)";
const NEON_GOLD = "rgba(240,193,75,0.6)";

/** Retorna a cor neon temática para um bloco baseado na sua posição. */
function zoneGlow(x: number, y: number): string {
  if (x >= 15 && x <= 35 && y >= 8 && y <= 22) return NEON_GOLD;   // premium central
  if (y < 10) return NEON_VIOLET;
  if (y > 20) return NEON_EMERALD;
  return NEON_VIOLET;
}

interface MuralGridProps {
  searchHighlight?: string | null;
}

// ── Painel flutuante de marca (glassmorphism, revelado após 1s de hover) ──────
function BrandHoverPanel({ brand, pos }: { brand: Brand; pos: { x: number; y: number } }) {
  const flipX = pos.x + 300 > window.innerWidth;
  const flipY = pos.y + 240 > window.innerHeight;
  const left = flipX ? Math.max(8, pos.x - 280) : pos.x + 16;
  const top  = flipY ? Math.max(8, pos.y - 220) : pos.y + 8;

  return (
    <motion.div
      className="fixed z-[200] pointer-events-none"
      style={{ left, top, width: 280 }}
      initial={{ opacity: 0, scale: 0.9, y: 10, rotateX: -15, z: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0, z: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 6 }}
      transition={{ type: "spring", stiffness: 350, damping: 25, mass: 0.8 }}
    >
      {/* Borda neon gradiente: o "anel" da borda é o wrapper externo */}
      <div
        style={{
          borderRadius: 20,
          padding: 1,
          background: `linear-gradient(135deg, ${brand.color}cc, ${brand.color}44 30%, rgba(124,58,237,0.7) 70%, ${brand.color}99)`,
          boxShadow: `0 0 32px ${brand.color}40, 0 0 64px ${brand.color}20, 0 30px 60px rgba(0,0,0,0.85)`,
        }}
      >
        {/* Interior glassmorphism */}
        <div
          style={{
            borderRadius: 19,
            background: "rgba(7,7,14,0.92)",
            backdropFilter: "blur(24px)",
            overflow: "hidden",
          }}
        >
          {/* Faixa de acento no topo, na cor da marca */}
          <div
            style={{
              height: 2,
              background: `linear-gradient(90deg, transparent, ${brand.color}, transparent)`,
            }}
          />

          <div style={{ padding: "14px 16px 16px" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Logo tile 3D */}
              <div
                style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: `linear-gradient(145deg, ${brand.color}ee, ${brand.color}66)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 900, color: "#fff",
                  boxShadow: `0 4px 16px ${brand.color}55, 0 0 0 1px ${brand.color}33`,
                }}
              >
                {brand.logo}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {brand.name}
                </div>
                <div style={{ fontSize: 11, color: `${brand.color}cc`, marginTop: 2 }}>
                  {brand.category}
                </div>
              </div>
              <ExternalLink style={{ width: 14, height: 14, color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
            </div>

            {/* Métricas */}
            <div
              style={{
                marginTop: 12,
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 6,
              }}
            >
              {[
                { icon: <Zap style={{ width: 11, height: 11 }} />, label: "Cliques", val: brand.clicks.toLocaleString("pt-BR") },
                { icon: <Layers style={{ width: 11, height: 11 }} />, label: "Blocos", val: `${brand.blocks.length}` },
              ].map(({ icon, label, val }) => (
                <div
                  key={label}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 10, padding: "8px 10px",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span style={{ color: brand.color }}>{icon}</span>
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.88)", lineHeight: 1 }}>{val}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Links sociais / site */}
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {brand.website && (
                <div
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    borderRadius: 20, padding: "4px 10px",
                    background: `${brand.color}14`,
                    border: `1px solid ${brand.color}30`,
                    fontSize: 10, color: brand.color, fontFamily: "monospace",
                    maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  <Globe style={{ width: 10, height: 10, flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {brand.website.replace(/^https?:\/\//, "")}
                  </span>
                </div>
              )}
              {brand.badges?.length > 0 && brand.badges.map((badge) => (
                <span
                  key={badge}
                  style={{
                    fontSize: 9, padding: "3px 8px", borderRadius: 20,
                    background: "rgba(124,58,237,0.15)",
                    border: "1px solid rgba(124,58,237,0.3)",
                    color: "#a78bfa",
                    fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em",
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Bloco individual do mural com neon glow e hover delay ─────────────────────
function MuralBlock({
  brand,
  cellSize,
  x,
  y,
  highlighted,
  onPanelShow,
  onPanelHide,
}: {
  brand: Brand | undefined;
  cellSize: number;
  x: number;
  y: number;
  highlighted: boolean;
  onPanelShow: (brand: Brand, pos: { x: number; y: number }) => void;
  onPanelHide: () => void;
}) {
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const isPremiumZone = x >= 15 && x <= 35 && y >= 8 && y <= 22;
  const zGlow = zoneGlow(x, y);

  const brandGlow = brand
    ? `0 0 ${highlighted ? 18 : 10}px ${brand.color}cc, 0 0 ${highlighted ? 32 : 20}px ${brand.color}77`
    : "none";

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!brand) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    hoverTimerRef.current = setTimeout(() => {
      onPanelShow(brand, { x: rect.right, y: rect.top });
    }, 1000); // 1 segundo de delay real
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    onPanelHide();
  };

  useEffect(() => () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }, []);

  return (
    <motion.div
      ref={blockRef}
      className="cursor-pointer relative overflow-hidden"
      style={{
        width: cellSize,
        height: cellSize,
        borderRadius: Math.max(2, cellSize * 0.18),
        backgroundColor: brand
          ? highlighted ? brand.color : `${brand.color}bb`
          : isPremiumZone
          ? "rgba(124,58,237,0.06)"
          : "rgba(255,255,255,0.025)",
        border: brand
          ? highlighted
            ? `1.5px solid ${brand.color}`
            : `1px solid ${brand.color}66`
          : isPremiumZone
          ? "1px solid rgba(124,58,237,0.25)"
          : "1px solid rgba(255,255,255,0.06)",
        boxShadow: brand ? brandGlow : "none",
        fontSize: cellSize > 16 ? "7px" : "5px",
        color: brand ? "#fff" : "transparent",
        fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      whileHover={brand
        ? {
            scale: 1.35,
            boxShadow: `0 0 30px ${brand.color}ee, 0 0 60px ${brand.color}88, 0 0 90px ${brand.color}44, 0 20px 40px rgba(0,0,0,0.8)`,
            zIndex: 30,
            y: -12,
            rotateX: 10,
            rotateY: -5,
          }
        : isPremiumZone
        ? { scale: 1.12, boxShadow: `0 0 16px ${zGlow}`, y: -2, zIndex: 10 }
        : {}}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => brand && window.open(brand.website, "_blank")}
    >
      {brand && cellSize > 14 ? brand.logo : ""}

      {/* Shimmer de brilho interno no hover */}
      {brand && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 30%, ${brand.color}30, transparent 70%)`,
            transition: "opacity 0.3s",
          }}
        />
      )}
    </motion.div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
const MuralGrid = ({ searchHighlight }: MuralGridProps) => {
  const [zoom, setZoom] = useState(1);
  const [panelBrand, setPanelBrand] = useState<Brand | null>(null);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });

  const blockMap = useMemo(() => {
    const map = new Map<string, Brand>();
    MOCK_BRANDS.forEach((brand) => {
      brand.blocks.forEach((block) => {
        map.set(`${block.x},${block.y}`, brand);
      });
    });
    return map;
  }, []);

  const isHighlighted = useCallback(
    (brand: Brand | undefined) => {
      if (!searchHighlight || !brand) return false;
      return brand.name.toLowerCase().includes(searchHighlight.toLowerCase()) ||
        brand.category.toLowerCase().includes(searchHighlight.toLowerCase());
    },
    [searchHighlight]
  );

  const cellSize = 14 * zoom;
  const visibleSize = Math.min(GRID_SIZE, 50);

  const handlePanelShow = useCallback((brand: Brand, pos: { x: number; y: number }) => {
    setPanelBrand(brand);
    setPanelPos(pos);
  }, []);

  const handlePanelHide = useCallback(() => {
    setPanelBrand(null);
  }, []);

  return (
    <section id="mural" className="py-12 relative w-full overflow-hidden bg-stage-void">
      <div className="w-full px-2 md:px-4">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">
            O <span className="text-gradient">Mural</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Cada bloco é um território digital. Passe o mouse e mantenha para explorar a marca.
          </p>
        </motion.div>

        {/* Zoom controls */}
        <div className="flex justify-center gap-2 mb-6">
          <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(z + 0.3, 2.5))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(z - 0.3, 0.5))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setZoom(1)}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Grid container com visual neon */}
        <div
          className="relative overflow-auto max-h-[85vh] w-full"
          style={{
            borderRadius: 24,
            padding: 1,
            // Borda gradiente neon: o wrapper externo é o "anel" da borda
            background: "linear-gradient(135deg, rgba(124,58,237,0.6) 0%, rgba(16,185,129,0.3) 50%, rgba(240,193,75,0.5) 100%)",
            boxShadow: "0 0 40px rgba(124,58,237,0.2), 0 0 80px rgba(124,58,237,0.08), 0 24px 48px rgba(0,0,0,0.5)",
          }}
        >
          {/* Interior escuro translúcido */}
          <div
            style={{
              borderRadius: 19,
              background: "rgba(5,5,10,0.96)",
              backdropFilter: "blur(8px)",
              padding: 24,
              position: "relative",
            }}
          >
            {/* Aura de fundo cósmica */}
            <div
              className="absolute inset-0 rounded-[19px] pointer-events-none"
              style={{
                background: [
                  "radial-gradient(ellipse 70% 40% at 50% 10%, rgba(124,58,237,0.10) 0%, transparent 60%)",
                  "radial-gradient(ellipse 50% 50% at 80% 80%, rgba(16,185,129,0.07) 0%, transparent 50%)",
                  "radial-gradient(ellipse 40% 35% at 20% 70%, rgba(240,193,75,0.06) 0%, transparent 50%)",
                ].join(", "),
              }}
            />

            <div
              className="grid gap-[2px] mx-auto relative"
              style={{
                gridTemplateColumns: `repeat(${visibleSize}, ${cellSize}px)`,
                width: "fit-content",
              }}
            >
              {Array.from({ length: visibleSize * Math.min(30, visibleSize) }).map((_, i) => {
                const x = i % visibleSize;
                const y = Math.floor(i / visibleSize);
                const key = `${x},${y}`;
                const brand = blockMap.get(key);
                const highlighted = isHighlighted(brand);

                return (
                  <MuralBlock
                    key={key}
                    brand={brand}
                    cellSize={cellSize}
                    x={x}
                    y={y}
                    highlighted={highlighted}
                    onPanelShow={handlePanelShow}
                    onPanelHide={handlePanelHide}
                  />
                );
              })}
            </div>

            {/* Zona premium label */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full pointer-events-none"
              style={{
                background: "rgba(240,193,75,0.08)",
                border: "1px solid rgba(240,193,75,0.3)",
                boxShadow: "0 0 12px rgba(240,193,75,0.15)",
              }}
            >
              <span style={{ fontSize: 11, color: "#f0c14b", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.16em" }}>
                ✦ Zona Premium
              </span>
            </div>
          </div>
        </div>

        {/* Painel flutuante glassmorphism — revelado após ~1s de hover */}
        <AnimatePresence>
          {panelBrand && (
            <BrandHoverPanel brand={panelBrand} pos={panelPos} />
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default MuralGrid;
