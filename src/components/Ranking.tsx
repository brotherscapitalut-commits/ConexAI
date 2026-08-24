import { useState, useMemo, useEffect } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { MOCK_BRANDS, CATEGORIES, Brand } from "@/data/mockData";
import { MOCK_INFLUENCERS, INFLUENCER_CATEGORIES, getInfluencerRankScore } from "@/data/influencerMockData";
import { useMuralCacheOptional } from "@/context/MuralCacheContext";
import { Trophy, TrendingUp, Award, Search, SlidersHorizontal, Users, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RankingDetailModal from "@/components/ranking/RankingDetailModal";

type SortOption = "clicks" | "blocks" | "name" | "relevance";

const Ranking = () => {
  const [tab, setTab] = useState<"empresas" | "influencers">("empresas");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("blocks");
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const mural = useMuralCacheOptional();

  useEffect(() => {
    if (tab !== "empresas" || !mural?.loadBrands) return;
    void mural.loadBrands({ sortByBids: true });
  }, [tab, mural?.loadBrands]);

  const categories = tab === "empresas" ? CATEGORIES : INFLUENCER_CATEGORIES;
  const items = useMemo(() => {
    if (tab === "empresas" && mural?.brands && mural.brands.length > 0) {
      return mural.brands as unknown as Brand[];
    }
    return tab === "empresas" ? MOCK_BRANDS : MOCK_INFLUENCERS;
  }, [tab, mural?.brands]);

  const filtered = useMemo(() => {
    let result = [...items];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(b =>
        b.name.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
      );
    }

    if (category !== "all") {
      result = result.filter(b => b.category === category);
    }

    result.sort((a, b) => {
      if (tab === "empresas") {
        switch (sortBy) {
          case "blocks": return (b.blocks?.length ?? 0) - (a.blocks?.length ?? 0);
          case "clicks": return (b.clicks ?? 0) - (a.clicks ?? 0);
          case "name": return a.name.localeCompare(b.name);
          default: return (b.blocks?.length ?? 0) - (a.blocks?.length ?? 0);
        }
      }
      switch (sortBy) {
        case "relevance": return getInfluencerRankScore(b as import("@/data/influencerMockData").MuralInfluencer) - getInfluencerRankScore(a as import("@/data/influencerMockData").MuralInfluencer);
        case "clicks": return (b.clicks ?? 0) - (a.clicks ?? 0);
        case "blocks": return (b.blocks?.length ?? 0) - (a.blocks?.length ?? 0);
        case "name": return a.name.localeCompare(b.name);
        default: return getInfluencerRankScore(b as import("@/data/influencerMockData").MuralInfluencer) - getInfluencerRankScore(a as import("@/data/influencerMockData").MuralInfluencer);
      }
    });

    return result;
  }, [items, search, category, sortBy, tab]);

  // Category rankings
  const categoryRankings = useMemo(() => {
    const map = new Map<string, typeof items>();
    categories.forEach(cat => {
      const catItems = items.filter(b => b.category === cat).sort((a, b) => b.clicks - a.clicks);
      if (catItems.length > 0) map.set(cat, catItems);
    });
    return map;
  }, [items, categories]);

  return (
    <section className="min-h-screen bg-background aurora-bg py-12 font-body">
      <div className="w-full px-4 sm:px-6">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">
            <span className="text-gradient">Ranking</span> do Marketplace
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Encontre as melhores empresas e influenciadores. Filtre por categoria, popularidade e mais.
          </p>
        </motion.div>

        <Tabs value={tab} onValueChange={(v) => {
          const newTab = v as "empresas" | "influencers";
          setTab(newTab);
          setCategory("all");
          setSearch("");
          setSortBy(newTab === "empresas" ? "blocks" : "relevance");
        }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <TabsList className="bg-card/60 border border-border/50">
              <TabsTrigger value="empresas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
                <Building2 className="w-4 h-4" />Empresas
              </TabsTrigger>
              <TabsTrigger value="influencers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
                <Users className="w-4 h-4" />Influencers
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 flex-wrap justify-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-9 w-56 text-sm bg-card/60 border-border/50 text-foreground"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-40 h-9 text-sm bg-card/60 border-border/50">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-40 h-9 text-sm bg-card/60 border-border/50">
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tab === "empresas" ? (
                    <>
                      <SelectItem value="blocks">Mais blocos / ativos</SelectItem>
                      <SelectItem value="clicks">Mais cliques</SelectItem>
                      <SelectItem value="name">Nome A-Z</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="relevance">Relevância (igual ao mural)</SelectItem>
                      <SelectItem value="clicks">Mais engajamento</SelectItem>
                      <SelectItem value="name">Nome A-Z</SelectItem>
                      <SelectItem value="blocks">Mais blocos</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ranking alinhado ao mural (dados ao vivo quando disponíveis) */}
          <LayoutGroup id="ranking-list">
            <div className="mb-12 w-full space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">Nenhum resultado encontrado.</div>
            )}
            {filtered.slice(0, 20).map((brand, index) => (
              <motion.div
                key={brand.id}
                layout
                className="group flex cursor-pointer items-center gap-4 rounded-xl border border-primary/20 bg-card/40 backdrop-blur-xl p-4 transition-[transform,box-shadow] duration-300 ease-out hover:scale-[1.02] hover:border-accent/50 hover:shadow-[0_0_25px_hsl(var(--accent)/0.25)]"
                onClick={() => setSelectedBrand(brand)}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 420, damping: 32, delay: index * 0.02 }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-bold text-lg shrink-0"
                  style={{
                    backgroundColor: index === 0 ? "hsl(var(--accent))" : index < 3 ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted))",
                    color: index === 0 ? "hsl(var(--accent-foreground))" : index < 3 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {index + 1}
                </div>

                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ backgroundColor: brand.color, color: "hsl(var(--background))" }}
                >
                  {brand.logo}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold truncate">{brand.name}</div>
                  <div className="text-sm text-muted-foreground">{brand.category}</div>
                </div>

                <div className="hidden sm:flex gap-1">
                  {(brand.badges ?? []).slice(0, 2).map((badge) => (
                    <span key={badge} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {badge}
                    </span>
                  ))}
                </div>

                <div className="text-right shrink-0">
                  <div className="font-display font-bold text-primary">{(brand.clicks ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{tab === "influencers" ? "engajamento" : "cliques"}</div>
                </div>

                <div className="text-right shrink-0 hidden sm:block">
                  <div className="font-display font-semibold text-sm">{brand.blocks?.length ?? 0}</div>
                  <div className="text-xs text-muted-foreground">blocos</div>
                </div>

                <div className="text-muted-foreground group-hover:text-primary transition-colors">
                  {index === 0 ? <Trophy className="w-5 h-5" /> : index < 3 ? <Award className="w-5 h-5" /> : <TrendingUp className="w-4 h-4" />}
                </div>
              </motion.div>
            ))}
            </div>
          </LayoutGroup>

          {/* Category breakdown */}
          {category === "all" && (
            <div>
              <h3 className="text-2xl font-display font-bold mb-6 text-center">
                <span className="text-gradient">Top por Categoria</span>
              </h3>
              <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
                {Array.from(categoryRankings.entries()).map(([catName, catItems]) => (
                  <div key={catName} className="rounded-xl border border-border surface-elevated p-4">
                    <h4 className="font-display font-semibold text-sm mb-3 text-primary">{catName}</h4>
                    <div className="space-y-2">
                      {catItems.slice(0, 3).map((item, idx) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-lg p-1 -m-1 transition-colors"
                          onClick={() => setSelectedBrand(item)}
                        >
                          <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}.</span>
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold shrink-0"
                            style={{ backgroundColor: item.color, color: "#fff" }}
                          >
                            {item.logo}
                          </div>
                          <span className="text-sm flex-1 truncate">{item.name}</span>
                          <span className="text-xs text-muted-foreground">{item.clicks.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Tabs>

        <RankingDetailModal
          brand={selectedBrand}
          onClose={() => setSelectedBrand(null)}
          type={tab}
        />
      </div>
    </section>
  );
};

export default Ranking;
