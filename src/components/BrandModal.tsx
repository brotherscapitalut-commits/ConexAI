import { Brand } from "@/data/mockData";
import { ExternalLink, X, MousePointerClick, Grid3X3, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

interface BrandModalProps {
  brand: Brand | null;
  /** Clicked block coordinate, e.g. "F12" */
  blockCoord?: string | null;
  /** Full territory range if multiple blocks, e.g. "F12 – F15" */
  territoryRange?: string | null;
  onClose: () => void;
  onMakeOffer?: () => void;
}

const BrandModal = ({ brand, blockCoord, territoryRange, onClose, onMakeOffer }: BrandModalProps) => {
  if (!brand) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative w-[90vw] max-w-sm rounded-2xl border border-border bg-popover p-6 shadow-2xl"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-xl font-bold shadow-lg"
              style={{ backgroundColor: brand.color, color: "#fff" }}
            >
              {brand.logo}
            </div>

            <div className="text-center">
              <h2 className="font-display font-bold text-lg">{brand.name}</h2>
              <p className="text-sm text-muted-foreground">{brand.category}</p>
            </div>

            {(blockCoord ?? territoryRange) && (
              <div className="text-sm text-muted-foreground tabular-nums">
                {territoryRange && territoryRange !== blockCoord ? (
                  <span>Territory: {territoryRange}</span>
                ) : (
                  <span>Block: {blockCoord ?? territoryRange}</span>
                )}
              </div>
            )}

            {brand.badges.length > 0 && (
              <div className="flex gap-1.5 flex-wrap justify-center">
                {brand.badges.map((badge) => (
                  <span
                    key={badge}
                    className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <MousePointerClick className="w-4 h-4" />
                <span>{brand.clicks.toLocaleString()} cliques</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Grid3X3 className="w-4 h-4" />
                <span>{brand.blocks.length} blocos</span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2">
              <a
                href={brand.website}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-display font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Visitar site
                <ExternalLink className="w-4 h-4" />
              </a>
              {onMakeOffer && (
                <button
                  type="button"
                  onClick={onMakeOffer}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-display font-semibold hover:bg-muted transition-colors"
                >
                  Make Offer
                </button>
              )}
            </div>

            {/* Link to public profile if it's a real DB entity */}
            {brand.id && !brand.id.startsWith("brand-") && !brand.id.startsWith("influencer-") && (
              <Link
                to={`/empresa/${brand.id}`}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-display font-semibold hover:bg-muted transition-colors"
              >
                Ver perfil completo
                <User className="w-4 h-4" />
              </Link>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BrandModal;
