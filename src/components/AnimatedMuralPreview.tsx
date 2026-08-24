import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = [
  "hsl(200 80% 55%)", "hsl(25 90% 55%)", "hsl(270 60% 55%)", "hsl(150 60% 45%)",
  "hsl(45 90% 55%)", "hsl(0 70% 55%)", "hsl(330 70% 55%)", "hsl(190 80% 50%)",
  "hsl(80 60% 45%)", "hsl(30 85% 55%)", "hsl(240 55% 55%)", "hsl(170 60% 45%)",
  "hsl(350 70% 50%)", "hsl(280 55% 55%)", "hsl(200 70% 50%)",
];

const LOGOS = [
  "TN", "PF", "CS", "DP", "NL", "VA", "CC", "BW", "QL", "SN",
  "IT", "GL", "FL", "ES", "FH", "SB", "FF", "GV", "SZ", "HK",
  "RD", "MC", "LP", "GG", "TW", "WW", "PS", "RF", "PP", "FN",
  "AF", "HS", "SU", "FB", "CM", "PY", "FZ", "FT", "RM", "TM",
];

const COLS = 20;
const ROWS = 10;
const TOTAL = COLS * ROWS;

interface Cell {
  id: number;
  logo: string;
  color: string;
}

const AnimatedMuralPreview = () => {
  const [cells, setCells] = useState<Cell[]>(() =>
    Array.from({ length: TOTAL }, (_, i) => ({
      id: i,
      logo: LOGOS[i % LOGOS.length],
      color: COLORS[i % COLORS.length],
    }))
  );

  // Shuffle some cells every 2s to create movement
  useEffect(() => {
    const interval = setInterval(() => {
      setCells((prev) => {
        const next = [...prev];
        const swapCount = 6 + Math.floor(Math.random() * 8);
        for (let s = 0; s < swapCount; s++) {
          const i = Math.floor(Math.random() * TOTAL);
          const j = Math.floor(Math.random() * TOTAL);
          [next[i], next[j]] = [next[j], next[i]];
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-4xl mx-auto overflow-hidden rounded-2xl border border-border/30">
      {/* Overlay gradient for mystery effect */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-background/60 via-transparent to-transparent" />
      
      <div
        className="grid gap-[2px] p-1"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
        {cells.map((cell, idx) => (
          <motion.div
            key={cell.id}
            layout
            transition={{ type: "spring", stiffness: 150, damping: 20, duration: 0.6 }}
            className="aspect-square rounded-[3px] flex items-center justify-center text-[8px] sm:text-[10px] font-bold select-none"
            style={{
              backgroundColor: cell.color,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            {cell.logo}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AnimatedMuralPreview;
