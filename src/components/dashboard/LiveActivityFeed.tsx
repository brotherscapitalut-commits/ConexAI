import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

const API = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:3001";

const MOCK_NAMES = [
  "TechBrasil", "Inova Digital", "Marca & Cia", "Startup Plus", "Elite Mídia",
  "Conecta Lab", "Growth Agency", "Pulse Brands", "Nexus Corp", "Flow Studio",
];

const REGIONS: Record<string, string> = {
  borda: "Borda",
  intermediaria: "Intermediária",
  centro_premium: "Centro",
};

function useActivityFeed() {
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${API}/api/activity-feed`);
        const json = (await res.json()) as { data?: { type: string; company_name?: string; blocks_count?: number; region?: string; percent_available?: number; count?: number }[] };
        const data = json?.data ?? [];
        if (cancelled) return;

        const phrases: string[] = [];
        data.forEach((a) => {
          if (a.type === "block_reservation" && a.company_name && a.blocks_count != null) {
            const region = REGIONS[a.region || ""] || a.region || "mural";
            phrases.push(`${a.company_name} acabou de reservar ${a.blocks_count} bloco(s) no ${region}!`);
          } else if (a.type === "new_member" && (a.count ?? 0) > 0) {
            phrases.push("Novo(s) membro(s) acabaram de entrar para o time de anunciantes VIP!");
          } else if (a.type === "region_availability" && a.region && a.percent_available != null) {
            phrases.push(`Apenas ${a.percent_available}% dos blocos da Região ${a.region} ainda estão disponíveis!`);
          }
        });

        if (phrases.length > 0) {
          setItems(phrases);
        } else {
          const mocks: string[] = [
            `${MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)]} acabou de reservar ${Math.floor(Math.random() * 8) + 4} blocos no Centro!`,
            "Novo membro acaba de entrar para o time de anunciantes VIP!",
            `Apenas ${Math.floor(Math.random() * 20) + 10}% dos blocos da Região Borda ainda estão disponíveis!`,
            `${MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)]} acabou de reservar 12 blocos no Centro!`,
          ];
          setItems(mocks);
        }
      } catch (_) {
        const mocks: string[] = [
          `${MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)]} acabou de reservar ${Math.floor(Math.random() * 10) + 2} blocos no Centro!`,
          "Novo membro acaba de entrar para o time de anunciantes VIP!",
          "Apenas 15% dos blocos da Região Borda ainda estão disponíveis!",
        ];
        setItems(mocks);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { items, loading };
}

interface LiveActivityFeedProps {
  className?: string;
  maxItems?: number;
}

export default function LiveActivityFeed({ className = "", maxItems = 4 }: LiveActivityFeedProps) {
  const { items, loading } = useActivityFeed();
  const [index, setIndex] = useState(0);
  const display = items.slice(0, maxItems);

  useEffect(() => {
    if (display.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % display.length);
    }, 5000);
    return () => clearInterval(t);
  }, [display.length]);

  if (loading || display.length === 0) {
    return (
      <div className={`rounded-xl border border-white/10 bg-white/5 p-3 ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Zap className="w-4 h-4 text-primary" />
          <span>Atividade ao vivo...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 p-3 overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-medium text-muted-foreground">Atividade ao vivo</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="text-sm text-foreground/95 leading-snug"
        >
          {display[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
