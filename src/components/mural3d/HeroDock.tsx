import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GRID_COLS, GRID_ROWS, type MuralBrand } from "@/lib/mural/types";
import { OledCounter } from "./OledCounter";
import { cn } from "@/lib/utils";

interface HeroDockProps {
  brands: MuralBrand[];
  /** Rota do CTA principal. */
  ctaHref?: string;
  className?: string;
}

const TOTAL_BLOCKS = GRID_COLS * GRID_ROWS;

/**
 * Hero em formato de dock flutuante sobre o palco 3D.
 *
 * A decisão de forma aqui é deliberada: um hero de tela cheia empurraria
 * o mural para baixo da dobra, e o mural *é* o produto. Então o hero vira
 * um painel de vidro ancorado no topo — título, instrumentos e CTA —
 * deixando o grid visível e interativo o tempo todo.
 */
export function HeroDock({ brands, ctaHref = "/precos", className }: HeroDockProps) {
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const claimed = brands.reduce((sum, b) => sum + (b.blocks?.length ?? 0), 0);
    const pct = TOTAL_BLOCKS > 0 ? (claimed / TOTAL_BLOCKS) * 100 : 0;
    return { claimed, brands: brands.length, pct };
  }, [brands]);

  return (
    <motion.div
      className={cn("pointer-events-none w-full px-4", className)}
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="glass-panel glass-panel--beveled pointer-events-auto mx-auto flex w-full max-w-3xl flex-col items-center gap-4 rounded-3xl px-6 py-5 sm:flex-row sm:gap-6 sm:py-4">
        {/* ── Identidade ── */}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-stream-core shadow-[0_0_8px_hsl(var(--stream-core))]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">
              ao vivo
            </span>
          </div>

          <h1 className="mt-2 font-ui text-[22px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white sm:text-[26px]">
            Um milhão de pixels.
            <br className="hidden sm:block" />{" "}
            <span className="text-white/40">Um território por marca.</span>
          </h1>
        </div>

        {/* ── Instrumentos ── */}
        <div className="flex shrink-0 items-stretch gap-px overflow-hidden rounded-2xl border border-white/[0.07]">
          <Readout label="reivindicados" value={stats.claimed} digits={6} />
          <Readout label="marcas" value={stats.brands} digits={3} />
          <Readout label="ocupação" value={Number(stats.pct.toFixed(1))} digits={2} suffix="%" />
        </div>

        {/* ── CTA ── */}
        <button
          type="button"
          onClick={() => navigate(ctaHref)}
          className={cn(
            "tile-3d group inline-flex shrink-0 items-center gap-2 rounded-tile px-5 py-3",
            "font-ui text-[13px] font-bold tracking-tight text-stage-void",
            "bg-gradient-to-b from-white to-white/85",
            "transition-transform duration-300 ease-out-soft"
          )}
        >
          <Sparkles className="h-4 w-4" />
          Reservar pixels
          <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out-soft group-hover:translate-x-0.5" />
        </button>
      </div>
    </motion.div>
  );
}

function Readout({
  label,
  value,
  digits,
  suffix,
}: {
  label: string;
  value: number;
  digits: number;
  suffix?: string;
}) {
  return (
    <div className="flex min-w-[86px] flex-col items-center justify-center gap-1 bg-white/[0.02] px-3 py-2.5">
      <OledCounter value={value} digits={digits} suffix={suffix} className="text-[17px] font-medium" />
      <span className="font-ui text-[9px] uppercase tracking-[0.16em] text-white/28">{label}</span>
    </div>
  );
}

export default HeroDock;
