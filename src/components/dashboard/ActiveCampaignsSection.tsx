import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, User, CheckCircle, Loader2, Trash2, RotateCcw, FileText } from "lucide-react";
import DashboardEmptyState from "@/components/dashboard/DashboardEmptyState";

type CampaignStatus = "active" | "draft" | "trashed";

interface CampaignRow {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  budget_per_influencer: number;
  slots_available: number;
  created_at: string;
  status?: CampaignStatus;
}

interface ApplicationRow {
  id: string;
  campaign_id: string;
  from_user_id: string;
  status: string;
  created_at: string;
  from_user_name?: string;
}

export default function ActiveCampaignsSection({
  companyIds,
  onRefresh,
}: {
  companyIds: string[];
  onRefresh?: () => void;
}) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [slots, setSlots] = useState("1");
  const [creating, setCreating] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<CampaignStatus>("active");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!companyIds.length) return;
    supabase
      .from("active_campaigns")
      .select("*")
      .in("company_id", companyIds)
      .order("created_at", { ascending: false })
      .then(({ data }) => setCampaigns((data ?? []).map((r) => ({ ...r, status: (r.status ?? "active") as CampaignStatus })) as CampaignRow[]));
  }, [companyIds.join(","), onRefresh]);

  useEffect(() => {
    if (!campaigns.length) {
      setApplications([]);
      return;
    }
    const cids = campaigns.map((c) => c.id);
    supabase
      .from("campaign_applications")
      .select("id, campaign_id, from_user_id, status, created_at")
      .in("campaign_id", cids)
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const rows = (data ?? []) as ApplicationRow[];
        const userIds = [...new Set(rows.map((r) => r.from_user_id))];
        let names: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profs } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
          names = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.display_name || "Influenciador"]));
        }
        setApplications(rows.map((r) => ({ ...r, from_user_name: names[r.from_user_id] })));
      });
  }, [campaigns.map((c) => c.id).join(",")]);

  const handleCreate = async () => {
    const companyId = companyIds[0];
    if (!companyId || !title.trim()) {
      toast({ title: "Preencha o título da campanha.", variant: "destructive" });
      return;
    }
    const b = parseFloat(budget.replace(",", "."));
    const s = parseInt(slots, 10);
    if (isNaN(b) || b < 0 || isNaN(s) || s < 1) {
      toast({ title: "Valor e vagas devem ser válidos.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("active_campaigns").insert({
      company_id: companyId,
      title: title.trim(),
      description: description.trim() || null,
      budget_per_influencer: b,
      slots_available: s,
      status: "active",
    });
    if (error) {
      setCreating(false);
      toast({ title: "Erro ao criar campanha", description: error.message, variant: "destructive" });
      return;
    }
    setTitle("");
    setDescription("");
    setBudget("");
    setSlots("1");
    toast({ title: "Campanha criada! Influenciadores podem se candidatar." });
    const { data } = await supabase.from("active_campaigns").select("*").in("company_id", companyIds).order("created_at", { ascending: false });
    setCampaigns((data ?? []) as CampaignRow[]);
    setCreating(false);
    onRefresh?.();
  };

  const handleAcceptApplication = async (applicationId: string) => {
    setAcceptingId(applicationId);
    const { data, error } = await supabase.rpc("accept_campaign_application", { application_id: applicationId });
    setAcceptingId(null);
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      toast({ title: "Erro ao aceitar", description: (result?.error as string) || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Candidatura aceita! Foi criada uma oferta direta para o influenciador (valor congelado)." });
    setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, status: "accepted" } : a)));
    onRefresh?.();
  };

  const handleExcluir = async (campaignId: string) => {
    setDeletingId(campaignId);
    const { error } = await supabase.from("active_campaigns").update({ status: "trashed" }).eq("id", campaignId);
    setDeletingId(null);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, status: "trashed" as CampaignStatus } : c)));
    toast({ title: "Campanha movida para a lixeira." });
    onRefresh?.();
  };

  const handleRestaurar = async (campaignId: string) => {
    setRestoringId(campaignId);
    const { error } = await supabase.from("active_campaigns").update({ status: "active" }).eq("id", campaignId);
    setRestoringId(null);
    if (error) {
      toast({ title: "Erro ao restaurar", description: error.message, variant: "destructive" });
      return;
    }
    setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, status: "active" as CampaignStatus } : c)));
    toast({ title: "Campanha restaurada para Ativas." });
    onRefresh?.();
  };

  const filteredCampaigns = campaigns.filter((c) => (c.status ?? "active") === filterTab);

  return (
    <section className="mb-10">
      <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-primary" />
        Campanhas ativas
      </h2>
      <Card className="rounded-2xl border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground mb-4">Crie campanhas com título, descrição e valor por influenciador. Eles veem a lista e clicam em Candidatar-se. Ao aceitar, o valor é congelado e segue o fluxo de entrega e liberação (15% taxa plataforma).</p>
          <div className="flex flex-wrap gap-3 mb-6">
            <Input placeholder="Título da campanha" className="min-w-[200px]" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Descrição / o que você quer" className="flex-1 min-w-[180px]" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input type="text" inputMode="decimal" placeholder="Valor por influenciador (R$)" className="w-40" value={budget} onChange={(e) => setBudget(e.target.value)} />
            <Input type="number" min={1} placeholder="Vagas" className="w-24" value={slots} onChange={(e) => setSlots(e.target.value)} />
            <Button onClick={handleCreate} disabled={creating || !title.trim()}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
              Criar campanha
            </Button>
          </div>
          <div className="flex gap-2 mb-4">
            <Button variant={filterTab === "active" ? "default" : "outline"} size="sm" onClick={() => setFilterTab("active")}>
              Ativas
            </Button>
            <Button variant={filterTab === "draft" ? "default" : "outline"} size="sm" onClick={() => setFilterTab("draft")}>
              <FileText className="w-3.5 h-3.5 mr-1" /> Rascunho
            </Button>
            <Button variant={filterTab === "trashed" ? "default" : "outline"} size="sm" onClick={() => setFilterTab("trashed")}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Lixeira
            </Button>
          </div>

          {filteredCampaigns.length > 0 && (
            <div className="space-y-4">
              {filteredCampaigns.map((c) => {
                const appList = applications.filter((a) => a.campaign_id === c.id);
                return (
                  <div key={c.id} className="p-4 rounded-xl border border-white/10 bg-white/5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground">R$ {Number(c.budget_per_influencer).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/influenciador · {c.slots_available} vaga(s)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {filterTab === "active" && (
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleExcluir(c.id)} disabled={deletingId === c.id}>
                            {deletingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            Excluir
                          </Button>
                        )}
                        {filterTab === "trashed" && (
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleRestaurar(c.id)} disabled={restoringId === c.id}>
                            {restoringId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            Restaurar
                          </Button>
                        )}
                      </div>
                    </div>
                    {filterTab === "active" && appList.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {appList.map((a) => (
                          <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-primary" />{a.from_user_name || "Influenciador"}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === "pending" ? "bg-amber-500/20" : "bg-emerald-500/20"}`}>{a.status === "pending" ? "Pendente" : "Aceita"}</span>
                            {a.status === "pending" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAcceptApplication(a.id)} disabled={acceptingId === a.id}>
                                {acceptingId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                Aceitar
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {filteredCampaigns.length === 0 && (
            <DashboardEmptyState
              title={filterTab === "active" ? "Nenhuma campanha ativa" : filterTab === "trashed" ? "Lixeira vazia" : "Nenhum rascunho"}
              description={filterTab === "active" ? "Crie uma campanha acima com título, valor por influenciador e vagas. Influenciadores poderão se candidatar e você aceita no painel." : filterTab === "trashed" ? "Campanhas excluídas aparecem aqui. Use Restaurar para voltar para Ativas." : "Salve campanhas como rascunho para publicar depois."}
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
