import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/** Cor padrão da marca: dourado (igual em todo o site) */
const BRAND_GOLD = "hsl(45 92% 55%)";
const BRAND_GOLD_GLOW = "hsla(45, 92%, 55%, 0.5)";

interface ConeXaiLogoProps {
  className?: string;
  iconClassName?: string;
  showText?: boolean;
  textClassName?: string;
}

/** Logo padrão ConeXai: 4 blocos (2x2) dourados, brilho no canto superior direito — mesma marca em todo o site */
export function ConeXaiLogo({ className = "", iconClassName = "", showText = true, textClassName = "font-display font-bold text-base" }: ConeXaiLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 shrink-0 ${className}`}>
      <span
        className={`inline-grid grid-cols-2 gap-px ${iconClassName}`}
        style={{
          width: 22,
          height: 22,
          filter: `drop-shadow(0 0 4px ${BRAND_GOLD_GLOW}) drop-shadow(0 0 8px hsla(45, 92%, 55%, 0.25))`,
        }}
      >
        <span className="w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ backgroundColor: "hsl(45 92% 48%)" }} />
        <motion.span
          className="w-2.5 h-2.5 rounded-[2px] flex items-center justify-center relative shrink-0"
          style={{ backgroundColor: BRAND_GOLD }}
          animate={{
            boxShadow: [
              `0 0 6px ${BRAND_GOLD}, 0 0 12px ${BRAND_GOLD_GLOW}`,
              `0 0 12px ${BRAND_GOLD}, 0 0 24px hsla(45, 92%, 55%, 0.6)`,
              `0 0 6px ${BRAND_GOLD}, 0 0 12px ${BRAND_GOLD_GLOW}`,
            ],
            scale: [1, 1.08, 1],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles className="w-2.5 h-2.5 text-black/80" style={{ filter: "drop-shadow(0 0 2px rgba(255,255,255,0.9))" }} />
        </motion.span>
        <span className="w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ backgroundColor: "hsl(45 92% 48%)" }} />
        <span className="w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ backgroundColor: "hsl(45 92% 42%)" }} />
      </span>
      {showText && (
        <span className={textClassName}>
          Cone<span style={{ color: BRAND_GOLD }}>X</span>ai
        </span>
      )}
    </span>
  );
}
