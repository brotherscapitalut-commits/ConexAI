import { X, UserPlus, Building2 } from "lucide-react";
import type { MuralInfluencer } from "@/data/influencerMockData";
import type { MuralBrand } from "@/lib/mural/types";

interface InfluencerMatchPanelProps {
  influencer: MuralInfluencer;
  matchingBrands: MuralBrand[];
  onClose: () => void;
}

const InfluencerMatchPanel = ({ influencer, matchingBrands, onClose }: InfluencerMatchPanelProps) => {
  return (
    <div className="fixed top-0 right-0 bottom-0 w-full max-w-sm z-30 flex flex-col bg-background/95 backdrop-blur-xl border-l border-white/10 shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="font-display font-bold text-lg flex items-center gap-2 text-foreground">
          <UserPlus className="w-5 h-5 text-primary" />
          Match com marcas
        </h2>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-display font-bold shrink-0 border-2 border-white/20"
            style={{ backgroundColor: influencer.color, color: "#fff" }}
          >
            {influencer.logo}
          </div>
          <div>
            <h3 className="font-display font-bold text-foreground">{influencer.name}</h3>
            <p className="text-sm text-muted-foreground">{influencer.category}</p>
          </div>
        </div>

        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Marcas compatíveis (gravidade)
        </p>
        {matchingBrands.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma marca no mural com categoria compatível no momento.</p>
        ) : (
          <ul className="space-y-3">
            {matchingBrands.map((brand) => (
              <li key={brand.id} className="relative pl-2 border-l-2 border-dashed border-primary/40" style={{ borderLeftColor: `${influencer.color}80` }}>
                <a
                  href={`/empresa/${brand.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors group -ml-0.5"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ backgroundColor: brand.color, color: "#fff" }}
                  >
                    {brand.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{brand.name}</p>
                    <p className="text-xs text-muted-foreground">{brand.category}</p>
                  </div>
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default InfluencerMatchPanel;
