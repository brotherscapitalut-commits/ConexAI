import { useState, useMemo, useEffect, useRef, memo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MOCK_INFLUENCERS, type MuralInfluencer } from "@/data/influencerMockData";
import { Brand } from "@/data/mockData";
import RankingDetailModal from "./ranking/RankingDetailModal";
import SpotlightConfetti from "./mural/SpotlightConfetti";
import { useInView } from "@/hooks/useInView";

interface InfluencerMuralGridProps {
  searchHighlight?: string | null;
  focusBrand?: string | null;
  onFocusComplete?: () => void;
  /** Filtro rápido por categoria (null ou "Todos" = todos). */
  categoryFilter?: string | null;
}

interface FloatingItem {
  brand: Brand;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
}

function isLogoUrl(logo: string): boolean {
  return typeof logo === "string" && (logo.startsWith("http") || logo.startsWith("/"));
}

interface InfluencerBubbleCardProps {
  item: FloatingItem;
  highlighted: boolean;
  dimmed: boolean;
  isHovered: boolean;
  isSpotlight: boolean;
  onHover: (name: string | null) => void;
  onSelect: (brand: Brand) => void;
}

const InfluencerBubbleCard = memo(function InfluencerBubbleCard({
  item,
  highlighted,
  dimmed,
  isHovered,
  isSpotlight,
  onHover,
  onSelect,
}: InfluencerBubbleCardProps) {
  const { ref, inView } = useInView({ rootMargin: "80px" });
  const isActive = isHovered || highlighted || isSpotlight;

  if (!inView) {
    return (
      <div
        ref={ref}
        className="absolute cursor-pointer"
        style={{
          left: `${item.x}%`,
          top: `${item.y}%`,
          zIndex: 10,
          width: item.size,
          height: item.size,
          opacity: dimmed ? 0 : 1,
          pointerEvents: dimmed ? "none" : "auto",
        }}
        title={item.brand.name}
        onMouseEnter={() => onHover(item.brand.name)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onSelect(item.brand)}
      >
        <div
          className="rounded-full border-2 overflow-hidden bg-background/20 flex items-center justify-center"
          style={{
            width: item.size,
            height: item.size,
            borderColor: `${item.brand.color}80`,
          }}
        >
          {isLogoUrl(item.brand.logo) ? (
            <img
              src={item.brand.logo}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-lg font-display font-bold" style={{ color: item.brand.color }}>
              {item.brand.logo}
            </span>
          )}
        </div>
      </div>
    );
  }

  const showNameLabel = item.size >= 48;
  return (
    <div
      ref={ref}
      className="absolute cursor-pointer group"
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        zIndex: isActive ? 30 : 10,
        opacity: dimmed ? 0 : 1,
        pointerEvents: dimmed ? "none" : "auto",
        transition: "opacity 0.2s ease, transform 0.25s ease",
        transform:
          isHovered || isSpotlight || highlighted
            ? "scale(1.08)"
            : "scale(1)",
      }}
      title={item.brand.name}
      onMouseEnter={() => onHover(item.brand.name)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(item.brand)}
    >
      <div
        className="absolute inset-0 rounded-full transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle, ${item.brand.color}50 0%, transparent 70%)`,
          transform: "scale(1.8)",
          opacity: isActive ? 0.8 : 0.2,
        }}
      />
      {isSpotlight && (
        <div
          className="absolute inset-0 rounded-full border-2 animate-ping"
          style={{ borderColor: item.brand.color }}
        />
      )}
      <div
        className="relative rounded-full flex items-center justify-center border-2 transition-all duration-300 overflow-hidden"
        style={{
          width: item.size,
          height: item.size,
          borderColor: isActive ? item.brand.color : `${item.brand.color}80`,
          background: `linear-gradient(135deg, ${item.brand.color}30, ${item.brand.color}10)`,
          backdropFilter: "blur(8px)",
          boxShadow: isActive
            ? `0 0 30px ${item.brand.color}60, 0 0 60px ${item.brand.color}20, inset 0 0 20px ${item.brand.color}15`
            : `0 4px 20px ${item.brand.color}15`,
        }}
      >
        {isLogoUrl(item.brand.logo) ? (
          <img
            src={item.brand.logo}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            className="font-display font-bold select-none"
            style={{
              fontSize: item.size * 0.3,
              color: item.brand.color,
              textShadow: `0 0 10px ${item.brand.color}60`,
            }}
          >
            {item.brand.logo}
          </span>
        )}
      </div>
      {showNameLabel && isActive && (
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap transition-opacity duration-200"
          style={{ top: item.size + 6 }}
        >
          <div className="px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-md border border-border shadow-lg">
            <p className="text-xs font-display font-semibold text-foreground">
              {item.brand.name}
            </p>
            <p className="text-[10px] text-muted-foreground text-center">
              {item.brand.category}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

const InfluencerMuralGrid = ({ searchHighlight, focusBrand, onFocusComplete, categoryFilter }: InfluencerMuralGridProps) => {
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const hasFocus = searchHighlight && searchHighlight.length > 0;

  const isHighlighted = (brand: Brand) => {
    if (!searchHighlight) return false;
    return (
      brand.name.toLowerCase().includes(searchHighlight.toLowerCase()) ||
      brand.category.toLowerCase().includes(searchHighlight.toLowerCase())
    );
  };

  const filteredInfluencers = useMemo(() => {
    if (!categoryFilter || categoryFilter === "Todos") return MOCK_INFLUENCERS;
    const cat = categoryFilter.toLowerCase();
    return MOCK_INFLUENCERS.filter(
      (b) => b.category.toLowerCase() === cat || b.category.toLowerCase().includes(cat)
    );
  }, [categoryFilter]);

  const INFLUENCER_SPOTLIGHT_COUNT = 4;
  useEffect(() => {
    const len = filteredInfluencers.length || 1;
    const timer = setInterval(() => {
      setSpotlightIndex((prev) => (prev + INFLUENCER_SPOTLIGHT_COUNT) % len);
    }, 5000);
    return () => clearInterval(timer);
  }, [filteredInfluencers.length]);

  const spotlightInfluencers = useMemo(() => {
    const set = new Set<string>();
    const list = filteredInfluencers.length > 0 ? filteredInfluencers : MOCK_INFLUENCERS;
    const len = list.length || 1;
    for (let i = 0; i < Math.min(INFLUENCER_SPOTLIGHT_COUNT, len); i++) {
      const idx = (spotlightIndex + i) % len;
      set.add(list[idx].name);
    }
    return set;
  }, [spotlightIndex, filteredInfluencers]);

  useEffect(() => {
    if (focusBrand) {
      const list = filteredInfluencers.length > 0 ? filteredInfluencers : MOCK_INFLUENCERS;
      const brand = list.find((b) => b.name.toLowerCase() === focusBrand.toLowerCase());
      if (brand) setSelectedBrand(brand);
      setTimeout(() => onFocusComplete?.(), 500);
    }
  }, [focusBrand, onFocusComplete, filteredInfluencers]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ w: rect.width, h: rect.height });
    };
    update();
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(update, 150);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const floatingItems: FloatingItem[] = useMemo(() => {
    const list = filteredInfluencers.length > 0 ? filteredInfluencers : MOCK_INFLUENCERS;
    return list.map((brand, i) => {
      const cols = 8;
      const rows = Math.ceil(list.length / cols) || 1;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const baseX = (col / cols) * 94 + 3;
      const baseY = (row / rows) * 88 + 6;
      const jitterX = Math.sin(i * 3.7) * 6;
      const jitterY = Math.cos(i * 2.3) * 6;
      const inf = brand as MuralInfluencer;
      const size = inf.bubbleSizePx;
      return {
        brand,
        x: baseX + jitterX,
        y: baseY + jitterY,
        size,
        duration: 6 + (i % 5) * 2,
        delay: (i % 7) * 0.3,
        driftX: 0,
        driftY: 0,
      };
    });
  }, [filteredInfluencers]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 30% 20%, hsl(280 30% 12%) 0%, hsl(260 25% 8%) 40%, hsl(240 20% 5%) 100%)",
      }}
    >
      {/* Ambient glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{
            background: "hsl(280 60% 50%)",
            top: "10%",
            left: "20%",
            animation: "pulse 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-15 blur-[100px]"
          style={{
            background: "hsl(200 80% 50%)",
            bottom: "15%",
            right: "15%",
            animation: "pulse 10s ease-in-out infinite 2s",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-10 blur-[80px]"
          style={{
            background: "hsl(340 70% 50%)",
            top: "50%",
            left: "60%",
            animation: "pulse 7s ease-in-out infinite 4s",
          }}
        />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(280 60% 60%) 1px, transparent 1px), linear-gradient(90deg, hsl(280 60% 60%) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating influencer bubbles (memoized + in-view only full animation) */}
      {floatingItems.map((item) => (
        <InfluencerBubbleCard
          key={item.brand.name}
          item={item}
          highlighted={isHighlighted(item.brand)}
          dimmed={hasFocus && !isHighlighted(item.brand)}
          isHovered={hoveredId === item.brand.name}
          isSpotlight={spotlightInfluencers.has(item.brand.name)}
          onHover={setHoveredId}
          onSelect={setSelectedBrand}
        />
      ))}

      {/* Confetti burst on spotlight influencers */}
      {floatingItems
        .filter((item) => spotlightInfluencers.has(item.brand.name))
        .map((item) => (
          <SpotlightConfetti
            key={`confetti-inf-${item.brand.name}-${spotlightIndex}`}
            x={item.x}
            y={item.y}
            color={item.brand.color}
            triggerId={`${item.brand.name}-${spotlightIndex}`}
            count={12}
          />
        ))}

      {/* Static ambient particles (no continuous animation for performance) */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={`particle-${i}`}
          className="absolute rounded-full pointer-events-none opacity-30"
          style={{
            width: 2 + (i % 2),
            height: 2 + (i % 2),
            background: `hsl(${260 + (i * 12) % 80} 60% 60% / 0.5)`,
            left: `${(i * 37) % 100}%`,
            top: `${(i * 23) % 100}%`,
          }}
        />
      ))}

      {/* Bottom info bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 backdrop-blur-md border border-border text-xs font-medium text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          {filteredInfluencers.length > 0 ? filteredInfluencers.length : MOCK_INFLUENCERS.length} influenciadores ativos
        </div>
      </div>

      <RankingDetailModal brand={selectedBrand} onClose={() => setSelectedBrand(null)} type="influencers" />
    </div>
  );
};

export default memo(InfluencerMuralGrid);
