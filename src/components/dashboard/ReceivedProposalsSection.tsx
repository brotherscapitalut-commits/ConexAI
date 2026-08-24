import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { localDb } from "@/lib/localDbClient";
import { FileText, User, CheckCircle, Loader2, Link2, Package, Send } from "lucide-react";
import DashboardEmptyState from "@/components/dashboard/DashboardEmptyState";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  counter_offer: "Contraproposta",
  accepted: "Aceita",
  under_review: "Em revisão",
  paid: "Paga",
};

interface ProposalRow {
  id: string;
  from_user_id: string;
  influencer_id: string | null;
  to_company_id: string;
  amount: number;
  description: string | null;
  delivery_link: string | null;
  suggested_amount: number | null;
  status: string;
  created_at: string;
  briefing?: string | null;
  influencer_name?: string;
  company_name?: string;
}

export default function ReceivedProposalsSection({
  userId,
  companyIds,
  creditsBalance,
  onRefresh,
}: {
  userId: string;
  companyIds: string[];
  creditsBalance: number;
  onRefresh?: () => void;
}) {
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [suggestedAmounts, setSuggestedAmounts] = useState<Record<string, string>>({});
  const [briefings, setBriefings] = useState<Record<string, string>>({});
  const [suggestingId, setSuggestingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "accepted" | "finalizadas">("all");
  const { toast } = useToast();

  useEffect(() => {
    if (!companyIds.length) {
      setProposals([]);
      setLoading(false);
      return;
    }
    localDb
      .from("partnership_proposals")
      .select("id, from_user_id, influencer_id, to_company_id, amount, description, delivery_link, suggested_amount, status, created_at, briefing")
      .in("to_company_id", companyIds)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const rows = (Array.isArray(data) ? data : data ? [data] : []) as ProposalRow[];
        const userIds = [...new Set(rows.map((r) => r.from_user_id))];
        const infIds = [...new Set(rows.map((r) => r.influencer_id).filter(Boolean))] as string[];
        let names: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profiles } = await localDb.from("profiles").select("user_id, display_name").in("user_id", userIds);
          const arr = Array.isArray(profiles) ? profiles : profiles ? [profiles] : [];
          names = { ...Object.fromEntries(arr.map((p: { user_id: string; display_name?: string }) => [p.user_id, p.display_name || "Influencer"])) };
        }
        if (infIds.length > 0) {
          const { data: infs } = await localDb.from("influencers").select("id, name").in("id", infIds);
          const infArr = Array.isArray(infs) ? infs : infs ? [infs] : [];
          const infNames = Object.fromEntries(infArr.map((i: { id: string; name: string }) => [i.id, i.name]));
          rows.forEach((r) => {
            r.influencer_name = r.influencer_id ? infNames[r.influencer_id] : names[r.from_user_id];
          });
        } else {
          rows.forEach((r) => { r.influencer_name = names[r.from_user_id]; });
        }
        setProposals(rows);
        setLoading(false);
      });
  }, [companyIds.join(","), onRefresh]);

  const handleSuggestAmount = async (proposalId: string) => {
    const val = suggestedAmounts[proposalId]?.replace(",", ".");
    const amount = val ? parseFloat(val) : NaN;
    if (isNaN(amount) || amount < 0) {
      toast({ title: "Informe um valor válido.", variant: "destructive" });
      return;
    }
    const briefingText = (briefings[proposalId] ?? "").trim() || null;
    setSuggestingId(proposalId);
    const payload: Record<string, unknown> = { suggested_amount: amount, updated_at: new Date().toISOString() };
    if (briefingText != null) payload.briefing = briefingText;
    const { error } = await localDb
      .from("partnership_proposals")
      .update(payload)
      .eq("id", proposalId);
    setSuggestingId(null);
    if (error) {
      toast({ title: "Erro ao sugerir valor", description: (error as { message?: string })?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Valor e briefing enviados. O influencer pode enviar uma contraproposta." });
    setProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, suggested_amount: amount } : p)));
    setSuggestedAmounts((prev) => ({ ...prev, [proposalId]: "" }));
    setBriefings((prev) => ({ ...prev, [proposalId]: "" }));
    onRefresh?.();
  };

  const handleAccept = async (proposalId: string) => {
    const proposal = proposals.find((p) => p.id === proposalId);
    if (!proposal || (proposal.status !== "pending" && proposal.status !== "counter_offer")) return;
    if (creditsBalance < proposal.amount) {
      toast({
        title: "Saldo insuficiente",
        description: "Recarregue créditos para influencers para aceitar esta proposta.",
        variant: "destructive",
      });
      return;
    }
    setAcceptingId(proposalId);
    const { data, error } = await localDb.rpc("accept_partnership_proposal", { proposal_id: proposalId });
    setAcceptingId(null);
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      toast({ title: "Erro ao aceitar", description: (result?.error as string) || error?.message || "Tente novamente.", variant: "destructive" });
      return;
    }
    toast({ title: "Proposta aceita!", description: "O valor foi reservado para o influencer. Pagamento garantido pela plataforma." });
    setProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, status: "accepted" } : p)));
    onRefresh?.();
  };

  const handleReleasePayment = async (proposalId: string) => {
    const proposal = proposals.find((p) => p.id === proposalId);
    if (!proposal || proposal.status !== "under_review") return;
    setReleasingId(proposalId);
    const { data, error } = await localDb.rpc("release_proposal_payment", { proposal_id: proposalId });
    setReleasingId(null);
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      toast({ title: "Erro ao liberar", description: (result?.error as string) || error?.message || "Tente novamente.", variant: "destructive" });
      return;
    }
    toast({
      title: "Valor liberado!",
      description: `Influencer creditado (85%). Taxa da plataforma (15%) registrada.`,
    });
    setProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, status: "paid" } : p)));
    onRefresh?.();
  };

  const filteredProposals = useMemo(() => {
    if (filterStatus === "all") return proposals;
    if (filterStatus === "pending") return proposals.filter((p) => p.status === "pending" || p.status === "counter_offer");
    if (filterStatus === "accepted") return proposals.filter((p) => p.status === "accepted");
    if (filterStatus === "finalizadas") return proposals.filter((p) => p.status === "under_review" || p.status === "paid");
    return proposals;
  }, [proposals, filterStatus]);

  const totalAcceptedAmount = useMemo(
    () => proposals.filter((p) => p.status === "accepted").reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [proposals]
  );

  return (
    <section id="propostas-recebidas" className="mb-10">
      <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" />
        Propostas Recebidas
      </h2>
      <Card className="rounded-2xl border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground mb-4">
            Quem entrou em contato, perfil do influencer e valor solicitado. Aceite e garanta o pagamento (o valor é debitado do seu saldo de créditos).
          </p>
          {/* Gestor Financeiro: total em propostas aceitas */}
          {proposals.length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total em propostas aceitas</p>
              <p className="text-xl font-display font-bold text-primary tabular-nums">
                R$ {totalAcceptedAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          )}
          {/* Filtro: Pendentes | Aceitas | Finalizadas */}
          {proposals.length > 0 && (
            <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)} className="mb-4">
              <TabsList className="bg-white/5 border border-white/10">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="pending">Pendentes</TabsTrigger>
                <TabsTrigger value="accepted">Aceitas</TabsTrigger>
                <TabsTrigger value="finalizadas">Finalizadas</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : proposals.length === 0 ? (
            <DashboardEmptyState
              title="Nenhuma proposta recebida ainda"
              description="Quando influenciadores enviarem propostas de parceria, elas aparecerão aqui. Aceite e garanta o pagamento com seu saldo de créditos."
            />
          ) : filteredProposals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma proposta neste filtro.</p>
          ) : (
            <ul className="space-y-4">
              {filteredProposals.map((p) => (
                <li key={p.id} className="p-4 rounded-xl border border-white/10 bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{p.influencer_name || "Influencer"}</p>
                      <p className="text-sm text-primary font-semibold tabular-nums mt-0.5">
                        R$ {Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                      {p.suggested_amount != null && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Valor que você sugeriu: R$ {Number(p.suggested_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      )}
                      {(p.status === "pending" || p.status === "counter_offer") && (
                        <div className="mt-2 space-y-2">
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Regras da Campanha / Briefing</label>
                            <Textarea
                              placeholder="Descreva o que espera: quantidade de stories, tom de voz, prazos..."
                              className="min-h-[80px] text-sm resize-y bg-background/50"
                              value={briefings[p.id] ?? ""}
                              onChange={(e) => setBriefings((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="Valor sugerido (R$)"
                              className="h-8 w-28 text-xs"
                              value={suggestedAmounts[p.id] ?? ""}
                              onChange={(e) => setSuggestedAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            />
                            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => handleSuggestAmount(p.id)} disabled={suggestingId === p.id}>
                              {suggestingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Sugerir valor
                            </Button>
                          </div>
                        </div>
                      )}
                      {(p.status === "under_review" || p.status === "paid") && p.delivery_link && (
                        <a href={p.delivery_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> Link da entrega
                        </a>
                      )}
                      {p.status === "accepted" && !p.delivery_link && (
                        <p className="text-xs text-muted-foreground mt-1">Aguardando o influencer enviar o link da entrega.</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{new Date(p.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full self-start ${
                      p.status === "pending" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" :
                      p.status === "counter_offer" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" :
                      p.status === "accepted" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                      p.status === "under_review" ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" :
                      "bg-primary/20 text-primary"
                    }`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                    {(p.status === "accepted" || p.status === "under_review") && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full self-start bg-slate-500/20 text-slate-700 dark:text-slate-300 border border-slate-400/30">
                        💰 Dinheiro congelado
                      </span>
                    )}
                    {p.status === "paid" && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full self-start bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        ✓ Pago
                      </span>
                    )}
                    {(p.status === "pending" || p.status === "counter_offer") && (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleAccept(p.id)}
                        disabled={acceptingId === p.id || creditsBalance < p.amount}
                      >
                        {acceptingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Aceitar e Garantir Pagamento
                      </Button>
                    )}
                    {p.status === "under_review" && (
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1.5"
                        onClick={() => handleReleasePayment(p.id)}
                        disabled={releasingId === p.id}
                      >
                        {releasingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                        Confirmar Entrega e Liberar Valor
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
