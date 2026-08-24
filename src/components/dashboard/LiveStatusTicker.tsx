import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:3001";

/** 50 nomes para eventos simulados — nunca parecer repetitivo */
const MOCK_COMPANY_NAMES = [
  "TechBrasil", "Inova Digital", "Marca & Cia", "Startup Plus", "Elite Mídia",
  "Conecta Lab", "Growth Agency", "Pulse Brands", "Nexus Corp", "Flow Studio",
  "Solar Ventures", "Águia Capital", "Nuvem Criativa", "Raio Labs", "Horizonte Co",
  "Ponto Final", "Casa Verde", "Alta Moda", "Sabor & Arte", "Foco Total",
  "Vereda Digital", "Estúdio 9", "Conexão Brasil", "Mosaico", "Prisma",
  "Ícone Mídia", "Fênix Agency", "Luz & Cores", "Pé na Estrada", "Vento Norte",
  "Serra Alta", "Maré Alta", "Céu Aberto", "Raiz Forte", "Ponta Seca",
  "Brilho Sul", "Onda Nova", "Lua Cheia", "Sol Nascente", "Estrela do Dia",
  "Caminho Certo", "Porta Aberta", "Janela Criativa", "Rumo Certo", "Alvo Certo",
  "Frase & Gesto", "Ideia Viva", "Papo Reto", "Mão na Massa", "Pé no Chão",
];

const REGION_LABELS: Record<string, string> = {
  borda: "Borda",
  intermediaria: "Intermediária",
  centro_premium: "Centro",
};

type Activity =
  | { type: "vip_center"; company_name: string; region?: string; blocks_count?: number }
  | { type: "new_member"; company_name: string }
  | { type: "region_availability"; region: string; percent_available?: number }
  | { type: "position_sold" };

function buildPhrase(a: Activity, fallbackName: string): string {
  const name = ("company_name" in a && a.company_name) ? a.company_name : fallbackName;
  switch (a.type) {
    case "vip_center":
      return `🔥 ${name} acaba de garantir um espaço VIP no centro!`;
    case "new_member":
      return `🚀 Mais um parceiro se uniu ao time! Bem-vinda, ${name}!`;
    case "region_availability":
      return `⏳ Restam poucos blocos na Região ${a.region}. Garanta o seu!`;
    case "position_sold":
      return "💰 Alguém acaba de lucrar vendendo sua posição no mural!";
    default:
      return `🔥 ${name} acaba de garantir um espaço VIP no centro!`;
  }
}

function useStatusTicker() {
  const [phrases, setPhrases] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const shuffle = <T,>(arr: T[]): T[] => arr.slice().sort(() => Math.random() - 0.5);

    const load = async () => {
      try {
        const res = await fetch(`${API}/api/activity-feed`);
        const json = (await res.json()) as { data?: Activity[] };
        const data = json?.data ?? [];
        if (cancelled) return;

        const realPhrases = data.map((a) => buildPhrase(a, MOCK_COMPANY_NAMES[0]));

        if (realPhrases.length > 0) {
          setPhrases(shuffle(realPhrases));
        } else {
          const names = shuffle(MOCK_COMPANY_NAMES);
          const simulated: string[] = [
            `🔥 ${names[0]} acaba de garantir um espaço VIP no centro!`,
            `🚀 Mais um parceiro se uniu ao time! Bem-vinda, ${names[1]}!`,
            "⏳ Restam poucos blocos na Região Borda. Garanta o seu!",
            "💰 Alguém acaba de lucrar vendendo sua posição no mural!",
            `🔥 ${names[2]} acaba de garantir um espaço VIP no centro!`,
            `🚀 Mais um parceiro se uniu ao time! Bem-vinda, ${names[3]}!`,
            `⏳ Restam poucos blocos na Região ${["Borda", "Intermediária", "Centro"][Math.floor(Math.random() * 3)]}. Garanta o seu!`,
          ];
          setPhrases(simulated);
        }
      } catch (_) {
        const names = shuffle(MOCK_COMPANY_NAMES);
        setPhrases([
          `🔥 ${names[0]} acaba de garantir um espaço VIP no centro!`,
          `🚀 Mais um parceiro se uniu ao time! Bem-vinda, ${names[1]}!`,
          "⏳ Restam poucos blocos na Região Borda. Garanta o seu!",
          "💰 Alguém acaba de lucrar vendendo sua posição no mural!",
        ]);
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

  return { phrases, loading };
}

interface LiveStatusTickerProps {
  className?: string;
  maxItems?: number;
  rotationIntervalMs?: number;
}

export default function LiveStatusTicker({
  className = "",
  maxItems = 6,
  rotationIntervalMs = 4500,
}: LiveStatusTickerProps) {
  const { phrases, loading } = useStatusTicker();
  const [index, setIndex] = useState(0);
  const display = useMemo(() => phrases.slice(0, maxItems), [phrases, maxItems]);
  const displayRef = useRef(display);
  displayRef.current = display;

  useEffect(() => {
    if (display.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => {
        const d = displayRef.current;
        if (d.length <= 1) return i;
        let next = (i + 1) % d.length;
        while (d[next] === d[i]) {
          next = (next + 1) % d.length;
          if (next === i) break;
        }
        return next;
      });
    }, rotationIntervalMs);
    return () => clearInterval(t);
  }, [display.length, rotationIntervalMs]);

  if (loading || display.length === 0) {
    return (
      <div className={`rounded-xl border border-white/10 bg-white/5 p-3 ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <span className="animate-pulse">Sempre vivo...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 p-3 overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-medium text-muted-foreground">Ao vivo</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="text-sm text-foreground/95 leading-snug"
        >
          {display[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
