import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Download, Phone, Mail, MessageCircle,
  Building2, MapPin, Users, Filter, X, Pencil, Trash2,
  ChevronRight, Calendar, FileText, PhoneCall, Video,
  Wallet, TrendingUp,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type LeadStatus = "lead" | "contato" | "negociacao" | "proposta" | "cliente" | "perdido";

interface CrmLead {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  cnpj: string | null;
  business_sector: string | null;
  company_size: string | null;
  estimated_revenue: string | null;
  employee_count: number | null;
  lead_source: string | null;
  status: LeadStatus;
  notes: string | null;
  tags: string[] | null;
  linked_company_id: string | null;
  created_by: string;
  assigned_to: string | null;
  last_interaction_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CrmInteraction {
  id: string;
  lead_id: string;
  interaction_type: string;
  description: string;
  created_by: string;
  created_at: string;
}

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  lead: { label: "Lead", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  contato: { label: "Contato", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  negociacao: { label: "Negociação", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  proposta: { label: "Proposta", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  cliente: { label: "Cliente", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  perdido: { label: "Perdido", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const LEAD_SOURCES = ["mural", "indicacao", "site", "cold_call", "evento", "rede_social", "outro"];
const COMPANY_SIZES = ["micro", "pequena", "media", "grande"];
const INTERACTION_TYPES = [
  { value: "note", label: "Nota", icon: FileText },
  { value: "call", label: "Ligação", icon: PhoneCall },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Reunião", icon: Video },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "proposal", label: "Proposta", icon: FileText },
];

const FUNNEL_ORDER: LeadStatus[] = ["lead", "contato", "negociacao", "proposta", "cliente", "perdido"];

const emptyLead = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  whatsapp: "",
  website: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  cnpj: "",
  business_sector: "",
  company_size: "",
  estimated_revenue: "",
  employee_count: "",
  lead_source: "",
  status: "lead" as LeadStatus,
  notes: "",
  tags: "",
};

interface CrmPanelProps {
  userId: string;
}

const CrmPanel = ({ userId }: CrmPanelProps) => {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [interactions, setInteractions] = useState<CrmInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSector, setFilterSector] = useState<string>("all");
  const [filterCity, setFilterCity] = useState<string>("all");

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [form, setForm] = useState(emptyLead);
  const [newInteraction, setNewInteraction] = useState({ type: "note", description: "" });
  const [actionLoading, setActionLoading] = useState(false);

  // Gerenciar Créditos
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [companiesList, setCompaniesList] = useState<{ id: string; name: string; influencer_credits_balance: number }[]>([]);
  const [creditsCompanyId, setCreditsCompanyId] = useState("");
  const [creditsDelta, setCreditsDelta] = useState("");
  const [creditsSaving, setCreditsSaving] = useState(false);

  // Volume de Propostas (chart)
  const [proposalsVolume, setProposalsVolume] = useState<{ date: string; count: number }[]>([]);

  const { toast } = useToast();

  const loadLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from("crm_leads")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setLeads(data as unknown as CrmLead[]);
    if (error) console.error(error);
    setLoading(false);
  }, []);

  const loadInteractions = useCallback(async (leadId: string) => {
    const { data } = await supabase
      .from("crm_interactions")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    if (data) setInteractions(data as unknown as CrmInteraction[]);
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  useEffect(() => {
    const loadProposalsVolume = async () => {
      const { data } = await supabase
        .from("partnership_proposals")
        .select("created_at")
        .order("created_at", { ascending: true });
      if (!data?.length) {
        setProposalsVolume([]);
        return;
      }
      const byDay: Record<string, number> = {};
      data.forEach((r: { created_at: string }) => {
        const day = new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
        byDay[day] = (byDay[day] || 0) + 1;
      });
      setProposalsVolume(
        Object.entries(byDay)
          .map(([date, count]) => ({ date, count }))
          .slice(-14)
      );
    };
    loadProposalsVolume();
  }, []);

  const openCreditsModal = async () => {
    setCreditsModalOpen(true);
    const { data } = await supabase.from("companies").select("id, name, influencer_credits_balance").order("name");
    setCompaniesList((data ?? []).map((c) => ({ ...c, influencer_credits_balance: Number(c.influencer_credits_balance) || 0 })));
    setCreditsCompanyId("");
    setCreditsDelta("");
  };

  const saveCredits = async () => {
    if (!creditsCompanyId || creditsDelta === "") {
      toast({ title: "Selecione a empresa e informe o valor.", variant: "destructive" });
      return;
    }
    const delta = parseFloat(creditsDelta.replace(",", "."));
    if (isNaN(delta)) {
      toast({ title: "Valor inválido.", variant: "destructive" });
      return;
    }
    setCreditsSaving(true);
    const company = companiesList.find((c) => c.id === creditsCompanyId);
    const current = company?.influencer_credits_balance ?? 0;
    const newBalance = Math.max(0, current + delta);
    const { error } = await supabase.from("companies").update({ influencer_credits_balance: newBalance }).eq("id", creditsCompanyId);
    setCreditsSaving(false);
    if (error) {
      toast({ title: "Erro ao atualizar créditos", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: delta >= 0 ? "Créditos adicionados." : "Créditos removidos." });
    setCreditsModalOpen(false);
    setCompaniesList((prev) => prev.map((c) => (c.id === creditsCompanyId ? { ...c, influencer_credits_balance: newBalance } : c)));
  };

  const openNewLead = () => {
    setEditingLead(null);
    setForm(emptyLead);
    setFormOpen(true);
  };

  const openEditLead = (lead: CrmLead) => {
    setEditingLead(lead);
    setForm({
      company_name: lead.company_name,
      contact_name: lead.contact_name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      whatsapp: lead.whatsapp || "",
      website: lead.website || "",
      address: lead.address || "",
      city: lead.city || "",
      state: lead.state || "",
      zip_code: lead.zip_code || "",
      cnpj: lead.cnpj || "",
      business_sector: lead.business_sector || "",
      company_size: lead.company_size || "",
      estimated_revenue: lead.estimated_revenue || "",
      employee_count: lead.employee_count?.toString() || "",
      lead_source: lead.lead_source || "",
      status: lead.status,
      notes: lead.notes || "",
      tags: lead.tags?.join(", ") || "",
    });
    setFormOpen(true);
  };

  const openDetail = async (lead: CrmLead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
    await loadInteractions(lead.id);
  };

  const saveLead = async () => {
    if (!form.company_name.trim()) {
      toast({ title: "Nome da empresa é obrigatório", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    const payload = {
      company_name: form.company_name.trim(),
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      website: form.website || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip_code: form.zip_code || null,
      cnpj: form.cnpj || null,
      business_sector: form.business_sector || null,
      company_size: form.company_size || null,
      estimated_revenue: form.estimated_revenue || null,
      employee_count: form.employee_count ? parseInt(form.employee_count) : null,
      lead_source: form.lead_source || null,
      status: form.status,
      notes: form.notes || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : null,
    };

    try {
      if (editingLead) {
        const { error } = await supabase.from("crm_leads").update(payload).eq("id", editingLead.id);
        if (error) throw error;
        toast({ title: "Lead atualizado!" });
      } else {
        const { error } = await supabase.from("crm_leads").insert({ ...payload, created_by: userId });
        if (error) throw error;
        toast({ title: "Lead criado!" });
      }
      setFormOpen(false);
      await loadLeads();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const deleteLead = async (id: string) => {
    const { error } = await supabase.from("crm_leads").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lead excluído" });
      setDetailOpen(false);
      await loadLeads();
    }
  };

  const addInteraction = async () => {
    if (!selectedLead || !newInteraction.description.trim()) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from("crm_interactions").insert({
        lead_id: selectedLead.id,
        interaction_type: newInteraction.type,
        description: newInteraction.description.trim(),
        created_by: userId,
      });
      if (error) throw error;

      // Update last_interaction_at
      await supabase.from("crm_leads").update({ last_interaction_at: new Date().toISOString() }).eq("id", selectedLead.id);

      setNewInteraction({ type: "note", description: "" });
      await loadInteractions(selectedLead.id);
      await loadLeads();
      toast({ title: "Interação registrada!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const updateLeadStatus = async (leadId: string, newStatus: LeadStatus) => {
    const { error } = await supabase.from("crm_leads").update({ status: newStatus }).eq("id", leadId);
    if (!error) await loadLeads();
  };

  const exportCSV = () => {
    const headers = [
      "Empresa", "Contato", "Email", "Telefone", "WhatsApp", "Website",
      "Cidade", "Estado", "CNPJ", "Setor", "Porte", "Receita Est.",
      "Funcionários", "Origem", "Status", "Notas", "Criado em",
    ];
    const rows = filteredLeads.map((l) => [
      l.company_name, l.contact_name || "", l.email || "", l.phone || "",
      l.whatsapp || "", l.website || "", l.city || "", l.state || "",
      l.cnpj || "", l.business_sector || "", l.company_size || "",
      l.estimated_revenue || "", l.employee_count?.toString() || "",
      l.lead_source || "", STATUS_CONFIG[l.status].label, l.notes || "",
      new Date(l.created_at).toLocaleDateString("pt-BR"),
    ]);

    const csv = [headers.join(";"), ...rows.map((r) => r.map((c) => `"${c}"`).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Unique values for filters
  const sectors = [...new Set(leads.map((l) => l.business_sector).filter(Boolean))];
  const cities = [...new Set(leads.map((l) => l.city).filter(Boolean))];

  const filteredLeads = leads.filter((l) => {
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (filterSector !== "all" && l.business_sector !== filterSector) return false;
    if (filterCity !== "all" && l.city !== filterCity) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        l.company_name.toLowerCase().includes(q) ||
        l.contact_name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.business_sector?.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q) ||
        l.cnpj?.includes(q)
      );
    }
    return true;
  });

  const funnelData = FUNNEL_ORDER.map((status) => ({
    status,
    ...STATUS_CONFIG[status],
    leads: filteredLeads.filter((l) => l.status === status),
  }));

  if (loading) return <div className="text-muted-foreground text-center py-12">Carregando CRM...</div>;

  return (
    <div className="space-y-6">
      {/* Gráfico Volume de Propostas */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Volume de Propostas
          </CardTitle>
          <p className="text-xs text-muted-foreground">Propostas de parceria por dia — mercado aquecido quando o volume sobe.</p>
        </CardHeader>
        <CardContent>
          {proposalsVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={proposalsVolume}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Propostas" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma proposta ainda. O gráfico será preenchido com o tempo.</p>
          )}
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">{leads.length} leads total</Badge>
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{leads.filter((l) => l.status === "cliente").length} clientes</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={openCreditsModal} className="border-border/50 gap-1">
            <Wallet className="w-3.5 h-3.5" />
            Gerenciar Créditos
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView(view === "table" ? "kanban" : "table")} className="border-border/50">
            {view === "table" ? "Funil" : "Tabela"}
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV} className="border-border/50 gap-1">
            <Download className="w-3.5 h-3.5" />CSV
          </Button>
          <Button size="sm" onClick={openNewLead} className="gap-1">
            <Plus className="w-3.5 h-3.5" />Novo Lead
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 bg-background/40 border-border/50"
            placeholder="Buscar empresa, contato, email, CNPJ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] bg-background/40 border-border/50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-[100]">
            <SelectItem value="all">Todos status</SelectItem>
            {FUNNEL_ORDER.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sectors.length > 0 && (
          <Select value={filterSector} onValueChange={setFilterSector}>
            <SelectTrigger className="w-[150px] bg-background/40 border-border/50">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-[100]">
              <SelectItem value="all">Todos setores</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s!} value={s!}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {cities.length > 0 && (
          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="w-[150px] bg-background/40 border-border/50">
              <SelectValue placeholder="Cidade" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-[100]">
              <SelectItem value="all">Todas cidades</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c!} value={c!}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* TABLE VIEW */}
      {view === "table" && (
        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30">
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Última Int.</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      Nenhum lead encontrado. Crie o primeiro!
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="border-border/20 cursor-pointer hover:bg-muted/20"
                      onClick={() => openDetail(lead)}
                    >
                      <TableCell>
                        <div className="font-medium">{lead.company_name}</div>
                        {lead.cnpj && <div className="text-xs text-muted-foreground">{lead.cnpj}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{lead.contact_name || "—"}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {lead.email && <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" />{lead.email}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{lead.business_sector || "—"}</TableCell>
                      <TableCell className="text-sm">{[lead.city, lead.state].filter(Boolean).join("/") || "—"}</TableCell>
                      <TableCell>
                        <Badge className={`${STATUS_CONFIG[lead.status].color} text-xs`}>
                          {STATUS_CONFIG[lead.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lead.lead_source || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lead.last_interaction_at
                          ? new Date(lead.last_interaction_at).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => openEditLead(lead)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* KANBAN VIEW */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {funnelData.map((col) => (
            <div key={col.status} className="min-w-[260px] flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <Badge className={`${col.color} text-xs`}>{col.label}</Badge>
                <span className="text-xs text-muted-foreground">{col.leads.length}</span>
              </div>
              <div className="space-y-2">
                {col.leads.map((lead) => (
                  <Card
                    key={lead.id}
                    className="glass-card cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => openDetail(lead)}
                  >
                    <CardContent className="p-3">
                      <div className="font-medium text-sm mb-1">{lead.company_name}</div>
                      {lead.contact_name && <div className="text-xs text-muted-foreground">{lead.contact_name}</div>}
                      {lead.business_sector && <div className="text-xs text-muted-foreground mt-1">{lead.business_sector}</div>}
                      <div className="flex items-center gap-2 mt-2">
                        {lead.phone && <Phone className="w-3 h-3 text-muted-foreground" />}
                        {lead.email && <Mail className="w-3 h-3 text-muted-foreground" />}
                        {lead.whatsapp && <MessageCircle className="w-3 h-3 text-muted-foreground" />}
                        {lead.city && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" />{lead.city}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {col.leads.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border/30 rounded-lg">
                    Nenhum lead
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NEW/EDIT LEAD DIALOG */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingLead ? "Editar Lead" : "Novo Lead"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Nome da empresa *" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="col-span-2 bg-background/50" />
            <Input placeholder="Nome do contato" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="bg-background/50" />
            <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-background/50" />
            <Input placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-background/50" />
            <Input placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="bg-background/50" />
            <Input placeholder="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="bg-background/50" />
            <Input placeholder="CNPJ" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} className="bg-background/50" />
            <Input placeholder="Endereço" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="col-span-2 bg-background/50" />
            <Input placeholder="Cidade" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="bg-background/50" />
            <Input placeholder="Estado (UF)" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="bg-background/50" />
            <Input placeholder="Setor / Ramo" value={form.business_sector} onChange={(e) => setForm({ ...form, business_sector: e.target.value })} className="bg-background/50" />
            <Select value={form.company_size} onValueChange={(v) => setForm({ ...form, company_size: v })}>
              <SelectTrigger className="bg-background/50"><SelectValue placeholder="Porte" /></SelectTrigger>
              <SelectContent className="bg-popover border-border z-[200]">
                {COMPANY_SIZES.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Receita estimada" value={form.estimated_revenue} onChange={(e) => setForm({ ...form, estimated_revenue: e.target.value })} className="bg-background/50" />
            <Input placeholder="Nº funcionários" type="number" value={form.employee_count} onChange={(e) => setForm({ ...form, employee_count: e.target.value })} className="bg-background/50" />
            <Select value={form.lead_source} onValueChange={(v) => setForm({ ...form, lead_source: v })}>
              <SelectTrigger className="bg-background/50"><SelectValue placeholder="Origem do lead" /></SelectTrigger>
              <SelectContent className="bg-popover border-border z-[200]">
                {LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}>
              <SelectTrigger className="bg-background/50"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className="bg-popover border-border z-[200]">
                {FUNNEL_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Tags (separadas por vírgula)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="bg-background/50" />
            <Textarea placeholder="Notas..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="col-span-2 bg-background/50" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={saveLead} disabled={actionLoading}>
              {actionLoading ? "Salvando..." : editingLead ? "Salvar" : "Criar Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LEAD DETAIL DIALOG */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedLead && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="font-display text-xl">{selectedLead.company_name}</DialogTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setDetailOpen(false); openEditLead(selectedLead); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteLead(selectedLead.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              {/* Status selector */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {FUNNEL_ORDER.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={selectedLead.status === s ? "default" : "outline"}
                    className={`text-xs ${selectedLead.status === s ? "" : "border-border/50"}`}
                    onClick={async () => {
                      await updateLeadStatus(selectedLead.id, s);
                      setSelectedLead({ ...selectedLead, status: s });
                    }}
                  >
                    {STATUS_CONFIG[s].label}
                  </Button>
                ))}
              </div>

              {/* Contact info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm mb-6">
                {selectedLead.contact_name && <div><span className="text-muted-foreground">Contato:</span> {selectedLead.contact_name}</div>}
                {selectedLead.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3 text-muted-foreground" />{selectedLead.email}</div>}
                {selectedLead.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-muted-foreground" />{selectedLead.phone}</div>}
                {selectedLead.whatsapp && (
                  <a href={`https://wa.me/${selectedLead.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    <MessageCircle className="w-3 h-3" />WhatsApp
                  </a>
                )}
                {selectedLead.website && (
                  <a href={selectedLead.website.startsWith("http") ? selectedLead.website : `https://${selectedLead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    <Building2 className="w-3 h-3" />{selectedLead.website}
                  </a>
                )}
                {selectedLead.cnpj && <div><span className="text-muted-foreground">CNPJ:</span> {selectedLead.cnpj}</div>}
                {selectedLead.business_sector && <div><span className="text-muted-foreground">Setor:</span> {selectedLead.business_sector}</div>}
                {selectedLead.company_size && <div><span className="text-muted-foreground">Porte:</span> {selectedLead.company_size}</div>}
                {selectedLead.city && <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-muted-foreground" />{[selectedLead.city, selectedLead.state].filter(Boolean).join("/")}</div>}
                {selectedLead.employee_count && <div><span className="text-muted-foreground">Funcionários:</span> {selectedLead.employee_count}</div>}
                {selectedLead.estimated_revenue && <div><span className="text-muted-foreground">Receita est.:</span> {selectedLead.estimated_revenue}</div>}
                {selectedLead.lead_source && <div><span className="text-muted-foreground">Origem:</span> {selectedLead.lead_source}</div>}
              </div>

              {selectedLead.notes && (
                <div className="text-sm bg-background/30 rounded-lg p-3 mb-4">
                  <span className="text-muted-foreground text-xs block mb-1">Notas</span>
                  {selectedLead.notes}
                </div>
              )}

              {/* Interactions */}
              <div className="border-t border-border/30 pt-4">
                <h3 className="text-sm font-display font-semibold mb-3">Histórico de Interações</h3>
                <div className="flex gap-2 mb-3">
                  <Select value={newInteraction.type} onValueChange={(v) => setNewInteraction({ ...newInteraction, type: v })}>
                    <SelectTrigger className="w-[130px] bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-[200]">
                      {INTERACTION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="flex-1 bg-background/50"
                    placeholder="Descreva a interação..."
                    value={newInteraction.description}
                    onChange={(e) => setNewInteraction({ ...newInteraction, description: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && addInteraction()}
                  />
                  <Button size="sm" onClick={addInteraction} disabled={actionLoading}>+</Button>
                </div>

                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {interactions.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">Nenhuma interação registrada</div>
                  ) : (
                    interactions.map((i) => {
                      const typeInfo = INTERACTION_TYPES.find((t) => t.value === i.interaction_type);
                      const Icon = typeInfo?.icon || FileText;
                      return (
                        <div key={i.id} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-background/20">
                          <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div>{i.description}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {typeInfo?.label} • {new Date(i.created_at).toLocaleString("pt-BR")}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Gerenciar Créditos */}
      <Dialog open={creditsModalOpen} onOpenChange={setCreditsModalOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Gerenciar Créditos (influencer_credits_balance)
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Adicione ou remova saldo manualmente da conta de qualquer empresa. Use valor negativo para remover.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Empresa</label>
              <Select value={creditsCompanyId} onValueChange={setCreditsCompanyId}>
                <SelectTrigger className="w-full bg-background/50">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-[200]">
                  {companiesList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — R$ {c.influencer_credits_balance.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Valor a adicionar (+) ou remover (-)</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Ex: 100 ou -50"
                value={creditsDelta}
                onChange={(e) => setCreditsDelta(e.target.value)}
                className="bg-background/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditsModalOpen(false)}>Cancelar</Button>
            <Button onClick={saveCredits} disabled={creditsSaving}>
              {creditsSaving ? "Salvando..." : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CrmPanel;
