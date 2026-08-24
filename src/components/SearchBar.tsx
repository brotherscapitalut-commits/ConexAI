import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MOCK_BRANDS, CATEGORIES } from "@/data/mockData";
import { motion, AnimatePresence } from "framer-motion";

interface SearchBarProps {
  onSearch: (query: string) => void;
}

const SearchBar = ({ onSearch }: SearchBarProps) => {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const results = query.length > 0
    ? MOCK_BRANDS.filter(
        (b) =>
          b.name.toLowerCase().includes(query.toLowerCase()) ||
          b.category.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleChange = (value: string) => {
    setQuery(value);
    setShowResults(value.length > 0);
    onSearch(value);
  };

  const clear = () => {
    setQuery("");
    setShowResults(false);
    onSearch("");
  };

  return (
    <section className="py-12">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              className="pl-12 pr-10 py-6 text-lg rounded-xl surface-elevated border-border focus:border-primary"
              placeholder="Buscar empresa ou categoria..."
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={() => query.length > 0 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
            />
            {query && (
              <button onClick={clear} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {CATEGORIES.slice(0, 6).map((cat) => (
              <button
                key={cat}
                onClick={() => handleChange(cat)}
                className="px-3 py-1.5 rounded-full text-sm border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results dropdown */}
          <AnimatePresence>
            {showResults && results.length > 0 && (
              <motion.div
                className="absolute z-40 top-full mt-2 w-full rounded-xl border border-border surface-elevated shadow-2xl overflow-hidden"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {results.map((brand) => (
                  <button
                    key={brand.id}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                    onClick={() => {
                      handleChange(brand.name);
                      setShowResults(false);
                      // Scroll to mural
                      document.getElementById("mural")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: brand.color, color: "hsl(var(--background))" }}
                    >
                      {brand.logo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{brand.name}</div>
                      <div className="text-xs text-muted-foreground">{brand.category}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{brand.clicks.toLocaleString()} cliques</div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default SearchBar;
