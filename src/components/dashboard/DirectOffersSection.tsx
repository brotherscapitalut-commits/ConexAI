import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Send, User, Loader2, Package, Link2, MapPin, CheckCircle2, XCircle, Archive, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardEmptyState from "@/components/dashboard/DashboardEmptyState";
import { logger } from "@/lib/logger";

interface InfluencerOption {
  user_id: string;
  display_name: string;
  name: string;
}

interface CampaignOption {
  id: string;
  title: string | null;
  status: string;
}

interface DirectOfferRow {
  id: string;
  company_id: string;
  to_user_id: string;
  amount: number;
  description: string | null;
  status: string;
  delivery_link: string | null;
  created_at: string;
  read_at: string | null;
  archived_at: string | null;
  campaign_id: string | null;
  to_user_name?: string;
  campaign_title?: string | null;
}

export default function DirectOffersSection({
  companyIds,
  onRefresh,
}: {
  companyIds: string[];
  onRefresh?: () => void;
}) {
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [offers, setOffers] = useState<DirectOfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!companyIds.length) {
      setInfluencers([]);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data: favs, error: favErr } = await supabase.from("favorite_influencers").select("influencer_id").in("company_id", companyIds);
        if (favErr) {
          logger.error("DirectOffersSection", "Falha ao carregar favoritos (tabela favorite_influencers).", favErr);
          setInfluencers([]);
          setLoading(false);
          return;
        }
        const infIds = [...new Set((favs ?? []).map((f) => f.influencer_id))];
        if (!infIds.length) {
          setInfluencers([]);
          setLoading(false);
          return;
        }
        const { data: infs } = await supabase.from("influencers").select("id, name, owner_id").in("id", infIds);
        if (!infs?.length) {
          setInfluencers([]);
          setLoading(false);
          return;
        }
        const userIds = [...new Set(infs.map((i) => i.owner_id).filter(Boolean))] as string[];
        const { data: profs } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
        const names = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.display_name || ""]));
        setInfluencers(infs.map((i) => ({ user_id: i.owner_id, display_name: names[i.owner_id] || "", name: i.name })));
      } finally {
        setLoading(false);
      }
    })();
  }, [companyIds.join(",")]);

  useEffect(() => {
    if (!companyIds.length) {
      setCampaigns([]);
      return;
    }
    supabase
      .from("campaigns")
      .select("id, title, status")
      .in("company_id", companyIds)
      .in("status", ["draft", "collecting_interest", "funded", "active", "completed"])
      .order("created_at", { ascending: false })
      .then(({ data }) => setCampaigns((data ?? []) as CampaignOption[]));
  }, [companyIds.join(",")]);

  const loadOffers = () => {
    if (!companyIds.length) {
      setOffers([]);
      return;
    }
    supabase
      .from("direct_offers")
      .select("id, company_id, to_user_id, amount, description, status, delivery_link, created_at, read_at, archived_at, campaign_id")
      .in("company_id", companyIds)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const rows = (data ?? []) as DirectOfferRow[];
        const userIds = [...new Set(rows.map((r) => r.to_user_id))];
        const campaignIds = [...new Set(rows.map((r) => r.campaign_id).filter(Boolean))] as string[];
        let names: Record<string, string> = {};
        let campaignTitles: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profs } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
          const { data: infs } = await supabase.from("influencers").select("owner_id, name").in("owner_id", userIds);
          names = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.display_name || ""]));
          const infNames = Object.fromEntries((infs ?? []).map((i) => [i.owner_id, i.name]));
          rows.forEach((r) => { r.to_user_name = infNames[r.to_user_id] || names[r.to_user_id] || "Influenciador"; });
        }
        if (campaignIds.length > 0) {
          const { data: camps } = await supabase.from("campaigns").select("id, title").in("id", campaignIds);
          campaignTitles = Object.fromEntries((camps ?? []).map((c) => [c.id, c.title || "Campanha"]));
          rows.forEach((r) => { r.campaign_title = r.campaign_id ? campaignTitles[r.campaign_id] : null; });
        }
        setOffers(rows);
      });
  };

  useEffect(() => {
    loadOffers();
  }, [companyIds.join(","), onRefresh]);

  const handleSend = async () => {
    const companyId = companyIds[0];
    if (!companyId || !selectedUserId) {
      toast({ title: "Selecione um influenciador.", variant: "destructive" });
      return;
    }
    const amt = parseFloat(amount.replace(",", "."));
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Informe um valor válido.", variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await supabase.from("direct_offers").insert({
      company_id: companyId,
      to_user_id: selectedUserId,
      amount: amt,
      description: description.trim() || null,
      status: "pending",
      campaign_id: selectedCampaignId || null,
    });
    setSending(false);
    if (error) {
      toast({ title: "Erro ao enviar oferta", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Oferta direta enviada! O influenciador verá no Inbox de Convites." });
    setAmount("");
    setDescription("");
    setSelectedUserId("");
    setSelectedCampaignId("");
    onRefresh?.();
    loadOffers();
  };

  const handleCancel = async (offerId: string) => {
    setCancellingId(offerId);
    const { error } = await supabase.from("direct_offers").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", offerId);
    setCancellingId(null);
    if (error) {
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Oferta cancelada." });
    loadOffers();
    onRefresh?.();
  };

  const handleArchive = async (offerId: string) => {
    setArchivingId(offerId);
    const { error } = await supabase.from("direct_offers").update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", offerId);
    setArchivingId(null);
    if (error) {
      toast({ title: "Erro ao arquivar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Oferta arquivada." });
    loadOffers();
    onRefresh?.();
  };

  const handleRelease = async (offerId: string) => {
    setReleasingId(offerId);
    const { data, error } = await supabase.rpc("release_direct_offer", { offer_id: offerId });
    setReleasingId(null);
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      toast({ title: "Erro ao liberar", description: (result?.error as string) || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Valor liberado! 85% ao influenciador, 15% taxa plataforma." });
    setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: "paid" } : o)));
    onRefresh?.();
  };

  return (
    <section className="mb-10">
      <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
        <Send className="w-5 h-5 text-primary" />
        Ofertas diretas
      </h2>
      <Card className="rounded-2xl border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground mb-4">
            Envie uma oferta direta a um influenciador da sua lista. Use &quot;Ir ao Mural buscar Influencers&quot; para procurar, clicar no perfil e <strong>Salvar na minha Lista</strong>; os salvos aparecem aqui. Ao aceitar, o valor é congelado; quando o serviço estiver concluído e <strong>ambos confirmarem</strong>, o valor é liberado automaticamente: a plataforma recebe <strong>15%</strong> e o restante (85%) vai para o influenciador.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm min-w-[200px]"
            >
              <option value="">Selecione o influenciador</option>
              {influencers.map((i) => (
                <option key={i.user_id} value={i.user_id}>{i.display_name || i.name || i.user_id.slice(0, 8)}</option>
              ))}
            </select>
            <Link to="/influencers">
              <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0">
                <MapPin className="w-4 h-4" />
                Ir ao Mural buscar Influencers
              </Button>
            </Link>
            <Input type="text" inputMode="decimal" placeholder="Valor (R$)" className="w-28" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input type="text" placeholder="O que você quer (ex.: 3 stories)" className="flex-1 min-w-[180px]" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-2 min-w-[200px]">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Vincular campanha:</span>
              <Select value={selectedCampaignId || "none"} onValueChange={(v) => setSelectedCampaignId(v === "none" ? "" : v)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title || "Campanha"} — {c.status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSend} disabled={sending || !selectedUserId}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Fazer oferta direta
            </Button>
          </div>
          {offers.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Button variant={!showArchived ? "default" : "outline"} size="sm" onClick={() => setShowArchived(false)}>Ativas</Button>
                <Button variant={showArchived ? "default" : "outline"} size="sm" onClick={() => setShowArchived(true)} className="gap-1"><Archive className="w-3.5 h-3.5" /> Arquivadas</Button>
              </div>
              <ul className="space-y-3">
                {(showArchived ? offers.filter((o) => o.archived_at) : offers.filter((o) => !o.archived_at)).map((o) => (
                  <li key={o.id} className="p-4 rounded-xl border border-white/10 bg-white/5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <User className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-medium">{o.to_user_name || "Influenciador"}</span>
                      <span className="text-sm text-primary font-semibold">R$ {Number(o.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === "pending" ? "bg-amber-500/20" : o.status === "accepted" ? "bg-emerald-500/20" : o.status === "under_review" ? "bg-blue-500/20" : o.status === "cancelled" ? "bg-muted" : "bg-primary/20"}`}>
                        {o.status === "pending" ? "Pendente" : o.status === "accepted" ? "Aceita" : o.status === "under_review" ? "Em revisão" : o.status === "cancelled" ? "Cancelada" : "Paga"}
                      </span>
                      {o.read_at && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1" title="Destinatário viu a mensagem">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Lido
                        </span>
                      )}
                      {o.campaign_id && (
                        <Link to={`/campanha/${o.campaign_id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                          <Link2 className="w-3 h-3" /> {o.campaign_title || "Campanha"}
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {o.status === "under_review" && o.delivery_link && (
                        <a href={o.delivery_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> Link da entrega
                        </a>
                      )}
                      {o.status === "under_review" && (
                        <Button size="sm" onClick={() => handleRelease(o.id)} disabled={releasingId === o.id}>
                          {releasingId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                          Confirmar entrega e liberar
                        </Button>
                      )}
                      {o.status === "pending" && (
                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleCancel(o.id)} disabled={cancellingId === o.id}>
                          {cancellingId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                          Cancelar
                        </Button>
                      )}
                      {!o.archived_at && (
                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => handleArchive(o.id)} disabled={archivingId === o.id}>
                          {archivingId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                          Arquivar
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {offers.length === 0 && !loading && (
            <DashboardEmptyState
              title="Nenhuma oferta direta enviada ainda"
              description="Selecione um influenciador da lista acima, defina o valor e o que você quer. Eles recebem a oferta no Inbox de Convites."
            />
          )}
          {influencers.length === 0 && !loading && (
            <p className="text-sm text-amber-600 dark:text-amber-400 py-2 mt-2">
              Nenhum influenciador na sua lista. Vá ao Mural de Influencers, escolha perfis e use &quot;Salvar na minha Lista&quot; para aparecerem aqui.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
