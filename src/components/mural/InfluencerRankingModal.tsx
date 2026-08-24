import { useState, useEffect } from "react";
import { X, Trophy, Handshake, MousePointerClick } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { localDb } from "@/lib/localDbClient";

/** Ranking de Elite: por parcerias fechadas e engajamento (cliques), não por ganhos monetários por clique */
const MOCK_ELITE = [
  { display_name: "Ana Digital", partnerships: 12, engagement_clicks: 840 },
  { display_name: "TechLifestyle", partnerships: 10, engagement_clicks: 720 },
  { display_name: "Moda & Cia", partnerships: 9, engagement_clicks: 610 },
  { display_name: "Fitness Pro", partnerships: 8, engagement_clicks: 580 },
  { display_name: "Beleza Tips", partnerships: 7, engagement_clicks: 420 },
  { display_name: "Viagens BR", partnerships: 6, engagement_clicks: 390 },
  { display_name: "Gastronomia", partnerships: 5, engagement_clicks: 340 },
  { display_name: "Edu Tech", partnerships: 4, engagement_clicks: 280 },
  { display_name: "Gamer Zone", partnerships: 3, engagement_clicks: 250 },
  { display_name: "Crypto Insider", partnerships: 2, engagement_clicks: 120 },
];

interface RankingRow {
  user_id: string | null;
  display_name: string;
  partnerships: number;
  engagement_clicks: number;
}

interface InfluencerRankingModalProps {
  open: boolean;
  onClose: () => void;
}

export default function InfluencerRankingModal({ open, onClose }: InfluencerRankingModalProps) {
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [useMock, setUseMock] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setUseMock(false);
    (async () => {
      try {
        // `localDb`, não `supabase`: este arquivo nunca importou `supabase`, e
        // todas as outras consultas aqui já usam `localDb`. Era um
        // ReferenceError garantido ao abrir o modal de ranking.
        const { data: paid } = await localDb
          .from("partnership_proposals")
          .select("from_user_id")
          .eq("status", "paid");
        const countByUser = new Map<string, number>();
        for (const row of paid ?? []) {
          const uid = (row as { from_user_id: string }).from_user_id;
          if (uid) countByUser.set(uid, (countByUser.get(uid) ?? 0) + 1);
        }
        const userIds = Array.from(countByUser.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([id]) => id);
        if (userIds.length === 0) {
          setRows(MOCK_ELITE.map((m) => ({ user_id: null, display_name: m.display_name, partnerships: m.partnerships, engagement_clicks: m.engagement_clicks })));
          setUseMock(true);
          setLoading(false);
          return;
        }
        const { data: inf } = await localDb.from("influencers").select("id, name, owner_id").in("owner_id", userIds);
        const nameByOwner = new Map<string, string>();
        for (const i of inf ?? []) {
          nameByOwner.set((i as { owner_id: string }).owner_id, (i as { name: string }).name ?? "Influencer");
        }
        const engagementByUser = new Map<string, number>();
        const { data: interactions } = await localDb.from("interactions").select("user_id").in("user_id", userIds);
        for (const row of interactions ?? []) {
          const uid = (row as { user_id: string }).user_id;
          if (uid) engagementByUser.set(uid, (engagementByUser.get(uid) ?? 0) + 1);
        }
        const list: RankingRow[] = userIds.map((uid) => ({
          user_id: uid,
          display_name: nameByOwner.get(uid) ?? "Influencer",
          partnerships: countByUser.get(uid) ?? 0,
          engagement_clicks: engagementByUser.get(uid) ?? 0,
        }));
        setRows(list);
      } catch {
        setRows(MOCK_ELITE.map((m) => ({ user_id: null, display_name: m.display_name, partnerships: m.partnerships, engagement_clicks: m.engagement_clicks })));
        setUseMock(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const list = rows.length > 0 ? rows : MOCK_ELITE.map((m) => ({ user_id: null, display_name: m.display_name, partnerships: m.partnerships, engagement_clicks: m.engagement_clicks }));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[101] rounded-2xl border border-fuchsia-500/30 bg-background/95 backdrop-blur-xl shadow-2xl shadow-fuchsia-500/10 overflow-hidden"
          >
            <div className="p-4 border-b border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-500/10 to-purple-500/10 flex items-center justify-between">
              <h2 className="font-display font-bold text-lg flex items-center gap-2 text-fuchsia-300">
                <Trophy className="w-5 h-5 text-amber-400" />
                Ranking de Elite
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="px-4 pt-2 text-xs text-muted-foreground">
              Top 10 por parcerias fechadas e cliques de engajamento (exposição da marca).
            </p>
            {loading ? (
              <div className="p-8 flex justify-center">
                <div className="w-8 h-8 border-2 border-fuchsia-500/30 border-t-fuchsia-400 rounded-full animate-spin" />
              </div>
            ) : (
              <ul className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
                {list.map((item, idx) => (
                  <li
                    key={item.user_id ?? idx}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-fuchsia-500/10 hover:border-fuchsia-500/20 transition-colors"
                  >
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                        idx < 3
                          ? "bg-gradient-to-br from-amber-500/30 to-amber-600/20 text-amber-300"
                          : "bg-fuchsia-500/20 text-fuchsia-300"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{item.display_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-0.5">
                          <Handshake className="w-3 h-3" />
                          {item.partnerships} parcerias
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MousePointerClick className="w-3 h-3" />
                          {item.engagement_clicks} cliques
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {useMock && !loading && (
              <p className="px-4 pb-4 text-xs text-muted-foreground text-center">
                Dados de exemplo. O ranking é preenchido com parcerias fechadas e engajamento real.
              </p>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
