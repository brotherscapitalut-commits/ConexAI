import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { localDb } from "@/lib/localDbClient";
import { Gavel, CheckCircle, XCircle, Loader2, Building2 } from "lucide-react";

const API = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:3001";
function getAuthHeader(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("local_db_token");
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

interface BidRow {
  id: string;
  from_company_id: string;
  to_brand_id: string;
  amount: number;
  status: string;
  created_at: string;
  from_company_name?: string;
  to_brand_name?: string;
}

const formatMoney = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export default function PositionBidsSection({
  companyIds,
  onRefresh,
}: {
  companyIds: string[];
  onRefresh?: () => void;
}) {
  const [bids, setBids] = useState<BidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!companyIds.length) {
      setBids([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    
    // Fetch RECEIVED bids (sent to user's brands)
    // Fetch SENT bids (sent from user's brands to others)
    Promise.all([
      localDb.from("position_bids" as any).select("id, from_company_id, to_brand_id, amount, status, created_at").in("to_brand_id", companyIds),
      localDb.from("position_bids" as any).select("id, from_company_id, to_brand_id, amount, status, created_at").in("from_company_id", companyIds)
    ]).then(async ([receivedRes, sentRes]) => {
      const received = (receivedRes.data ?? []) as BidRow[];
      const sent = (sentRes.data ?? []) as BidRow[];
      const allRows = [...received, ...sent];
      
      const fromIds = [...new Set(allRows.map((r) => r.from_company_id))];
      const toIds = [...new Set(allRows.map((r) => r.to_brand_id))];
      const allIds = [...new Set([...fromIds, ...toIds])];
      
      let names: Record<string, string> = {};
      if (allIds.length > 0) {
        const { data: comps } = await localDb.from("companies").select("id, name").in("id", allIds);
        names = Object.fromEntries((Array.isArray(comps) ? comps : []).map((c: { id: string; name: string }) => [c.id, c.name]));
      }
      
      allRows.forEach((r) => {
        r.from_company_name = names[r.from_company_id];
        r.to_brand_name = names[r.to_brand_id];
      });
      
      // Sort combined by date
      allRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setBids(allRows);
      setLoading(false);
    });
  }, [companyIds.join(","), onRefresh]);

  const handleAccept = async (bidId: string) => {
    const bid = bids.find((b) => b.id === bidId);
    if (!bid || bid.status !== "pending") return;
    setAcceptingId(bidId);
    const { data, error } = await localDb.rpc("accept_position_bid", { bid_id: bidId });
    setAcceptingId(null);
    const result = data as { ok?: boolean; error?: string; seller_share?: number } | null;
    if (error || !result?.ok) {
      toast({
        title: "Erro ao aceitar",
        description: (result?.error as string) || (error as { message?: string })?.message || "Tente novamente.",
        variant: "destructive",
      });
      return;
    }
    if (result?.seller_share != null && bid.to_brand_id) {
      fetch(`${API}/api/notify-bid-accepted`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ to_brand_id: bid.to_brand_id, valor_creditado: result.seller_share }),
      }).catch(() => {});
    }
    toast({
      title: "Lance aceito!",
      description: "A posição foi transferida e o valor creditado.",
    });
    setBids((prev) => prev.map((b) => (b.id === bidId ? { ...b, status: "accepted" } : b)));
    onRefresh?.();
  };

  const handleReject = async (bidId: string) => {
    setRejectingId(bidId);
    const { error } = await localDb.from("position_bids" as any).update({ status: "rejected" }).eq("id", bidId);
    setRejectingId(null);
    if (error) {
      toast({ title: "Erro ao recusar", description: (error as { message?: string })?.message ?? "Erro ao recusar", variant: "destructive" });
      return;
    }
    toast({ title: "Lance recusado." });
    setBids((prev) => prev.map((b) => (b.id === bidId ? { ...b, status: "rejected" } : b)));
    onRefresh?.();
  };

  const receivedBids = bids.filter((b) => companyIds.includes(b.to_brand_id));
  const sentBids = bids.filter((b) => companyIds.includes(b.from_company_id));

  return (
    <section id="mercado-posicoes" className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
          <Gavel className="w-5 h-5 text-primary" />
          Mercado de Posições
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RECEIVED BIDS */}
        <Card className="rounded-2xl border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-white/[0.02]">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500" /> Ofertas Recebidas
            </h3>
          </div>
          <CardContent className="p-5 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : receivedBids.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma oferta recebida ainda.</p>
            ) : (
              <ul className="space-y-3">
                {receivedBids.map((b) => (
                  <li
                    key={b.id}
                    className="p-4 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm text-foreground">{b.from_company_name ?? "Empresa"}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Para sua marca: <span className="text-white">{b.to_brand_name}</span>
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          b.status === "pending"
                            ? "bg-amber-500/20 text-amber-400"
                            : b.status === "accepted"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {b.status === "pending" ? "Pendente" : b.status === "accepted" ? "Aceito" : "Recusado"}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                       <span className="text-lg font-display font-black text-white tabular-nums">
                         {formatMoney(b.amount * 0.7)}
                       </span>
                       <span className="text-[10px] text-muted-foreground">líquido para aceitar</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Oferta bruta {formatMoney(b.amount)} · ConeXai retém 30% se a negociação fechar.
                    </p>

                    {b.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 h-8 text-[11px] border border-white/10 hover:bg-red-500/10 hover:text-red-400"
                          onClick={() => handleReject(b.id)}
                          disabled={rejectingId === b.id}
                        >
                          Recusar
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-[11px]"
                          onClick={() => handleAccept(b.id)}
                          disabled={acceptingId === b.id}
                        >
                          Aceitar
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* SENT BIDS */}
        <Card className="rounded-2xl border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-white/[0.02]">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Gavel className="w-4 h-4 text-fuchsia-500" /> Minhas Propostas Enviadas
            </h3>
          </div>
          <CardContent className="p-5 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : sentBids.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Você ainda não enviou propostas por posições.</p>
            ) : (
              <ul className="space-y-3">
                {sentBids.map((b) => (
                  <li
                    key={b.id}
                    className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                         <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Destino</p>
                         <p className="font-bold text-sm text-white">{b.to_brand_name ?? "—"}</p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          b.status === "pending"
                            ? "bg-zinc-500/20 text-zinc-400"
                            : b.status === "accepted"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {b.status === "pending" ? "Aguardando" : b.status === "accepted" ? "Concluído" : "Não Aceito"}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                       <p className="text-lg font-display font-black text-primary">
                         {formatMoney(b.amount)}
                       </p>
                       <p className="text-[10px] text-muted-foreground">
                         {new Date(b.created_at).toLocaleDateString("pt-BR")}
                       </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
