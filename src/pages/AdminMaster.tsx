import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";
import { Blocks, ShieldCheck, LogOut, ArrowLeft, FileSearch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { DollarSign, Building2, Users, UserCircle, Server, CheckCircle, XCircle } from "lucide-react";
import { LOCAL_API_URL, getLocalAuthHeaders } from "@/lib/localApi";

const ALLOWED_EMAIL = "brotherscapitalut@gmail.com";
const API = LOCAL_API_URL;
const getAuthHeader = getLocalAuthHeaders;

interface SummaryData {
  finance: { passivoCirculante: number; totalEmpresas: number; receitaPlataforma: number };
  users: { totalEmpresas: number; totalPerfis: number; propostasPendentes: number };
  influencers: { total: number; comCampanhas: number; favoritos: number };
  system: { online: boolean; detail: string };
}

interface TopCompany {
  id: string;
  name: string;
  influencer_credits_balance: number;
}

interface TopInfluencer {
  id: string;
  name: string;
  category: string;
  completed_count: number;
}

interface RecentProposalRow {
  id: string;
  from_user_id: string;
  to_company_id: string;
  amount: number;
  status: string;
  created_at: string;
}

interface AuditProposal {
  id: string;
  from_user_id: string;
  to_company_id: string;
  amount: number;
  suggested_amount: number | null;
  status: string;
  description: string | null;
  briefing: string | null;
  delivery_link: string | null;
  created_at: string;
  updated_at: string;
  influencer_name?: string;
  company_name?: string;
}

const defaultSummary: SummaryData = {
  finance: { passivoCirculante: 0, totalEmpresas: 0, receitaPlataforma: 0 },
  users: { totalEmpresas: 0, totalPerfis: 0, propostasPendentes: 0 },
  influencers: { total: 0, comCampanhas: 0, favoritos: 0 },
  system: { online: false, detail: "" },
};

export default function AdminMaster() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [summary, setSummary] = useState<SummaryData>(defaultSummary);
  const [top10Companies, setTop10Companies] = useState<TopCompany[]>([]);
  const [top10Influencers, setTop10Influencers] = useState<TopInfluencer[]>([]);
  const [recentProposals, setRecentProposals] = useState<RecentProposalRow[]>([]);
  const [auditProposal, setAuditProposal] = useState<AuditProposal | null>(null);
  const [auditLoadingId, setAuditLoadingId] = useState<string | null>(null);
  const navigate = useNavigate();

  /*
    Mesma correção aplicada ao AdminPanel: a autorização vive no
    <AdminMasterGuard> da rota, não aqui.

    Esta página comparava o e-mail retornado por /api/auth/user com uma
    constante no código e, em qualquer divergência OU erro de rede, mandava o
    usuário para /dashboard. Com o bypass de autenticação ativo não há sessão
    real, então a chamada falhava e o admin caía no painel da empresa.

    O `fetch` continua, mas apenas para preencher os dados do usuário na tela.
    Falhar aqui não bloqueia mais o acesso — quem decide isso é o guard.
  */
  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch(`${API}/api/auth/user`, { headers: getAuthHeader() });
        const json = await res.json().catch(() => ({}));
        const u = json?.data?.user ?? null;
        if (u?.id) setUser({ id: u.id, email: u.email });
      } catch {
        // Sem sessão da API (modo bypass, por exemplo): seguimos assim mesmo.
      }
      setAllowed(true);
      setLoading(false);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const load = async () => {
      try {
        const [companiesRes, proposalsRes, influencersRes, systemRes, profitRes] = await Promise.all([
          fetch(`${API}/api/rest/companies?select=id,influencer_credits_balance`, { headers: getAuthHeader() }).then((r) => r.json()),
          fetch(`${API}/api/rest/partnership_proposals?select=id,status`, { headers: getAuthHeader() }).then((r) => r.json()),
          fetch(`${API}/api/rest/influencers?select=id`, { headers: getAuthHeader() }).then((r) => r.json()),
          fetch(`${API}/api/health`).then((r) => r.json()).catch(() => ({ ok: false })),
          fetch(`${API}/api/rest/system_profit?select=amount`, { headers: getAuthHeader() }).then((r) => r.json()).catch(() => ({ data: [] })),
        ]);

        const companies = Array.isArray(companiesRes.data) ? companiesRes.data : [];
        const proposals = Array.isArray(proposalsRes.data) ? proposalsRes.data : [];
        const influencers = Array.isArray(influencersRes.data) ? influencersRes.data : [];
        const passivoCirculante = companies.reduce((s: number, c: { influencer_credits_balance?: number }) => s + (Number(c.influencer_credits_balance) || 0), 0);
        const receitaPlataforma = Array.isArray(profitRes.data) ? profitRes.data.reduce((s: number, r: { amount?: number }) => s + (Number(r?.amount) || 0), 0) : 0;
        const propostasPendentes = proposals.filter((p: { status?: string }) => p.status === "pending").length;

        const favRes = await fetch(`${API}/api/rest/favorite_influencers?select=id`, { headers: getAuthHeader() }).then((r) => r.json()).catch(() => ({ data: [] }));
        const favoritos = Array.isArray(favRes.data) ? favRes.data.length : 0;

        const profilesRes = await fetch(`${API}/api/rest/profiles?select=id`, { headers: getAuthHeader() }).then((r) => r.json()).catch(() => ({ data: [] }));
        const totalPerfis = Array.isArray(profilesRes.data) ? profilesRes.data.length : 0;

        setSummary({
          finance: {
            passivoCirculante,
            totalEmpresas: companies.length,
            receitaPlataforma,
          },
          users: {
            totalEmpresas: companies.length,
            totalPerfis,
            propostasPendentes,
          },
          influencers: {
            total: influencers.length,
            comCampanhas: 0,
            favoritos,
          },
          system: {
            online: !!systemRes?.ok,
            detail: systemRes?.port ? `Porta ${systemRes.port}` : "",
          },
        });
        const vipRes = await fetch(`${API}/api/admin/executive-vip`, { headers: getAuthHeader() }).then((r) => r.json()).catch(() => ({}));
        if (vipRes?.data) {
          setTop10Companies(Array.isArray(vipRes.data.top10Companies) ? vipRes.data.top10Companies : []);
          setTop10Influencers(Array.isArray(vipRes.data.top10Influencers) ? vipRes.data.top10Influencers : []);
        }

        const recentRes = await fetch(
          `${API}/api/rest/partnership_proposals?select=id,from_user_id,to_company_id,amount,status,created_at&order=created_at.desc&limit=15`,
          { headers: getAuthHeader() }
        ).then((r) => r.json()).catch(() => ({ data: [] }));
        setRecentProposals(Array.isArray(recentRes.data) ? recentRes.data : []);
      } catch (_e) {
        setSummary(defaultSummary);
      }
    };
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [allowed]);

  const handleLogout = () => {
    localStorage.removeItem("local_db_token");
    navigate("/");
  };

  const openAudit = async (proposalId: string) => {
    setAuditLoadingId(proposalId);
    setAuditProposal(null);
    try {
      const res = await fetch(
        `${API}/api/rest/partnership_proposals?select=*&id=eq.${proposalId}&limit=1`,
        { headers: getAuthHeader() }
      );
      const json = await res.json().catch(() => ({}));
      const rows = Array.isArray(json.data) ? json.data : [];
      const row = rows[0];
      if (!row) {
        setAuditLoadingId(null);
        return;
      }
      const companyRes = await fetch(
        `${API}/api/rest/companies?select=name&id=eq.${row.to_company_id}&limit=1`,
        { headers: getAuthHeader() }
      ).then((r) => r.json()).catch(() => ({ data: [] }));
      const companies = Array.isArray(companyRes.data) ? companyRes.data : [];
      const companyName = companies[0]?.name ?? "—";

      const profileRes = await fetch(
        `${API}/api/rest/profiles?select=display_name,email&user_id=eq.${row.from_user_id}&limit=1`,
        { headers: getAuthHeader() }
      ).then((r) => r.json()).catch(() => ({ data: [] }));
      const profiles = Array.isArray(profileRes.data) ? profileRes.data : [];
      const influencerName = profiles[0]?.display_name || profiles[0]?.email || "—";

      setAuditProposal({
        ...row,
        influencer_name: influencerName,
        company_name: companyName,
        briefing: row.briefing ?? null,
      });
    } finally {
      setAuditLoadingId(null);
    }
  };

  if (loading || !allowed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground font-medium">Verificando acesso...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-border/60 bg-card/50 backdrop-blur-xl shrink-0">
          <div className="px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-90 transition-opacity">
                <ConeXaiLogo textClassName="font-display font-bold text-lg" showText />
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="font-display font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Sumário Executivo
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/dashboard">
                <Button variant="outline" size="sm" className="border-border/50 text-muted-foreground hover:text-foreground gap-1.5">
                  <ArrowLeft className="w-4 h-4" />
                  Sair do Modo Admin
                </Button>
              </Link>
              <Link to="/admin">
                <Button variant="outline" size="sm" className="border-border/50 text-muted-foreground hover:text-foreground">
                  Painel Admin
                </Button>
              </Link>
              <span className="text-sm text-muted-foreground truncate max-w-[220px]">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-auto">
          <h1 className="text-2xl font-display font-bold text-foreground mb-6">Sumário Executivo</h1>
          <p className="text-sm text-muted-foreground mb-8">Os 3 dados mais relevantes de cada área. Acesse os dashboards pelo menu à esquerda.</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Finanças
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Passivo Circulante</p>
                  <p className="text-xl font-display font-bold tabular-nums">
                    R$ {summary.finance.passivoCirculante.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de empresas</p>
                  <p className="text-xl font-display font-bold tabular-nums">{summary.finance.totalEmpresas}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Receita plataforma (system_profit)</p>
                  <p className="text-xl font-display font-bold tabular-nums">
                    R$ {summary.finance.receitaPlataforma.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <Link to="/admin/finance" className="text-sm text-primary hover:underline">Ver dashboard →</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  Usuários
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total de empresas</p>
                  <p className="text-xl font-display font-bold tabular-nums">{summary.users.totalEmpresas}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de perfis</p>
                  <p className="text-xl font-display font-bold tabular-nums">{summary.users.totalPerfis}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Propostas pendentes</p>
                  <p className="text-xl font-display font-bold tabular-nums">{summary.users.propostasPendentes}</p>
                </div>
                <Link to="/admin/users" className="text-sm text-primary hover:underline">Ver dashboard →</Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-muted-foreground" />
                  Influencers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total de influencers</p>
                  <p className="text-xl font-display font-bold tabular-nums">{summary.influencers.total}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Favoritos (empresas → influencers)</p>
                  <p className="text-xl font-display font-bold tabular-nums">{summary.influencers.favoritos}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">—</p>
                  <p className="text-lg text-muted-foreground">Terceiro indicador no dashboard</p>
                </div>
                <Link to="/admin/influencers" className="text-sm text-primary hover:underline">Ver dashboard →</Link>
              </CardContent>
            </Card>

            <Card className={summary.system.online ? "border-green-500/30" : "border-destructive/30"}>
              <CardHeader>
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Health Check API</p>
                  <p className="text-xl font-display font-bold flex items-center gap-2">
                    {summary.system.online ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1.5">
                        <CheckCircle className="w-5 h-5" /> Online
                      </span>
                    ) : (
                      <span className="text-destructive flex items-center gap-1.5">
                        <XCircle className="w-5 h-5" /> Offline
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Detalhe</p>
                  <p className="text-sm text-muted-foreground">{summary.system.detail || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">—</p>
                  <p className="text-lg text-muted-foreground">Ver dashboard para mais</p>
                </div>
                <Link to="/admin/system" className="text-sm text-primary hover:underline">Ver dashboard →</Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Top 10 Compradores
                </CardTitle>
                <p className="text-xs text-muted-foreground">Ordenado por saldo de créditos (influencer_credits_balance)</p>
              </CardHeader>
              <CardContent>
                {top10Companies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum dado.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 font-medium">Nome</th>
                        <th className="text-right py-2 font-medium">Saldo (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top10Companies.map((c, i) => (
                        <tr key={c.id} className="border-b border-border/30">
                          <td className="py-1.5">{i + 1}. {c.name}</td>
                          <td className="py-1.5 text-right tabular-nums font-medium">
                            R$ {Number(c.influencer_credits_balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-primary" />
                  Top 10 Influencers
                </CardTitle>
                <p className="text-xs text-muted-foreground">Ordenado por propostas concluídas</p>
              </CardHeader>
              <CardContent>
                {top10Influencers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum dado.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 font-medium">Nome</th>
                        <th className="text-left py-2 font-medium">Categoria</th>
                        <th className="text-right py-2 font-medium">Concluídas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top10Influencers.map((inf, i) => (
                        <tr key={inf.id} className="border-b border-border/30">
                          <td className="py-1.5">{i + 1}. {inf.name}</td>
                          <td className="py-1.5 text-muted-foreground">{inf.category}</td>
                          <td className="py-1.5 text-right tabular-nums font-medium">{inf.completed_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Feed de Atividade Recente + Lista global com Auditar */}
          <Card className="mt-8 border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <FileSearch className="w-5 h-5 text-primary" />
                Feed de Atividade Recente — Propostas
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Últimas propostas criadas no sistema. Use &quot;Auditar Proposta&quot; para ver detalhes financeiros e regras para suporte.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentProposals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma proposta ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 font-medium">Data</th>
                        <th className="text-left py-2 font-medium">Valor (R$)</th>
                        <th className="text-left py-2 font-medium">Status</th>
                        <th className="text-right py-2 font-medium">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentProposals.map((p) => (
                        <tr key={p.id} className="border-b border-border/30">
                          <td className="py-2 text-muted-foreground">
                            {new Date(p.created_at).toLocaleString("pt-BR")}
                          </td>
                          <td className="py-2 tabular-nums font-medium">
                            R$ {Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              p.status === "pending" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" :
                              p.status === "accepted" || p.status === "paid" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="py-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => openAudit(p.id)}
                              disabled={!!auditLoadingId}
                            >
                              {auditLoadingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSearch className="w-3.5 h-3.5" />}
                              Auditar Proposta
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Auditar Proposta */}
      <Dialog open={!!auditProposal} onOpenChange={(open) => !open && setAuditProposal(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auditoria de Proposta</DialogTitle>
            <DialogDescription>
              Detalhes financeiros e regras para intervenção em suporte.
            </DialogDescription>
          </DialogHeader>
          {auditProposal && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <p className="text-muted-foreground">Influencer (remetente)</p>
                <p className="font-medium">{auditProposal.influencer_name ?? "—"}</p>
                <p className="text-muted-foreground">Empresa (destino)</p>
                <p className="font-medium">{auditProposal.company_name ?? "—"}</p>
                <p className="text-muted-foreground">Valor ofertado (R$)</p>
                <p className="font-medium tabular-nums">R$ {Number(auditProposal.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                {auditProposal.suggested_amount != null && (
                  <>
                    <p className="text-muted-foreground">Valor sugerido pela empresa (R$)</p>
                    <p className="font-medium tabular-nums">R$ {Number(auditProposal.suggested_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </>
                )}
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium">{auditProposal.status}</p>
                <p className="text-muted-foreground">Criada em</p>
                <p className="font-medium">{new Date(auditProposal.created_at).toLocaleString("pt-BR")}</p>
              </div>
              {auditProposal.description && (
                <div>
                  <p className="text-muted-foreground mb-1">Descrição / mensagem do influencer</p>
                  <p className="rounded-md bg-muted/50 p-3 text-foreground whitespace-pre-wrap">{auditProposal.description}</p>
                </div>
              )}
              {(auditProposal.briefing ?? "") !== "" && (
                <div>
                  <p className="text-muted-foreground mb-1">Regras da Campanha / Briefing (empresa)</p>
                  <p className="rounded-md bg-muted/50 p-3 text-foreground whitespace-pre-wrap">{auditProposal.briefing}</p>
                </div>
              )}
              {auditProposal.delivery_link && (
                <div>
                  <p className="text-muted-foreground mb-1">Link da entrega</p>
                  <a href={auditProposal.delivery_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                    {auditProposal.delivery_link}
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
