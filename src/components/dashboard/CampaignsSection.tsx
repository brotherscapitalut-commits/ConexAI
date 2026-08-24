import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Rocket,
  Users,
  FileText,
  Plus,
  Search,
  Loader2,
  Lock,
  CheckCircle,
  Link2,
  Eye,
  EyeOff,
  Upload,
  X,
  Copy,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import DashboardEmptyState from "@/components/dashboard/DashboardEmptyState";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  collecting_interest: "Lista de interesse",
  funded: "Valor congelado",
  active: "Em execução",
  completed: "Concluída",
  cancelled: "Cancelada",
};

interface Campaign {
  id: string;
  company_id: string;
  owner_id: string;
  amount: number;
  status: string;
  title: string | null;
  created_at: string;
  description?: string | null;
  campaign_link?: string | null;
  is_public?: boolean;
  attachment_urls?: string[] | null;
}

interface CampaignInfluencer {
  id: string;
  campaign_id: string;
  influencer_id: string;
  added_at: string;
  influencer?: { name: string; category: string };
}

interface InfluencerOption {
  id: string;
  name: string;
  category: string;
  followers_count: number | null;
}

export default function CampaignsSection({
  userId,
  companyIds,
  onRefresh,
  onCampaignCreated,
}: {
  userId: string;
  companyIds: string[];
  onRefresh?: () => void;
  onCampaignCreated?: (campaignTitle: string) => void;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [interestList, setInterestList] = useState<CampaignInfluencer[]>([]);
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([]);
  const [searchInfluencer, setSearchInfluencer] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [funding, setFunding] = useState<string | null>(null);
  const [newAmount, setNewAmount] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCampaignLink, setNewCampaignLink] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [tab, setTab] = useState<"start" | "contracts">("start");
  const { toast } = useToast();

  useEffect(() => {
    if (!userId || companyIds.length === 0) return;
    supabase
      .from("campaigns")
      .select("*")
      .in("company_id", companyIds)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as Array<Record<string, unknown>>;
        setCampaigns(
          rows.map((r) => ({
            id: r.id as string,
            company_id: r.company_id as string,
            owner_id: (r.owner_id ?? r.company_id) as string,
            amount: Number(r.amount ?? 0),
            status: (r.status as string) ?? "draft",
            title: (r.title as string) ?? null,
            created_at: r.created_at as string,
            description: (r.description as string) ?? null,
            campaign_link: (r.campaign_link as string) ?? null,
            is_public: r.is_public !== false,
            attachment_urls: Array.isArray(r.attachment_urls) ? r.attachment_urls as string[] : (r.attachment_urls ? [] : []),
          }))
        );
      });
  }, [userId, companyIds, onRefresh]);

  useEffect(() => {
    if (!selectedCampaign) {
      setInterestList([]);
      return;
    }
    supabase
      .from("campaign_influencers")
      .select("id, campaign_id, influencer_id, added_at")
      .eq("campaign_id", selectedCampaign.id)
      .then(async ({ data: list }) => {
        const rows = (list ?? []) as CampaignInfluencer[];
        const infIds = [...new Set(rows.map((r) => r.influencer_id))];
        if (infIds.length > 0) {
          const { data: infData } = await supabase.from("influencers").select("id, name, category").in("id", infIds);
          const map = new Map((infData ?? []).map((i) => [i.id, i]));
          setInterestList(rows.map((r) => ({ ...r, influencer: map.get(r.influencer_id) })));
        } else setInterestList(rows);
      });
  }, [selectedCampaign?.id]);

  const loadInfluencers = () => {
    setLoading(true);
    let q = supabase.from("influencers").select("id, name, category, followers_count").eq("moderation_status", "approved").limit(20);
    if (searchInfluencer.trim()) {
      q = q.or(`name.ilike.%${searchInfluencer.trim()}%,category.ilike.%${searchInfluencer.trim()}%`);
    }
    q.then(({ data }) => {
      setInfluencers((data as InfluencerOption[]) ?? []);
      setLoading(false);
    });
  };

  const uploadAttachment = async (file: File): Promise<string | null> => {
    const storage = (supabase as { storage?: { from: (bucket: string) => { upload: (path: string, body: File, opts?: { upsert?: boolean }) => Promise<{ error: Error | null }>; getPublicUrl: (path: string) => { data: { publicUrl: string } } } } }).storage;
    if (!storage?.from) return null;
    try {
      const bucket = "campaign-files";
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await storage.from(bucket).upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } catch (e) {
      console.warn("Upload campanha:", e);
      return null;
    }
  };

  const handleCreateCampaign = async () => {
    const amount = parseFloat(newAmount.replace(",", "."));
    if (!companyIds[0] || !userId || isNaN(amount) || amount <= 0) {
      toast({ title: "Preencha o valor e tenha uma empresa cadastrada.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const payload = {
      company_id: companyIds[0],
      owner_id: userId,
      amount,
      status: "collecting_interest",
      title: newTitle.trim() || "Campanha com valor fixo",
      description: newDescription.trim() || null,
      campaign_link: newCampaignLink.trim() || null,
      is_public: newIsPublic,
      attachment_urls: attachmentUrls.length ? attachmentUrls : [],
    };
    const { data, error } = await supabase
      .from("campaigns")
      .insert(payload)
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast({ title: "Erro ao criar campanha", description: error.message, variant: "destructive" });
      return;
    }
    const row = data as Record<string, unknown> | null;
    const newCampaign: Campaign = row
      ? {
          id: row.id as string,
          company_id: row.company_id as string,
          owner_id: (row.owner_id ?? row.company_id) as string,
          amount: Number(row.amount ?? 0),
          status: (row.status as string) ?? "collecting_interest",
          title: (row.title as string) ?? null,
          created_at: row.created_at as string,
          description: (row.description as string) ?? null,
          campaign_link: (row.campaign_link as string) ?? null,
          is_public: row.is_public !== false,
          attachment_urls: Array.isArray(row.attachment_urls) ? (row.attachment_urls as string[]) : [],
        }
      : (null as unknown as Campaign);
    if (newCampaign) {
      setCampaigns((prev) => [newCampaign, ...prev]);
      setSelectedCampaign(newCampaign);
    }
    const title = newTitle.trim() || "Campanha com valor fixo";
    toast({ title: "Campanha criada", description: "Adicione influencers à lista de interesse. Nenhuma cobrança até você depositar." });
    setNewAmount("");
    setNewTitle("");
    setNewDescription("");
    setNewCampaignLink("");
    setAttachmentUrls([]);
    onCampaignCreated?.(title);
    onRefresh?.();
  };

  const handleAddToInterest = async (influencerId: string) => {
    if (!selectedCampaign) return;
    const { error } = await supabase.from("campaign_influencers").insert({ campaign_id: selectedCampaign.id, influencer_id: influencerId });
    if (error) {
      if (error.code === "23505") toast({ title: "Influencer já está na lista." });
      else toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Adicionado à lista de interesse" });
    setInterestList((prev) => [...prev, { id: "", campaign_id: selectedCampaign.id, influencer_id: influencerId, added_at: new Date().toISOString() }]);
    loadInfluencers();
    onRefresh?.();
  };

  const handleDeposit = async (campaignId: string) => {
    setFunding(campaignId);
    const { error } = await supabase.from("campaigns").update({ status: "funded", updated_at: new Date().toISOString() }).eq("id", campaignId);
    setFunding(null);
    if (error) {
      toast({ title: "Erro ao congelar valor", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Valor depositado e congelado", description: "O pagamento fica garantido até a conclusão da campanha." });
    setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, status: "funded" } : c)));
    setSelectedCampaign((c) => (c?.id === campaignId ? { ...c, status: "funded" } : c));
    onRefresh?.();
  };

  const removeFromInterest = async (id: string) => {
    await supabase.from("campaign_influencers").delete().eq("id", id);
    setInterestList((prev) => prev.filter((r) => r.id !== id));
    onRefresh?.();
  };

  return (
    <section className="mb-10">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Campanhas e garantia
        </h2>
        <div className="flex gap-2">
          <Button variant={tab === "start" ? "default" : "outline"} size="sm" onClick={() => setTab("start")}>
            Iniciar Campanha
          </Button>
          <Button variant={tab === "contracts" ? "default" : "outline"} size="sm" onClick={() => setTab("contracts")}>
            Meus Contratos
          </Button>
        </div>
      </div>

      {tab === "start" && (
        <Card className="rounded-2xl border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
          <CardContent className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary" />
                Iniciar campanha com valor fixo
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Defina o valor que ficará congelado até a conclusão. Adicione influencers à lista de interesse antes de depositar — sem cobrança até você confirmar.
              </p>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <Label className="text-xs text-muted-foreground block mb-1">Título (opcional)</Label>
                    <Input
                      placeholder="Ex: Campanha Black Friday"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-48"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground block mb-1">Valor fixo (R$)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">Descrição breve (opcional)</Label>
                  <Textarea
                    placeholder="Descreva a campanha para os influenciadores: objetivo, produto, prazo..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="min-h-[80px] resize-y"
                    rows={3}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">Link da campanha (opcional)</Label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={newCampaignLink}
                    onChange={(e) => setNewCampaignLink(e.target.value)}
                    className="max-w-md"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Link externo (site, briefing, etc.) para enviar aos influenciadores.</p>
                </div>
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <Switch id="campaign-public" checked={newIsPublic} onCheckedChange={setNewIsPublic} />
                    <Label htmlFor="campaign-public" className="text-sm cursor-pointer flex items-center gap-1.5">
                      {newIsPublic ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4" />}
                      {newIsPublic ? "Pública" : "Privada"} — {newIsPublic ? "influenciadores podem ver detalhes pelo link" : "só você e o admin"}
                    </Label>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground block mb-1">Anexos (PDF, fotos do produto, etc.)</Label>
                  <div className="flex flex-wrap gap-2 items-center">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        multiple
                        disabled={uploadingFile}
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (!files?.length) return;
                          setUploadingFile(true);
                          for (let i = 0; i < files.length; i++) {
                            const url = await uploadAttachment(files[i]);
                            if (url) setAttachmentUrls((prev) => [...prev, url]);
                            else toast({ title: "Upload falhou", description: "Use Supabase Storage (bucket campaign-files) ou adicione links manualmente.", variant: "destructive" });
                          }
                          setUploadingFile(false);
                          e.target.value = "";
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" className="gap-2">
                        {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Enviar arquivo
                      </Button>
                    </label>
                    {attachmentUrls.map((url, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                        <a href={url} target="_blank" rel="noreferrer" className="truncate max-w-[120px] text-primary hover:underline">{url.split("/").pop() || "Anexo"}</a>
                        <button type="button" onClick={() => setAttachmentUrls((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">PDF ou imagens. Requer bucket &quot;campaign-files&quot; no Supabase Storage.</p>
                </div>
                <Button onClick={handleCreateCampaign} disabled={creating} className="gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Criar campanha
                </Button>
              </div>
            </div>

            {selectedCampaign && (selectedCampaign.status === "draft" || selectedCampaign.status === "collecting_interest") && (
              <div className="pt-4 border-t border-white/10">
                <div className="mb-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <Label className="text-xs text-muted-foreground">Link para enviar aos influenciadores (acesso às informações da campanha)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      readOnly
                      value={typeof window !== "undefined" ? `${window.location.origin}/campanha/${selectedCampaign.id}` : ""}
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1"
                      onClick={() => {
                        const url = `${window.location.origin}/campanha/${selectedCampaign.id}`;
                        navigator.clipboard.writeText(url).then(() => toast({ title: "Link copiado" }));
                      }}
                    >
                      <Copy className="w-4 h-4" />
                      Copiar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedCampaign.is_public !== false ? "Pública: influenciadores com o link podem ver título, descrição, anexos e link." : "Privada: só você e o admin veem os detalhes."}
                  </p>
                </div>
                <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Lista de interesse — {selectedCampaign.title || "Campanha"} (R$ {Number(selectedCampaign.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                </h4>
                <p className="text-xs text-muted-foreground mb-3">Busque e adicione influencers. Nenhuma cobrança até você clicar em &quot;Depositar e congelar&quot;.</p>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Buscar por nome ou categoria..."
                    value={searchInfluencer}
                    onChange={(e) => setSearchInfluencer(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadInfluencers()}
                    className="max-w-xs"
                  />
                  <Button variant="outline" size="sm" onClick={loadInfluencers} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Buscar
                  </Button>
                </div>
                {influencers.length > 0 && (
                  <ul className="space-y-1 mb-4 max-h-40 overflow-y-auto rounded-lg border border-white/10 p-2">
                    {influencers.map((inf) => (
                      <li key={inf.id} className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-white/5">
                        <span className="text-sm">{inf.name} — {inf.category}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleAddToInterest(inf.id)}>
                          Adicionar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <ul className="space-y-1 mb-4">
                  {interestList.map((r) => (
                    <li key={r.id || r.influencer_id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-white/5 text-sm">
                      {r.influencer ? `${r.influencer.name} (${r.influencer.category})` : r.influencer_id.slice(0, 8)}
                      {r.id && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeFromInterest(r.id)}>
                          Remover
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                <Button className="gap-2" onClick={() => handleDeposit(selectedCampaign.id)} disabled={funding === selectedCampaign.id}>
                  {funding === selectedCampaign.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  Depositar e congelar valor
                </Button>
              </div>
            )}

            {campaigns.length > 0 && !selectedCampaign && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Selecione uma campanha para gerenciar a lista de interesse:</p>
                <div className="flex flex-wrap gap-2">
                  {campaigns.filter((c) => c.status === "draft" || c.status === "collecting_interest").map((c) => (
                    <Button key={c.id} variant="outline" size="sm" onClick={() => setSelectedCampaign(c)}>
                      {c.title || "Campanha"} — R$ {Number(c.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "contracts" && (
        <Card className="rounded-2xl border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Meus Contratos
            </h3>
            <p className="text-sm text-muted-foreground mb-4">Acompanhe o status do pagamento garantido pela plataforma.</p>
            {campaigns.length === 0 ? (
              <DashboardEmptyState
                title="Nenhuma campanha ainda"
                description="Use a aba Iniciar Campanha para criar uma campanha com valor fixo e adicionar influencers à lista de interesse."
              />
            ) : (
              <ul className="space-y-3">
                {campaigns.map((c) => (
                  <li key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5">
                    <div>
                      <p className="font-medium text-foreground">{c.title || "Campanha sem título"}</p>
                      <p className="text-sm text-muted-foreground">
                        R$ {Number(c.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} — {STATUS_LABELS[c.status] ?? c.status}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    {c.status === "funded" && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                    {c.status === "completed" && <CheckCircle className="w-5 h-5 text-primary" />}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
