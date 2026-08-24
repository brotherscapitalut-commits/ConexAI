import { useState, useCallback, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import MuralCanvas from "@/components/mural/MuralCanvas";
import { loadBrands } from "@/lib/mural/MuralDataLoader";
import InfluencerBrandPanel from "@/components/mural/InfluencerBrandPanel";
import InfluencerRankingModal from "@/components/mural/InfluencerRankingModal";
import InfluencerMyCampaignsPanel from "@/components/mural/InfluencerMyCampaignsPanel";
import type { MuralBrand } from "@/lib/mural/types";
import { CATEGORIES } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";
import { useProposalBadge } from "@/hooks/useProposalBadge";
import { ArrowLeft, BarChart3, Search, Trophy, ChevronDown, MessageCircle, Wallet, Heart } from "lucide-react";
import AIAssistantWidget from "@/components/mural/AIAssistantWidget";

const CATEGORY_OPTIONS = ["Todas", ...CATEGORIES];

/** Portal do Influenciador: mural imersivo com tema roxo, filtros, busca e painel de ganhos. */
export default function InfluencerMural() {
  const navigate = useNavigate();
  const [selectedBrand, setSelectedBrand] = useState<MuralBrand | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("Todas");
  const [rankingOpen, setRankingOpen] = useState(false);
  const [myCampaignsOpen, setMyCampaignsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [savedByCount, setSavedByCount] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const proposalBrandId = searchParams.get("proposal");

  useEffect(() => {
    if (!proposalBrandId) return;
    loadBrands().then((data) => {
      const brand = data?.find((b) => b.id === proposalBrandId);
      if (brand) setSelectedBrand(brand);
    });
  }, [proposalBrandId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: myInfluencers } = await supabase.from("influencers").select("id").eq("owner_id", userId);
      const ids = (myInfluencers ?? []).map((i) => i.id);
      if (ids.length === 0) {
        setSavedByCount(0);
        return;
      }
      const { count } = await supabase.from("favorite_influencers").select("*", { count: "exact", head: true }).in("influencer_id", ids);
      setSavedByCount(count ?? 0);
    })();
  }, [userId]);

  const proposalBadgeCount = useProposalBadge(userId, { mode: "influencer" });

  const handleBrandSelect = useCallback((brand: MuralBrand) => {
    setSelectedBrand(brand);
  }, []);

  const categoryValue = categoryFilter === "Todas" ? null : categoryFilter;

  return (
    <div className="h-screen w-screen overflow-hidden relative mural-theme-influencer" data-theme="influencer">
      <MuralCanvas
        theme="influencer"
        onBrandSelect={handleBrandSelect}
        searchHighlight={searchQuery.trim() || null}
        categoryFilter={categoryValue}
      />

      {/* Barra superior: Voltar + Busca + Categorias + Ver Ranking */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 py-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/dashboard/influencer"); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 text-white font-medium text-sm shadow-lg shadow-fuchsia-500/20 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <Link
            to="/dashboard/influencer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300 font-medium text-sm hover:bg-fuchsia-500/20 transition-all"
          >
            Meu painel
          </Link>
          <Link
            to="/dashboard/influencer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-300 font-medium text-sm hover:bg-fuchsia-500/30 transition-all"
          >
            <Wallet className="w-4 h-4" />
            Minha Carteira
          </Link>
        </div>

        <div className="flex-1 max-w-md pointer-events-auto flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fuchsia-400/70" />
            <input
              type="text"
              placeholder="Buscar empresas pelo nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-background/90 backdrop-blur-md border border-fuchsia-500/20 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
            />
          </div>
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-background/90 backdrop-blur-md border border-fuchsia-500/20 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 cursor-pointer min-w-[140px]"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-fuchsia-400 pointer-events-none" />
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMyCampaignsOpen(true)}
            className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300 font-semibold text-sm hover:bg-fuchsia-500/30 transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            Minhas Campanhas
            {proposalBadgeCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-fuchsia-500 text-[10px] font-bold text-white shadow-lg shadow-fuchsia-500/50 animate-pulse">
                {proposalBadgeCount > 99 ? "99+" : proposalBadgeCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setRankingOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-fuchsia-500/20 transition-all"
          >
            <Trophy className="w-4 h-4" />
            Ver Ranking
          </button>
          {savedByCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 backdrop-blur-md border border-rose-500/30 text-[11px] font-medium text-rose-300" title="Empresas que te salvaram nos favoritos">
              <Heart className="w-3.5 h-3.5 fill-rose-400" />
              Salvo por {savedByCount} empresa{savedByCount !== 1 ? "s" : ""}
            </div>
          )}
          <div className="px-3 py-1.5 rounded-full bg-fuchsia-500/10 backdrop-blur-md border border-fuchsia-500/20 text-[10px] font-display font-semibold text-fuchsia-400">
            ✦ Modo Influenciador
          </div>
        </div>
      </header>

      <InfluencerRankingModal open={rankingOpen} onClose={() => setRankingOpen(false)} />
      {myCampaignsOpen && userId && <InfluencerMyCampaignsPanel userId={userId} onClose={() => setMyCampaignsOpen(false)} />}
      {myCampaignsOpen && !userId && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50" onClick={() => setMyCampaignsOpen(false)}>
          <div className="bg-background/95 rounded-2xl p-6 max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-muted-foreground">Faça login para ver suas campanhas.</p>
            <Link to="/auth" className="inline-block mt-3 text-fuchsia-400 font-medium">Entrar</Link>
          </div>
        </div>
      )}

      {/* Botão flutuante: Painel de Ganhos (canto inferior esquerdo) */}
      <div className="absolute bottom-6 left-6 z-[50]">
        <Link
          to="/dashboard/influencer"
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-fuchsia-500/25 transition-all hover:scale-105"
        >
          <BarChart3 className="w-5 h-5" />
          Painel de Ganhos
        </Link>
      </div>

      <AIAssistantWidget onResult={() => {}} className="fixed bottom-6 right-6 z-50" />

      {selectedBrand && (
        <InfluencerBrandPanel
          brand={selectedBrand}
          onClose={() => {
            setSelectedBrand(null);
            if (proposalBrandId) setSearchParams({}, { replace: true });
          }}
          initialOpenProposal={proposalBrandId === selectedBrand.id}
        />
      )}
    </div>
  );
}
