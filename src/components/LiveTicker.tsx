import { motion } from "framer-motion";
import { MOCK_BRANDS } from "@/data/mockData";
import { TrendingUp } from "lucide-react";

const LiveTicker = () => {
  const topBrands = [...MOCK_BRANDS].sort((a, b) => b.clicks - a.clicks).slice(0, 12);

  return (
    <section className="py-4 overflow-hidden border-y border-border/50 bg-primary/5">
      <div className="flex items-center gap-3 px-6 mb-2">
        <TrendingUp className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-display font-semibold text-primary uppercase tracking-wider">Mais clicadas agora</span>
      </div>
      <div className="relative overflow-hidden">
        <motion.div
          className="flex gap-6 whitespace-nowrap"
          animate={{ x: [0, -1200] }}
          transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
        >
          {[...topBrands, ...topBrands].map((brand, i) => (
            <div key={`${brand.id}-${i}`} className="flex items-center gap-2 shrink-0">
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold"
                style={{ backgroundColor: brand.color, color: "#fff" }}
              >
                {brand.logo}
              </div>
              <span className="text-sm font-medium">{brand.name}</span>
              <span className="text-xs text-primary font-display font-bold">{brand.clicks.toLocaleString()}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default LiveTicker;
