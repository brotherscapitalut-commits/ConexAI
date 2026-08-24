import { useState, useCallback } from "react";
import MuralCanvas from "@/components/mural/MuralCanvas";
import InfluencerBrandPanel from "@/components/mural/InfluencerBrandPanel";
import InfluencerRankingModal from "@/components/mural/InfluencerRankingModal";
import InfluencerMyCampaignsPanel from "@/components/mural/InfluencerMyCampaignsPanel";
import type { MuralBrand } from "@/lib/mural/types";
import { CATEGORIES } from "@/data/mockData";
import { useProposalBadge } from "@/hooks/useProposalBadge";
import { Search, Trophy, ChevronDown, MessageCircle, Wallet, X } from "lucide-react";
import AIAssistantWidget from "@/components/mural/AIAssistantWidget";
import { Button } from "@/components/ui/button";

const CATEGORY_OPTIONS = ["Todas", ...CATEGORIES];

interface MuralDeMarcasViewProps {
  userId: string;
  /** Voltar ao Nexus (fechar overlay ou sair da vista). */
  onBackToNexus: () => void;
  /** Abrir aba Carteira & Ganhos no Nexus. */
  onOpenGanhos?: () => void;
}

/** Vista fullscreen do mural de marcas para uso no Nexus (overlay) ou em rota. */
export default function MuralDeMarcasView({ userId, onBackToNexus, onOpenGanhos }: MuralDeMarcasViewProps) {
  const [selectedBrand, setSelectedBrand] = useState<MuralBrand | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("Todas");
  const [rankingOpen, setRankingOpen] = useState(false);
  const [myCampaignsOpen, setMyCampaignsOpen] = useState(false);

  const proposalBadgeCount = useProposalBadge(userId, { mode: "influencer" });
  const handleBrandSelect = useCallback((brand: MuralBrand) => setSelectedBrand(brand), []);
  const categoryValue = categoryFilter === "Todas" ? null : categoryFilter;

  return (
    <div className="fixed inset-0 z-[100] h-screen w-screen overflow-hidden bg-[#050505] mural-theme-influencer" data-theme="influencer">
      <MuralCanvas
        theme="influencer"
        onBrandSelect={handleBrandSelect}
        searchHighlight={searchQuery.trim() || null}
        categoryFilter={categoryValue}
      />

      <header className="absolute top-0 left-0 right-0 z-30 flex flex-wrap items-center gap-2 px-4 py-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onBackToNexus}
            className="gap-2 rounded-xl bg-amber-500/20 border-amber-400/30 text-amber-200 hover:bg-amber-500/30"
          >
            <X className="w-4 h-4" />
            Voltar ao Nexus
          </Button>
          {onOpenGanhos && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onOpenGanhos}
              className="gap-2 rounded-xl bg-amber-500/20 border-amber-400/30 text-amber-200 hover:bg-amber-500/30"
            >
              <Wallet className="w-4 h-4" />
              Painel de Ganhos
            </Button>
          )}
        </div>
        <div className="flex-1 max-w-md pointer-events-auto flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/70" />
            <input
              type="text"
              placeholder="Buscar empresas pelo nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-amber-400/20 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-amber-400/20 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 cursor-pointer min-w-[140px]"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 pointer-events-none" />
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMyCampaignsOpen(true)}
            className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-200 font-semibold text-sm hover:bg-amber-500/30 transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            Minhas Campanhas
            {proposalBadgeCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black animate-pulse">
                {proposalBadgeCount > 99 ? "99+" : proposalBadgeCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setRankingOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/30 border border-amber-400/40 text-amber-100 font-semibold text-sm hover:bg-amber-500/40 transition-all"
          >
            <Trophy className="w-4 h-4" />
            Ver Ranking
          </button>
        </div>
      </header>

      <InfluencerRankingModal open={rankingOpen} onClose={() => setRankingOpen(false)} />
      {myCampaignsOpen && <InfluencerMyCampaignsPanel userId={userId} onClose={() => setMyCampaignsOpen(false)} />}

      <AIAssistantWidget onResult={() => {}} className="fixed bottom-6 right-6 z-50" />

      {selectedBrand && (
        <InfluencerBrandPanel
          brand={selectedBrand}
          onClose={() => setSelectedBrand(null)}
          initialOpenProposal={false}
        />
      )}
    </div>
  );
}
