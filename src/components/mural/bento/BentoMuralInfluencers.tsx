import { useMemo, useState, memo, useRef, useEffect, useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { getInfluencerRankScore, type MuralInfluencer } from "@/data/influencerMockData";
import { cn } from "@/lib/utils";
import { MuralImageWithSkeleton } from "./MuralImageWithSkeleton";
import { ArrowUpRight, Star, Users, TrendingUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";


/** Lado máximo do card, em px — usado quando há poucos criadores. */
const CARD_MAX_PX = 120;
/** Lado mínimo, um terço do máximo. Piso pedido pelo produto. */
const CARD_MIN_PX = 46;
/** Abaixo deste tamanho, o card esconde texto e mostra só a foto. */
const COMPACT_BELOW_PX = 90;
const GAP_PX = 6;

function initials(inf: MuralInfluencer): string {
  return (inf.logo || inf.name || "?").slice(0, 2).toUpperCase();
}

/** Métricas em formato compacto — 12.4k, 1.2M. */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

/**
 * Taxa de engajamento derivada dos dados disponíveis (cliques na última hora
 * projetados sobre a base de seguidores). É uma proxy comparável entre
 * criadores, não uma métrica oficial de plataforma.
 */
function engagementRate(inf: MuralInfluencer): number {
  const followers = inf.followers_count ?? 0;
  if (followers <= 0) return 0;
  return Math.min(99, ((inf.clicks_last_hour ?? 0) / followers) * 100 * 24);
}

// ── Painel flutuante de criador (glassmorphism, revelado após ~1s de hover) ───
function InfluencerHoverPanel({ inf, pos }: { inf: MuralInfluencer; pos: { x: number; y: number } }) {
  const flipX = pos.x + 250 > window.innerWidth;
  const flipY = pos.y + 220 > window.innerHeight;
  const left = flipX ? Math.max(8, pos.x - 240) : pos.x + 10;
  const top  = flipY ? Math.max(8, pos.y - 210) : pos.y + 10;
  const accent = inf.color || "#d946ef";
  const followers = inf.followers_count ?? 0;
  const engagement = engagementRate(inf);
  const fmt = (n: number) => n >= 1_000_000 ? `${(n/1e6).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}K` : String(n);

  return (
    <motion.div
      className="fixed z-[300] pointer-events-none"
      style={{ left, top, width: 240 }}
      initial={{ opacity: 0, scale: 0.9, y: 8, rotateX: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 4 }}
      transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.7 }}
    >
      <div style={{ borderRadius: 18, padding: 1,
        background: `linear-gradient(135deg, ${accent}99, ${accent}22 50%, rgba(192,38,211,0.55) 80%, ${accent}77)`,
        boxShadow: `0 0 24px ${accent}44, 0 0 48px ${accent}18, 0 20px 40px rgba(0,0,0,0.75)`,
      }}>
        <div style={{ borderRadius: 17, background: "rgba(10,4,18,0.95)", backdropFilter: "blur(20px)", overflow: "hidden" }}>
          <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, boxShadow: `0 0 10px ${accent}99` }} />
          <div style={{ padding: "12px 14px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, overflow: "hidden",
                background: `linear-gradient(145deg, ${accent}dd, ${accent}55)`,
                boxShadow: `0 4px 14px ${accent}55`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 900, color: "#fff" }}>
                {inf.logo_url
                  ? <img src={inf.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (inf.logo || inf.name || "?").slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inf.name}</div>
                <div style={{ fontSize: 10, color: `${accent}cc`, marginTop: 1, textTransform: "uppercase", letterSpacing: "0.1em" }}>{inf.category}</div>
              </div>
            </div>
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              {[
                { icon: <Users style={{ width: 10, height: 10 }} />, label: "Seguidores", val: fmt(followers) },
                { icon: <TrendingUp style={{ width: 10, height: 10 }} />, label: "Engajamento", val: `${engagement.toFixed(1)}%` },
              ].map(({ icon, label, val }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 9, padding: "7px 9px", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ color: accent }}>{icon}</span>
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.88)", lineHeight: 1 }}>{val}</div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
            {inf.has_active_campaigns && (
              <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5,
                borderRadius: 20, padding: "3px 9px",
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                fontSize: 9, color: "#4ade80", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                Ativo
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const InfluencerCard = memo(({

  inf,
  rank,
  compact: isCompact,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onSelect,
  isHighlighted,
  onPanelShow,
  onPanelHide,
}: {
  inf: MuralInfluencer;
  rank: number;
  /** Card pequeno demais para texto: mostra só o retrato. */
  compact: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onSelect: (inf: MuralInfluencer) => void;
  isHighlighted: boolean;
  onPanelShow: (inf: MuralInfluencer, pos: { x: number; y: number }) => void;
  onPanelHide: () => void;
}) => {
  const followers = inf.followers_count ?? 0;
  const engagement = engagementRate(inf);
  const isTop = rank < 3;
  const accent = inf.color || "#d946ef";
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    onHoverStart();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    hoverTimerRef.current = setTimeout(() => {
      onPanelShow(inf, { x: rect.right, y: rect.top });
    }, 1000);
  };
  const handleMouseLeave = () => {
    onHoverEnd();
    onPanelHide();
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  };
  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }, []);

  return (
    <li className="list-none">
      {/* Anel de borda neon — 1px de gradiente na cor do criador */}
      <div
        style={{
          borderRadius: "50%",
          padding: isHovered ? 3 : 2,
          background: isHovered || isHighlighted
            ? `linear-gradient(135deg, ${accent}, ${accent}88 40%, rgba(192,38,211,0.8) 70%, ${accent})`
            : `linear-gradient(135deg, ${accent}aa, ${accent}44)`,
          boxShadow: isHovered
            ? `0 0 25px ${accent}, 0 0 50px ${accent}88`
            : `0 0 10px ${accent}66`,
          transition: "all 0.4s ease-out",
        }}
      >
      <motion.a
        href={`/influencer/${inf.id}`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          onSelect(inf);
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={onHoverStart}
        onBlur={handleMouseLeave}
        aria-label={`${inf.name}, ${inf.category} creator. ${compact(followers)} followers, ${engagement.toFixed(1)}% engagement.`}
        className={cn(
          "group relative block overflow-hidden w-full h-full cursor-pointer rounded-full",
          "bg-[#0c0d10]",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
        )}
        style={{
          boxShadow: isHovered
            ? `0 24px 50px -12px rgba(0,0,0,0.95), inset 0 3px 6px rgba(255,255,255,0.3), inset 0 -4px 8px rgba(0,0,0,0.8)`
            : `0 8px 20px -6px rgba(0,0,0,0.9), inset 0 1px 3px rgba(255,255,255,0.15), inset 0 -2px 5px rgba(0,0,0,0.65)`,
          transition: "box-shadow 0.4s ease-out",
        }}
        initial={{ scale: 1, y: 0, rotateX: 0, rotateY: 0 }}
        animate={isHovered ? {
          scale: 1.15,
          y: -8,
          rotateX: 8,
          rotateY: -4,
          zIndex: 30,
        } : {
          scale: 1,
          y: 0,
          rotateX: 0,
          rotateY: 0,
          zIndex: 1,
        }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
      >

        {/*
          Proporção fixa 4:5 para TODOS os cards. A versão anterior escalava
          o card com a relevância do criador (col-span até 4×4), o que
          gerava cards de 600px+ e buracos no empacotamento denso. A
          relevância agora é comunicada pela ordem e pelo selo de destaque —
          sinais que não deformam a grade.
        */}
        <div className="relative aspect-square w-full overflow-hidden">
          <MuralImageWithSkeleton
            src={inf.logo_url ?? ""}
            alt={`Portrait of ${inf.name}, ${inf.category} creator`}
            className="h-full w-full"
            imgClassName={cn(
              "h-full w-full object-cover transition-transform duration-700 ease-out",
              "group-hover:scale-105 group-focus-visible:scale-105"
            )}
            fallback={
              <div className="grid h-full w-full place-items-center bg-[#17181C]">
                <span className="font-ui text-xl font-semibold tracking-tight text-white/20">
                  {initials(inf)}
                </span>
              </div>
            }
          />

          {/* Degradê de leitura no rodapé da foto (só quando há texto) */}
          <div
            className={cn("pointer-events-none absolute inset-0", isCompact && "opacity-0")}
            style={{
              background:
                "linear-gradient(to top, rgba(9,10,12,0.97) 0%, rgba(9,10,12,0.72) 26%, rgba(9,10,12,0.12) 52%, rgba(9,10,12,0) 68%)",
            }}
          />

          {/* Brilho de borda no hover, na cor do criador */}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background: `radial-gradient(130% 60% at 50% 100%, ${inf.color || "#d946ef"}26, transparent 72%)`,
            }}
          />

          {isTop && !isCompact && (
            <span
              className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/50 px-1.5 py-0.5 backdrop-blur-md"
              title="Among the top-performing creators"
            >
              <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300" />
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/75">
                top {rank + 1}
              </span>
            </span>
          )}

          <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border border-white/15 bg-black/45 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
            <ArrowUpRight className="h-3 w-3 text-white/90" />
          </span>

          {/*
            Identidade só aparece quando há espaço real. Em cards de 58px,
            nome e métricas viram borrões ilegíveis sobre a foto — melhor
            deixar o retrato limpo e revelar os dados no hover/modal.
          */}
          {!isCompact && (
          <div className="absolute inset-x-0 bottom-0 p-2.5">
            <p className="truncate font-mono text-[8px] uppercase tracking-[0.16em] text-white/45">
              {inf.category}
            </p>
            <h3 className="truncate font-ui text-[12.5px] font-semibold leading-tight tracking-[-0.01em] text-white">
              {inf.name}
            </h3>

            <div className="mt-1.5 flex items-center gap-2 border-t border-white/[0.09] pt-1.5">
              <Metric label="reach" value={compact(followers)} />
              <span className="h-4 w-px bg-white/[0.09]" aria-hidden />
              <Metric label="engmt" value={`${engagement.toFixed(1)}%`} />
            </div>
          </div>
          )}
        </div>
      </motion.a>
      </div>{/* /neon border wrapper */}
    </li>
  );
});

InfluencerCard.displayName = "InfluencerCard";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10.5px] font-medium tabular-nums leading-none text-white/85">
        {value}
      </p>
      <p className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.12em] text-white/30">
        {label}
      </p>
    </div>
  );
}

interface BentoMuralInfluencersProps {
  influencers: MuralInfluencer[];
  searchHighlight?: string | null;
  categoryFilter?: string;
  onSelect: (inf: MuralInfluencer) => void;
}

const BentoMuralInfluencers = ({
  influencers,
  searchHighlight,
  categoryFilter = "Todos",
  onSelect,
}: BentoMuralInfluencersProps) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [panelInf, setPanelInf] = useState<MuralInfluencer | null>(null);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });

  const sorted = useMemo(
    () => [...influencers].sort((a, b) => getInfluencerRankScore(b) - getInfluencerRankScore(a)),
    [influencers]
  );

  const filtered = useMemo(() => {
    if (!categoryFilter || categoryFilter === "Todos") return sorted;
    const c = categoryFilter.toLowerCase();
    return sorted.filter(
      (i) =>
        (i.category || "").toLowerCase().includes(c) ||
        (i.interest_categories ?? []).some((x) => (x || "").toLowerCase().includes(c))
    );
  }, [sorted, categoryFilter]);

  const isHighlighted = (inf: MuralInfluencer) => {
    if (!searchHighlight?.trim()) return false;
    const q = searchHighlight.toLowerCase();
    return (
      (inf.name || "").toLowerCase().includes(q) ||
      (inf.category || "").toLowerCase().includes(q) ||
      (inf.interest_categories ?? []).some((x) => (x || "").toLowerCase().includes(q))
    );
  };

  // ── Dimensionamento automático ──────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState(CARD_MAX_PX);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const recompute = () => {
      const count = filtered.length;
      if (count === 0) return;

      const styles = getComputedStyle(el);
      const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const w = el.clientWidth - padX;
      const h = el.clientHeight - padY;
      if (w <= 0 || h <= 0) return;

      let lo = CARD_MIN_PX;
      let hi = CARD_MAX_PX;
      const fits = (side: number) => {
        const cols = Math.max(1, Math.floor((w + GAP_PX) / (side + GAP_PX)));
        const rows = Math.max(1, Math.floor((h + GAP_PX) / (side + GAP_PX)));
        return cols * rows >= count;
      };
      if (fits(hi)) {
        lo = hi;
      } else {
        while (hi - lo > 1) {
          const mid = Math.floor((lo + hi) / 2);
          if (fits(mid)) lo = mid;
          else hi = mid;
        }
      }
      setCardSize(Math.max(CARD_MIN_PX, Math.min(CARD_MAX_PX, lo)));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [filtered.length]);

  return (
    <div ref={containerRef} className="h-full w-full !max-w-none overflow-y-auto overscroll-contain bg-stage-void relative">
      <ul
        className="grid w-full !max-w-none"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
          gap: `${GAP_PX}px`,
          width: "100%",
        }}
      >
        {filtered.map((inf, rank) => (
          <InfluencerCard
            key={inf.id}
            inf={inf}
            rank={rank}
            compact={cardSize < COMPACT_BELOW_PX}
            isHovered={hoveredId === inf.id}
            onHoverStart={() => setHoveredId(inf.id)}
            onHoverEnd={() => setHoveredId(null)}
            onSelect={onSelect}
            isHighlighted={isHighlighted(inf)}
            onPanelShow={(i, pos) => { setPanelInf(i); setPanelPos(pos); }}
            onPanelHide={() => setPanelInf(null)}
          />
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="py-20 text-center font-ui text-sm text-white/35">
          No creators match this filter.
        </p>
      )}

      {/* Painel glassmorphism — revelado após ~1s de hover */}
      <AnimatePresence>
        {panelInf && (
          <InfluencerHoverPanel inf={panelInf} pos={panelPos} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default BentoMuralInfluencers;

