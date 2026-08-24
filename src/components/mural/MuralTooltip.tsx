/**
 * @deprecated Substituído por `@/components/mural3d/TilePreviewCard`, que usa
 * a linguagem visual 3D (entrada com rotação em X, chip de logo com chanfro,
 * flip automático na viewport). Mantido apenas como fallback — remover assim
 * que o novo card estiver validado em produção.
 */
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Star, Users, Zap } from "lucide-react";
import type { MuralBrand } from "@/lib/mural/types";

interface MuralTooltipProps {
  brand: MuralBrand | null;
  coordinate?: string | null;
  position: { x: number; y: number };
  isDragging: boolean;
}

const MuralTooltip = ({ brand, coordinate, position, isDragging }: MuralTooltipProps) => {
  const isInfluencer = brand?.mural_type === "influencers";

  return (
    <AnimatePresence>
      {brand && !isDragging && (
        <motion.div
          className="fixed z-50 pointer-events-none rounded-2xl shadow-2xl overflow-hidden"
          style={{
            left: Math.min(position.x + 16, window.innerWidth - 280),
            top: Math.max(position.y - 10, 60),
            minWidth: 220,
          }}
          initial={{ opacity: 0, scale: 0.88, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: 6 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
        >
          {/* Glass background */}
          <div
            className="absolute inset-0"
            style={{
              background: isInfluencer
                ? "rgba(15, 5, 25, 0.96)"
                : "rgba(5, 10, 8, 0.96)",
              backdropFilter: "blur(20px)",
              borderRadius: "1rem",
              border: `1px solid ${brand.color}25`,
              boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px ${brand.color}15`,
            }}
          />

          {/* Color accent top strip */}
          <div
            className="relative h-1 w-full"
            style={{
              background: `linear-gradient(90deg, ${brand.color}00, ${brand.color}cc, ${brand.color}00)`,
            }}
          />

          <div className="relative px-4 py-3">
            {/* Header */}
            <div className="flex items-start gap-3">
              {/* Logo tile */}
              <div
                className="relative w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${brand.color}dd, ${brand.color}88)`,
                  color: "#fff",
                  boxShadow: `0 4px 16px ${brand.color}50`,
                }}
              >
                {brand.logo}
                {brand.isPerpetual && (
                  <span
                    className="absolute top-0 right-0 w-3 h-3 flex items-center justify-center"
                    style={{ background: "#f59e0b", borderRadius: "0 0 0 6px" }}
                  >
                    <Star className="w-1.5 h-1.5 text-black fill-black" />
                  </span>
                )}
              </div>

              {/* Brand info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-display font-bold text-sm text-white truncate">
                    {brand.name}
                  </span>
                  {isInfluencer && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide"
                      style={{ background: "rgba(217,70,239,0.2)", color: "#d946ef", border: "1px solid rgba(217,70,239,0.3)" }}>
                      ✦ Influencer
                    </span>
                  )}
                  {brand.isPerpetual && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Premium+
                    </span>
                  )}
                </div>
                <div className="text-xs font-medium mt-0.5" style={{ color: `${brand.color}cc` }}>
                  {brand.category}
                </div>
              </div>

              <ExternalLink className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
            </div>

            {/* Stats row */}
            <div className="mt-2.5 flex flex-wrap gap-2">
              {coordinate && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/50 font-mono">
                  📍 {coordinate}
                </div>
              )}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/50">
                <Zap className="w-2.5 h-2.5" />
                {brand.clicks.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/50">
                <span className="text-[8px]">⬡</span>
                {brand.blocks.length} {brand.blocks.length === 1 ? "bloco" : "blocos"}
              </div>
              {(brand.followers_count ?? 0) > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/50">
                  <Users className="w-2.5 h-2.5" />
                  {((brand.followers_count ?? 0) / 1000).toFixed(0)}K
                </div>
              )}
            </div>

            {/* Active campaigns badge */}
            {brand.has_active_campaigns && (
              <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide"
                style={{
                  background: "rgba(34,197,94,0.12)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  color: "#4ade80"
                }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Campanhas ativas
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MuralTooltip;
