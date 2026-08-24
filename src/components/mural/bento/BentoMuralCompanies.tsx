import { useMemo, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MuralBrand } from "@/lib/mural/types";
import { recordClick } from "@/lib/mural/MuralDataLoader";
import { cn } from "@/lib/utils";
import { MuralImageWithSkeleton } from "./MuralImageWithSkeleton";
import { SparklineSvg } from "./SparklineSvg";
import { Target, Crown, Star, Sparkles, TrendingUp, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

function scoreBrand(brand: MuralBrand): number {
  const bids = brand.blocks?.length ?? 0;
  const deals = brand.completed_deals ?? 0;
  const perpetual = brand.isPerpetual ? 1000 : 0;
  return perpetual + bids * 10 + deals * 5 + (brand.clicks ?? 0) * 0.01;
}

/** Proporção por lotes / Plus — alinhado à lógica de zonas (Basic → Premium). */
function spanFromBlocks(brand: MuralBrand): string {
  const blocks = brand.blocks?.length ?? 0;
  if (brand.isPerpetual) return "col-span-4 row-span-4";
  if (blocks >= 18) return "col-span-4 row-span-4";
  if (blocks >= 12) return "col-span-3 row-span-3";
  if (blocks >= 6) return "col-span-2 row-span-2";
  return "col-span-1 row-span-1";
}

/** Crescimento simulado estável (sem Math.random) — só para UI tipo bolsa. */
function growthPercent(brand: MuralBrand): string {
  const blocks = brand.blocks?.length ?? 0;
  const c = brand.clicks ?? 0;
  const v = Math.min(99, Math.round(blocks * 2.4 + c * 0.001 + (brand.isPerpetual ? 12 : 0)));
  return v.toFixed(2);
}

interface BentoMuralCompaniesProps {
  brands: MuralBrand[];
  searchHighlight?: string | null;
  categoryFilter?: string;
  highlightTopByBids?: boolean;
  ownerCompanyId?: string | null;
  aiHighlightedIds?: string[];
  onSelectBrand: (brand: MuralBrand) => void;
  onBidRequest?: (brand: MuralBrand) => void;
}

const BentoMuralCompanies = ({
  brands,
  searchHighlight,
  categoryFilter = "Todos",
  highlightTopByBids = false,
  ownerCompanyId,
  aiHighlightedIds = [],
  onSelectBrand,
  onBidRequest,
}: BentoMuralCompaniesProps) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { t } = useI18n();

  const sorted = useMemo(() => {
    const list = [...brands];
    if (highlightTopByBids) list.sort((a, b) => scoreBrand(b) - scoreBrand(a));
    else list.sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0));
    return list;
  }, [brands, highlightTopByBids]);

  const filtered = useMemo(() => {
    if (!categoryFilter || categoryFilter === "Todos") return sorted;
    const c = categoryFilter.toLowerCase();
    return sorted.filter((b) => b.category.toLowerCase() === c || b.category.toLowerCase().includes(c));
  }, [sorted, categoryFilter]);

  const isHighlighted = (b: MuralBrand) => {
    if (!searchHighlight?.trim()) return false;
    const q = searchHighlight.toLowerCase();
    return b.name.toLowerCase().includes(q) || b.category.toLowerCase().includes(q);
  };

  return (
    <div className="min-h-full w-full bg-[#050505] py-6 selection:bg-amber-500/30 md:py-8 md:px-2">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4 [grid-auto-flow:dense] auto-rows-[140px]">
        {filtered.map((brand) => (
          <BentoMuralItem
            key={brand.id}
            brand={brand}
            isOwner={ownerCompanyId === brand.id}
            isHighlighted={isHighlighted(brand)}
            isAiHighlighted={aiHighlightedIds.includes(brand.id)}
            isHovered={hoveredId === brand.id}
            onHoverStart={() => setHoveredId(brand.id)}
            onHoverEnd={() => setHoveredId(null)}
            onSelect={() => {
              void recordClick(brand);
              onSelectBrand(brand);
            }}
            onBid={() => onBidRequest?.(brand)}
          />
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="py-16 text-center font-body text-sm text-white/40">{t("mural.no_brands")}</p>
      )}
    </div>
  );
};

interface BentoMuralItemProps {
  brand: MuralBrand;
  isOwner: boolean;
  isHighlighted: boolean;
  isAiHighlighted: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onSelect: () => void;
  onBid: () => void;
}

const BentoMuralItem = memo(({
  brand,
  isOwner,
  isHighlighted,
  isAiHighlighted,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onSelect,
  onBid
}: BentoMuralItemProps) => {
  const blocks = brand.blocks?.length ?? 0;
  const spanClass = spanFromBlocks(brand);
  const marketValue = blocks * 150.75 + (brand.clicks ?? 0) * 0.1;
  const showNameBlock = blocks >= 6 || brand.isPerpetual;
  const logoLg = brand.isPerpetual || blocks >= 12;
  const logoMd = !logoLg && blocks >= 6;
  const { t } = useI18n();

  // 3D Tilt state
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rx = ((y - centerY) / centerY) * -10;
    const ry = ((x - centerX) / centerX) * 10;
    setRotateX(rx);
    setRotateY(ry);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    onHoverEnd();
  };

  return (
    <li className={cn("list-none", spanClass)}>
      <motion.div
        role="button"
        tabIndex={0}
        onMouseEnter={onHoverStart}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={onSelect}
        animate={{
          rotateX,
          rotateY,
          scale: isHovered ? 1.02 : 1,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          "group relative flex h-full w-full cursor-pointer flex-col items-center justify-between overflow-hidden rounded-[2.5rem] border p-5 transition-all duration-300 md:p-7",
          "bg-gradient-to-br from-[#0A0A0A] to-[#050505] border-white/5",
          isOwner && "z-20 border-amber-500/50 shadow-[0_0_50px_rgba(251,191,36,0.2)] ring-1 ring-amber-500/20",
          !isOwner && "z-10",
          isHovered && "border-white/15 bg-gradient-to-br from-[#0f0f0f] to-[#080808] shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
          isAiHighlighted && "ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-[#050505]",
          isHighlighted && "ring-1 ring-amber-400/50",
        )}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Animated Background Pulse */}
        <div 
          className={cn(
            "absolute inset-0 opacity-[0.03] transition-opacity duration-1000",
            isHovered && "opacity-[0.1]"
          )}
          style={{ background: `radial-gradient(1000px circle at 50% 0%, ${brand.color}, transparent 60%)` }}
        />

        {/* Glow Halo */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.15, scale: 1.2 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="absolute inset-0 blur-3xl pointer-events-none"
              style={{ backgroundColor: brand.color }}
            />
          )}
        </AnimatePresence>

        {isOwner ? (
          <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-amber-500 px-3 py-1 text-black shadow-xl shadow-amber-500/20">
            <Target className="h-3 w-3 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-tighter">Sua marca</span>
          </div>
        ) : (
          brand.isPerpetual && (
            <div className="absolute left-4 top-4 z-20 flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
              <Sparkles className="h-3 w-3" /> Plus
            </div>
          )
        )}

        <div className="absolute right-4 top-4 opacity-30 transition-opacity group-hover:opacity-100">
          {brand.isPerpetual || blocks >= 18 ? (
            <Crown className="h-5 w-5 text-amber-500" />
          ) : blocks >= 12 ? (
            <Star className="h-4 w-4 text-amber-400" />
          ) : null}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div
            className={cn(
              "relative transition-all duration-700 ease-out",
              logoLg ? "h-28 w-28 sm:h-32 sm:w-32" : logoMd ? "h-20 w-20" : "h-14 w-14",
              isHovered && "scale-110 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            )}
            style={{ transform: "translateZ(30px)" }}
          >
            <div
              className={cn(
                "absolute inset-0 opacity-0 blur-3xl transition-opacity duration-1000",
                isHovered && "opacity-40"
              )}
              style={{ backgroundColor: brand.color }}
            />
            <MuralImageWithSkeleton
              src={brand.logo_url}
              alt={brand.name}
              className="h-full w-full object-contain filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]"
              imgClassName="object-contain"
              fallback={
                <div
                  className="flex h-full w-full items-center justify-center rounded-2xl text-lg font-bold text-white shadow-inner"
                  style={{ backgroundColor: `${brand.color}cc` }}
                >
                  {brand.logo?.slice(0, 2) || "?"}
                </div>
              }
            />
          </div>

          {showNameBlock && (
            <div className="text-center" style={{ transform: "translateZ(20px)" }}>
              <h3 className="font-display text-sm font-bold uppercase tracking-tight text-white mb-0.5 sm:text-base">
                {brand.name}
              </h3>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/25">
                {brand.category}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 w-full" style={{ transform: "translateZ(10px)" }}>
          <div className="flex items-end justify-between border-t border-white/5 pt-4">
            <div className="flex min-w-0 flex-col">
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1">{t("mural.market_cap")}</span>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-display text-xl font-black tracking-tighter text-white sm:text-2xl">
                  ${marketValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="flex items-center text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                  <TrendingUp className="mr-0.5 h-2.5 w-2.5" />
                  {growthPercent(brand)}%
                </span>
              </div>
            </div>
            <div className="h-10 w-20 shrink-0 opacity-15 transition-opacity duration-1000 group-hover:opacity-60">
              <SparklineSvg seed={`brand-${brand.id}`} className="h-full w-full" />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isHovered && onBid && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-4 bottom-4 z-30 grid grid-cols-2 gap-2 sm:inset-x-6 sm:bottom-5"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                className="h-9 bg-amber-500 font-black text-[10px] uppercase leading-tight text-black shadow-[0_15px_30px_rgba(251,191,36,0.3)] hover:bg-amber-400 sm:text-[11px]"
                onClick={onBid}
              >
                {t("mural.make_bid")} <ArrowUpRight className="ml-1 inline h-3 w-3 shrink-0" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 border-white/80 bg-transparent font-black text-[10px] uppercase text-white hover:bg-white/10 sm:text-[11px]"
                onClick={onSelect}
              >
                {t("mural.enter")}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </li>
  );
});

export default BentoMuralCompanies;
