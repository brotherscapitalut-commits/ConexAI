import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MousePointerClick, Grid3X3, ExternalLink, SortAsc, SortDesc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORIES, type Brand } from "@/data/mockData";
import type { MuralBrand } from "@/lib/mural/types";

interface BrandDirectoryProps {
  brands: MuralBrand[];
  open: boolean;
  onClose: () => void;
  onFocusBrand: (name: string) => void;
}

type SortKey = "name" | "clicks" | "blocks";

const BrandDirectory = ({ brands, open, onClose, onFocusBrand }: BrandDirectoryProps) => {
  const [category, setCategory] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let result = brands;
    if (category) {
      result = result.filter(b => b.category === category);
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "clicks") cmp = a.clicks - b.clicks;
      else if (sortKey === "blocks") cmp = a.blocks.length - b.blocks.length;
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [brands, category, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl overflow-y-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
    >
      <div className="w-full px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-display font-bold">Diretório de Marcas</h1>
            <span className="text-sm text-muted-foreground">({filtered.length} marcas)</span>
          </div>
        </div>

        {/* Filtros — busca única fica na barra do topo do mural */}
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={category === null ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(null)}
            >
              Todas
            </Button>
            {CATEGORIES.map(cat => (
              <Button
                key={cat}
                variant={category === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setCategory(category === cat ? null : cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Sort controls */}
        <div className="flex gap-2 mb-4">
          {(["clicks", "blocks", "name"] as SortKey[]).map(key => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                sortKey === key ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {key === "clicks" ? "Cliques" : key === "blocks" ? "Blocos" : "Nome"}
              {sortKey === key && (sortAsc ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
            </button>
          ))}
        </div>

        {/* Brand grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(brand => (
            <motion.div
              key={brand.id}
              className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all cursor-pointer group"
              onClick={() => { onFocusBrand(brand.name); onClose(); }}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: brand.color, color: "#fff" }}
                >
                  {brand.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-sm truncate">{brand.name}</div>
                  <div className="text-xs text-muted-foreground">{brand.category}</div>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{brand.clicks.toLocaleString()}</span>
                <span className="flex items-center gap-1"><Grid3X3 className="w-3 h-3" />{brand.blocks.length} blocos</span>
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            Nenhuma marca encontrada.
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default BrandDirectory;
