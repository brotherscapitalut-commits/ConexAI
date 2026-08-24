import { useState, useEffect } from "react";
import { X, FileText, Clock, CheckCircle, DollarSign, Send, Loader2, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  counter_offer: "Contraproposta",
  accepted: "Aceita",
  under_review: "Em revisão",
  paid: "Paga",
};

interface ProposalRow {
  id: string;
  to_company_id: string;
  amount: number;
  description: string | null;
  delivery_link: string | null;
  suggested_amount: number | null;
  status: string;
  created_at: string;
  company_name?: string;
}

interface DirectOfferRow {
  id: string;
  company_id: string;
  amount: number;
  description: string | null;
  status: string;
  delivery_link: string | null;
  created_at: string;
  read_at: string | null;
  campaign_id: string | null;
  company_name?: string;
}

export default function InfluencerMyCampaignsPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [directOffers, setDirectOffers] = useState<DirectOfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryLink, setDeliveryLink] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState<Record<string, string>>({});
  const [counteringId, setCounteringId] = useState<string | null>(null);
  const [deliveryOfferId, setDeliveryOfferId] = useState<string | null>(null);
  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [propRes, offerRes] = await Promise.all([
        supabase.from("partnership_proposals").select("id, to_company_id, amount, description, delivery_link, suggested_amount, status, created_at").eq("from_user_id", userId).order("created_at", { ascending: false }),
        supabase.from("direct_offers").select("id, company_id, amount, description, status, delivery_link, created_at, read_at, campaign_id").eq("to_user_id", userId).order("created_at", { ascending: false }),
      ]);
      const rows = (propRes.data ?? []) as ProposalRow[];
      const offers = (offerRes.data ?? []) as DirectOfferRow[];
      const companyIds = [...new Set([...rows.map((r) => r.to_company_id), ...offers.map((o) => o.company_id)])];
      let names: Record<string, string> = {};
      if (companyIds.length > 0) {
        const { data: comps } = await supabase.from("companies").select("id, name").in("id", companyIds);
        names = Object.fromEntries((comps ?? []).map((c) => [c.id, c.name]));
      }
      setProposals(rows.map((r) => ({ ...r, company_name: names[r.to_company_id] })));
      setDirectOffers(offers.map((o) => ({ ...o, company_name: names[o.company_id] })));
      setLoading(false);
      if (offers.length > 0) {
        supabase.from("direct_offers").update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("to_user_id", userId).is("read_at", null).then(() => {});
      }
    })();
  }, [userId]);

  const handleSendCounterOffer = async (proposalId: string) => {
    const val = counterAmount[proposalId]?.replace(",", ".");
    const amount = val ? parseFloat(val) : NaN;
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Informe um valor para a contraproposta.", variant: "destructive" });
      return;
    }
    setCounteringId(proposalId);
    const { error } = await supabase
      .from("partnership_proposals")
      .update({ amount, status: "counter_offer", updated_at: new Date().toISOString() })
      .eq("id", proposalId)
      .eq("from_user_id", userId);
    setCounteringId(null);
    if (error) {
      toast({ title: "Erro ao enviar contraproposta", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Contraproposta enviada! A marca pode aceitar ou sugerir outro valor." });
    setProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, amount, status: "counter_offer" } : p)));
    setCounterAmount((prev) => ({ ...prev, [proposalId]: "" }));
  };

  const handleSendDelivery = async (proposalId: string) => {
    const link = (deliveryLink[proposalId] ?? "").trim();
    if (!link) {
      toast({ title: "Cole o link da postagem.", variant: "destructive" });
      return;
    }
    setSendingId(proposalId);
    const { error } = await supabase
      .from("partnership_proposals")
      .update({ delivery_link: link, status: "under_review", updated_at: new Date().toISOString() })
      .eq("id", proposalId)
      .eq("from_user_id", userId);
    setSendingId(null);
    if (error) {
      toast({ title: "Erro ao enviar entrega", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Entrega enviada!", description: "A marca vai revisar e liberar o valor." });
    setProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, delivery_link: link, status: "under_review" } : p)));
    setDeliveryLink((prev) => ({ ...prev, [proposalId]: "" }));
  };

  const handleAcceptOffer = async (offerId: string) => {
    setAcceptingOfferId(offerId);
    const { data, error } = await supabase.rpc("accept_direct_offer", { offer_id: offerId });
    setAcceptingOfferId(null);
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      toast({ title: "Erro ao aceitar", description: (result?.error as string) || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Oferta aceita! O valor foi reservado. Envie o link da entrega quando concluir." });
    setDirectOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: "accepted" } : o)));
  };

  const handleSendOfferDelivery = async (offerId: string) => {
    const link = (deliveryLink[offerId] ?? "").trim();
    if (!link) {
      toast({ title: "Cole o link da postagem.", variant: "destructive" });
      return;
    }
    setDeliveryOfferId(offerId);
    const { error } = await supabase.from("direct_offers").update({ delivery_link: link, status: "under_review", updated_at: new Date().toISOString() }).eq("id", offerId).eq("to_user_id", userId);
    setDeliveryOfferId(null);
    if (error) {
      toast({ title: "Erro ao enviar entrega", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Entrega enviada! A marca vai revisar e liberar o valor." });
    setDirectOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, delivery_link: link, status: "under_review" } : o)));
    setDeliveryLink((prev) => ({ ...prev, [offerId]: "" }));
  };

  return (
    <div className="fixed inset-0 z-[55] flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background/95 backdrop-blur-xl border-l border-fuchsia-500/20 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-fuchsia-500/20">
          <h2 className="font-display font-bold text-lg text-fuchsia-400 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Minhas Campanhas
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-muted-foreground mb-4">Propostas que você enviou e o status de cada uma.</p>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-fuchsia-500/30 border-t-fuchsia-400 rounded-full animate-spin" />
            </div>
          ) : proposals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">Nenhuma proposta enviada ainda. Clique em uma marca no mural e use &quot;Enviar Proposta de Campanha&quot;.</p>
          ) : (
            <ul className="space-y-3">
              {proposals.map((p) => (
                <li key={p.id} className="p-4 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{p.company_name || "Marca"}</p>
                      <p className="text-sm text-fuchsia-400 font-semibold tabular-nums mt-0.5">
                        R$ {Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                      {p.suggested_amount != null && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Valor sugerido pela marca: R$ {Number(p.suggested_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      )}
                      {p.delivery_link && (
                        <a href={p.delivery_link} target="_blank" rel="noopener noreferrer" className="text-xs text-fuchsia-400 hover:underline mt-1 flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> Link da entrega
                        </a>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{new Date(p.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                    <span className={`flex items-center gap-1 shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
                      p.status === "pending" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" :
                      p.status === "counter_offer" ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" :
                      p.status === "accepted" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                      p.status === "under_review" ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" :
                      "bg-primary/20 text-primary"
                    }`}>
                      {p.status === "pending" && <Clock className="w-3 h-3" />}
                      {p.status === "accepted" && <CheckCircle className="w-3 h-3" />}
                      {p.status === "paid" && <DollarSign className="w-3 h-3" />}
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>
                  {(p.status === "pending" || p.status === "counter_offer") && p.suggested_amount != null && (
                    <div className="mt-3 pt-3 border-t border-fuchsia-500/10 flex flex-wrap items-center gap-2">
                      <Input
                        placeholder="Seu valor (R$)"
                        inputMode="decimal"
                        className="w-28 text-sm h-8 bg-background/80"
                        value={counterAmount[p.id] ?? ""}
                        onChange={(e) => setCounterAmount((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      />
                      <Button size="sm" className="h-8 gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-500" onClick={() => handleSendCounterOffer(p.id)} disabled={counteringId === p.id}>
                        {counteringId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Enviar contraproposta
                      </Button>
                    </div>
                  )}
                  {p.status === "accepted" && (
                    <div className="mt-3 pt-3 border-t border-fuchsia-500/10 flex gap-2">
                      <Input
                        placeholder="Cole o link da postagem..."
                        value={deliveryLink[p.id] ?? ""}
                        onChange={(e) => setDeliveryLink((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className="flex-1 text-sm bg-background/80"
                      />
                      <Button
                        size="sm"
                        className="gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 shrink-0"
                        onClick={() => handleSendDelivery(p.id)}
                        disabled={sendingId === p.id}
                      >
                        {sendingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Enviar Entrega
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!loading && directOffers.length > 0 && (
            <>
              <h3 className="font-display font-semibold text-fuchsia-400 mt-8 mb-2">Ofertas recebidas</h3>
              <p className="text-xs text-muted-foreground mb-3">Ofertas diretas que marcas enviaram para você.</p>
              <ul className="space-y-3">
                {directOffers.map((o) => (
                  <li key={o.id} className="p-4 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{o.company_name || "Marca"}</p>
                        <p className="text-sm text-fuchsia-400 font-semibold tabular-nums mt-0.5">R$ {Number(o.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        {o.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.description}</p>}
                        {o.campaign_id && (
                          <Link to={`/campanha/${o.campaign_id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-fuchsia-400 hover:underline mt-1 inline-flex items-center gap-1">
                            <Link2 className="w-3 h-3" /> Ver campanha
                          </Link>
                        )}
                        {o.delivery_link && (
                          <a href={o.delivery_link} target="_blank" rel="noopener noreferrer" className="text-xs text-fuchsia-400 hover:underline mt-1 flex items-center gap-1">
                            <Link2 className="w-3 h-3" /> Link da entrega
                          </a>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{new Date(o.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
                        o.status === "pending" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" :
                        o.status === "accepted" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                        o.status === "under_review" ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" : "bg-primary/20 text-primary"
                      }`}>
                        {o.status === "pending" ? "Pendente" : o.status === "accepted" ? "Aceita" : o.status === "under_review" ? "Em revisão" : "Paga"}
                      </span>
                    </div>
                    {o.status === "pending" && (
                      <div className="mt-3 pt-3 border-t border-fuchsia-500/10">
                        <Button size="sm" className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-500" onClick={() => handleAcceptOffer(o.id)} disabled={acceptingOfferId === o.id}>
                          {acceptingOfferId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Aceitar oferta
                        </Button>
                      </div>
                    )}
                    {o.status === "accepted" && (
                      <div className="mt-3 pt-3 border-t border-fuchsia-500/10 flex gap-2">
                        <Input
                          placeholder="Cole o link da postagem..."
                          className="flex-1 text-sm h-8 bg-background/80"
                          value={deliveryLink[o.id] ?? ""}
                          onChange={(e) => setDeliveryLink((prev) => ({ ...prev, [o.id]: e.target.value }))}
                        />
                        <Button size="sm" className="h-8 gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 shrink-0" onClick={() => handleSendOfferDelivery(o.id)} disabled={deliveryOfferId === o.id}>
                          {deliveryOfferId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Enviar Entrega
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
