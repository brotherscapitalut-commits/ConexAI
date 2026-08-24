import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, History, Play, Terminal, Bot, ShieldAlert, FileText, Target, TrendingUp, DollarSign } from "lucide-react";

const API = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:3001";

function getAuthHeader(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("local_db_token");
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

interface SuggestedInfluencer {
  id: string;
  name: string;
  category: string;
  niche?: string;
  followers_count: number;
  avg_engagement: number;
  fit_score: string;
}

interface HistoryEntry {
  id: string;
  search_query: string | null;
  source: string;
  suggested_influencers_ids: string[];
  suggested_company_ids: string[];
  rationale: string | null;
  created_at: string;
}

export default function AdminAILabPage() {
  const [campaignText, setCampaignText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ influencers: SuggestedInfluencer[]; rationale: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          `${API}/api/rest/ai_matchmaking_history?select=id,search_query,source,suggested_influencers_ids,suggested_company_ids,rationale,created_at&order=created_at.desc&limit=50`,
          { headers: getAuthHeader() }
        );
        const json = await res.json();
        const data = Array.isArray(json.data) ? json.data : [];
        setHistory(data);
      } catch (_e) {
        setHistory([]);
      }
    };
    load();
  }, [result]);

  const handleSuggest = async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/ai-suggest`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ campaign_text: campaignText }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Erro ao obter sugestões");
        return;
      }
      setResult(json.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede");
    } finally {
      setLoading(false);
    }
  };

  const agents = [
    { id: 'auctionDynamicPricingAgent', name: 'Auction Pricing Agent', icon: DollarSign, desc: 'Calcula flutuação de preço de zonas baseada na demanda.' },
    { id: 'contentAgent', name: 'Content Agent', icon: FileText, desc: 'Cria artigos institucionais otimizados (SEO/IA) para marcas.' },
    { id: 'contentOrchestrator', name: 'Content Orchestrator', icon: Bot, desc: 'Agenda e dispara o ciclo de criação de conteúdo diariamente.' },
    { id: 'emailConversionEngine', name: 'Email Engine', icon: Target, desc: 'Otimiza copywriting de e-mails para aumentar conversão.' },
    { id: 'escrowFinanceAgent', name: 'Escrow Finance', icon: DollarSign, desc: 'Audita saldos em escrow e valida os splits de comissão.' },
    { id: 'legalComplianceAgent', name: 'Legal Compliance', icon: ShieldAlert, desc: 'Audita parcerias para checar aceite de termos e conformidade.' },
    { id: 'platformIntelligence', name: 'Platform Intelligence', icon: Sparkles, desc: 'Motor central orquestrador de rastreamento.' },
    { id: 'securityHunterAgent', name: 'Security Hunter', icon: ShieldAlert, desc: 'Testes de vulnerabilidade e bloqueio de acessos.' },
    { id: 'trafficAnalyticsAgent', name: 'Traffic Analytics', icon: TrendingUp, desc: 'Computa cliques e tráfego gerado por cada bloco.' },
    { id: 'vaultManager', name: 'Vault Manager', icon: Terminal, desc: 'Gerencia vetores RAG e memória de contexto longo.' },
  ];

  const [agentStatus, setAgentStatus] = useState<Record<string, 'idle'|'running'|'success'|'error'>>({});
  const [agentLogs, setAgentLogs] = useState<Record<string, string[]>>({});

  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [contentCompanyId, setContentCompanyId] = useState("");
  const [contentTopic, setContentTopic] = useState("");
  const [contentWebhook, setContentWebhook] = useState("");

  useEffect(() => {
    fetch(`${API}/api/rest/companies?select=id,name`, { headers: getAuthHeader() })
      .then(res => res.json())
      .then(json => {
         if(Array.isArray(json.data)) setCompanies(json.data);
      }).catch(() => {});
  }, []);

  const handleRunAgent = async (agentId: string) => {
    if (agentId === 'contentAgent') {
      setContentModalOpen(true);
      return;
    }

    setAgentStatus(prev => ({ ...prev, [agentId]: 'running' }));
    setAgentLogs(prev => ({ ...prev, [agentId]: [`[${new Date().toLocaleTimeString()}] Iniciando ${agentId}...`] }));
    
    try {
      const res = await fetch(`${API}/api/admin/agents/run`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ agentId }),
      });
      const json = await res.json();
      
      if (!res.ok) throw new Error(json?.error?.message || "Erro na execução");
      
      const resultData = json.data;
      setAgentStatus(prev => ({ ...prev, [agentId]: resultData.status === 'ERROR' ? 'error' : 'success' }));
      
      if (resultData.logs) {
         setAgentLogs(prev => ({ ...prev, [agentId]: [...prev[agentId], ...resultData.logs] }));
      } else {
         setAgentLogs(prev => ({ ...prev, [agentId]: [...prev[agentId], `[${new Date().toLocaleTimeString()}] ${JSON.stringify(resultData)}`] }));
      }
      
      setTimeout(() => setAgentStatus(prev => ({ ...prev, [agentId]: 'idle' })), 8000);
    } catch (e) {
      setAgentStatus(prev => ({ ...prev, [agentId]: 'error' }));
      setAgentLogs(prev => ({ ...prev, [agentId]: [...prev[agentId], `[${new Date().toLocaleTimeString()}] FALHA CRÍTICA: ${e instanceof Error ? e.message : 'Erro'}`] }));
      setTimeout(() => setAgentStatus(prev => ({ ...prev, [agentId]: 'idle' })), 8000);
    }
  };

  const handleGenerateContent = async () => {
    if (!contentCompanyId || !contentTopic) return;
    setContentModalOpen(false);
    
    const agentId = 'contentAgent';
    setAgentStatus(prev => ({ ...prev, [agentId]: 'running' }));
    setAgentLogs(prev => ({ ...prev, [agentId]: [`[${new Date().toLocaleTimeString()}] Iniciando geração de artigo para tópico: ${contentTopic}...`] }));

    try {
      const res = await fetch(`${API}/api/admin/agents/generate-article`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ companyId: contentCompanyId, topic: contentTopic, webhookUrl: contentWebhook }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Erro na execução");

      setAgentStatus(prev => ({ ...prev, [agentId]: 'success' }));
      setAgentLogs(prev => ({ ...prev, [agentId]: [...prev[agentId], `[${new Date().toLocaleTimeString()}] Artigo gerado com sucesso: ${json.data?.title}`] }));
      
      setTimeout(() => setAgentStatus(prev => ({ ...prev, [agentId]: 'idle' })), 8000);
    } catch (e) {
      setAgentStatus(prev => ({ ...prev, [agentId]: 'error' }));
      setAgentLogs(prev => ({ ...prev, [agentId]: [...prev[agentId], `[${new Date().toLocaleTimeString()}] FALHA: ${e instanceof Error ? e.message : 'Erro'}`] }));
      setTimeout(() => setAgentStatus(prev => ({ ...prev, [agentId]: 'idle' })), 8000);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">AI Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitoramento e acionamento manual do pool de agentes autônomos.
        </p>
      </div>

      <Dialog open={contentModalOpen} onOpenChange={setContentModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Gerar Artigo Manualmente</DialogTitle>
            <DialogDescription>Acione o Content Agent (SEO/GEO) para uma marca específica.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Empresa Alvo</Label>
              <Select value={contentCompanyId} onValueChange={setContentCompanyId}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tópico / Palavra-Chave</Label>
              <Input placeholder="Ex: Tendências de mercado 2024" value={contentTopic} onChange={e => setContentTopic(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Webhook URL (Opcional)</Label>
              <Input placeholder="https://api.cms.com/webhook" value={contentWebhook} onChange={e => setContentWebhook(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContentModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerateContent} disabled={!contentCompanyId || !contentTopic}>Gerar Artigo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agents.map((agent) => {
          const status = agentStatus[agent.id] || 'idle';
          const logs = agentLogs[agent.id] || [];
          
          return (
            <Card key={agent.id} className="relative overflow-hidden flex flex-col bg-slate-900 border-slate-800">
               {status === 'running' && <div className="absolute top-0 left-0 w-full h-1 bg-primary animate-pulse" />}
               {status === 'success' && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />}
               {status === 'error' && <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />}
               
               <CardHeader className="pb-2">
                 <div className="flex items-start justify-between">
                   <div className="p-2 bg-slate-800 rounded-lg">
                     <agent.icon className="w-5 h-5 text-purple-400" />
                   </div>
                   <span className={`text-[10px] font-mono px-2 py-1 rounded ${status === 'running' ? 'bg-primary/20 text-primary' : status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : status === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-400'}`}>
                     {status.toUpperCase()}
                   </span>
                 </div>
                 <CardTitle className="text-base font-bold text-white mt-3">{agent.name}</CardTitle>
               </CardHeader>
               <CardContent className="flex-1 flex flex-col">
                 <p className="text-xs text-slate-400 mb-4 flex-1">{agent.desc}</p>
                 
                 {logs.length > 0 && status !== 'idle' && (
                   <div className="mb-4 bg-black/50 p-2 rounded text-[10px] font-mono text-emerald-400 h-20 overflow-y-auto border border-slate-800">
                     {logs.map((l, i) => <div key={i}>{l}</div>)}
                   </div>
                 )}
                 
                 <Button 
                   onClick={() => handleRunAgent(agent.id)}
                   disabled={status === 'running'}
                   variant="secondary"
                   className="w-full mt-auto bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                 >
                   {status === 'running' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executando</> : <><Play className="w-4 h-4 mr-2" /> Acionar Agente</>}
                 </Button>
               </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-12 pt-8 border-t border-border">
        <h2 className="text-xl font-display font-bold text-foreground mb-4">Ferramentas Legadas de IA</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Texto da campanha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="w-full min-h-[140px] rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Ex.: Campanha de lançamento de tênis de corrida para atletas amadores. Foco em fitness, esportes e bem-estar..."
            value={campaignText}
            onChange={(e) => setCampaignText(e.target.value)}
          />
          <Button onClick={handleSuggest} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Sugerir Top 5 Influencers
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-display">Sugestões (Fit de Categoria + Engajamento)</CardTitle>
            {result.rationale && (
              <p className="text-xs text-muted-foreground mt-1">{result.rationale}</p>
            )}
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {result.influencers?.map((inf, i) => (
                <li
                  key={inf.id}
                  className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg border border-border/50 bg-muted/20"
                >
                  <div>
                    <span className="font-medium text-foreground">#{i + 1} {inf.name}</span>
                    <p className="text-xs text-muted-foreground">
                      {inf.category} {inf.niche ? `· ${inf.niche}` : ""} · {inf.followers_count ?? 0} seg · eng. {Number(inf.avg_engagement).toFixed(1)}%
                    </p>
                  </div>
                  <span className="text-sm font-display font-semibold text-primary tabular-nums">Fit {inf.fit_score}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de buscas (qualidade das recomendações)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Buscas feitas no mural (mural_chat) e sugestões do AI Lab (admin_lab).</p>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma busca registrada ainda.</p>
          ) : (
            <ul className="space-y-3 max-h-[400px] overflow-y-auto">
              {history.map((h) => (
                <li key={h.id} className="rounded-lg border border-border/50 bg-muted/10 p-3 text-sm">
                  <p className="font-medium text-foreground">{h.search_query || "(sem texto)"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {h.source} · {new Date(h.created_at).toLocaleString("pt-BR")}
                  </p>
                  {h.rationale && <p className="text-xs text-muted-foreground mt-1">{h.rationale}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Influencers: {(Array.isArray(h.suggested_influencers_ids) ? h.suggested_influencers_ids : []).length} · 
                    Empresas: {(Array.isArray(h.suggested_company_ids) ? h.suggested_company_ids : []).length}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
