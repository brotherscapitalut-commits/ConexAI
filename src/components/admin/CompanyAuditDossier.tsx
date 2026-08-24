import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Copy } from "lucide-react";

interface CompanyData {
  id: string;
  name: string;
  joinedDate: string;
  totalSpent: number;
  estimatedRevenueGenerated: number;
  activeCampaigns: number;
  archivedCampaigns: number;
  canceledCampaigns: number;
  complaintsCount: number;
  riskStatus: 'COMPLIANT' | 'WARNING' | 'AUDIT_REQUIRED';
  contactsMade: { date: string; target: string; type: 'Influencer' | 'Brand' }[];
  agentLogs: { timestamp: string; agent: string; action: string; status: string }[];
}

export const CompanyAuditDossier: React.FC<{ companyId?: string }> = ({ companyId = 'comp_01' }) => {
  // Dados simulados detalhados de auditoria completa da empresa selecionada
  const [company] = useState<CompanyData>({
    id: companyId,
    name: 'Brother\'s Capital LLC',
    joinedDate: '2026-07-15',
    totalSpent: 449.75,
    estimatedRevenueGenerated: 2850.00,
    activeCampaigns: 3,
    archivedCampaigns: 5,
    canceledCampaigns: 1,
    complaintsCount: 0,
    riskStatus: 'COMPLIANT',
    contactsMade: [
      { date: '2026-08-10', target: 'Influencer @tech_review', type: 'Influencer' },
      { date: '2026-08-02', target: 'Brand Alpha Corp', type: 'Brand' }
    ],
    agentLogs: [
      { timestamp: '2026-08-22 14:10', agent: 'Escrow-Finance-Agent', action: 'Hybrid pricing verified (Base .99 + 20 blocks)', status: 'APPROVED' },
      { timestamp: '2026-08-20 09:30', agent: 'Legal-Compliance-Agent', action: 'Partnership terms audit', status: 'COMPLIANT' },
      { timestamp: '2026-08-18 18:45', agent: 'Traffic-Analytics-Agent', action: 'Milestone 1,000 clicks reached', status: 'HIGH_IMPACT' }
    ]
  });

  const [articles, setArticles] = useState<any[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);

  useEffect(() => {
    const API = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:3001";
    const token = localStorage.getItem("local_db_token");
    fetch(`${API}/api/rest/content_articles?company_id=eq.${companyId}&order=created_at.desc`, {
      headers: { 
        "Content-Type": "application/json", 
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      }
    })
    .then(r => r.json())
    .then(d => {
       if (Array.isArray(d.data)) setArticles(d.data);
    }).catch(console.error);
  }, [companyId]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-2xl space-y-6">
      {/* Cabeçalho do Dossiê */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-purple-400">{company.name}</h2>
            <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {company.riskStatus}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">ID: {company.id} • Member since: {company.joinedDate} (Active for 38 days)</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-slate-800 rounded-lg text-xs font-bold text-slate-300">Total Spent: <strong className="text-emerald-400"></strong></span>
          <span className="px-3 py-1 bg-purple-950/60 border border-purple-500/30 rounded-lg text-xs font-bold text-purple-300">Est. ROI Generated: <strong className="text-purple-400"></strong></span>
        </div>
      </div>

      {/* Grid de Métricas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 uppercase">Campaigns</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-lg font-bold text-emerald-400">{company.activeCampaigns} Active</span>
            <span className="text-xs text-slate-500">({company.archivedCampaigns} arch. / {company.canceledCampaigns} canc.)</span>
          </div>
        </div>

        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 uppercase">Support & Disputes</span>
          <div className="text-lg font-bold text-slate-200 mt-1">
            {company.complaintsCount} Complaints <span className="text-xs text-emerald-400 font-normal">(Clean Record)</span>
          </div>
        </div>

        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 uppercase">Networking Contacts</span>
          <div className="text-lg font-bold text-indigo-400 mt-1">
            {company.contactsMade.length} Interactions logged
          </div>
        </div>

        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 uppercase">Autonomous Audits</span>
          <div className="text-lg font-bold text-purple-400 mt-1">
            {company.agentLogs.length} Checks passed
          </div>
        </div>
      </div>

      {/* Histórico de Interações e Contatos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            🤝 Networking & Communications History
          </h3>
          <div className="space-y-2">
            {company.contactsMade.map((contact, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                <span className="text-slate-300">{contact.target}</span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-purple-600/20 text-purple-300 rounded text-[10px]">{contact.type}</span>
                  <span className="text-slate-500 font-mono">{contact.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logs dos Agentes de IA */}
        <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            🤖 Agent Audit Trail & Compliance Log
          </h3>
          <div className="space-y-2">
            {company.agentLogs.map((log, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                <div>
                  <span className="font-bold text-purple-300 block">{log.agent}</span>
                  <span className="text-slate-400 text-[11px]">{log.action}</span>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-mono">{log.status}</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5 font-mono">{log.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Artigos Gerados pelo Content Agent */}
      <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4 mt-6">
        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-400" />
          Artigos Gerados (SEO / GEO / AEO)
        </h3>
        {articles.length === 0 ? (
          <div className="text-sm text-slate-500 italic">Nenhum artigo gerado para esta empresa.</div>
        ) : (
          <div className="space-y-2">
            {articles.map((art) => (
              <div key={art.id} className="flex justify-between items-center text-xs bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
                <div>
                  <span className="font-bold text-slate-200 block text-sm mb-1">{art.title}</span>
                  <div className="flex gap-2 text-slate-500">
                    <span>{new Date(art.created_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="text-purple-400">By: {art.generated_by}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedArticle(art)}>
                  Visualizar Conteúdo
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Markdown Viewer Modal */}
      <Dialog open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedArticle?.title}</DialogTitle>
            <DialogDescription>Gerado por {selectedArticle?.generated_by} em {selectedArticle && new Date(selectedArticle.created_at).toLocaleString()}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-300 text-sm whitespace-pre-wrap font-mono">
            {selectedArticle?.markdown || selectedArticle?.content_markdown || "Conteúdo indisponível."}
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(selectedArticle?.markdown || selectedArticle?.content_markdown || "")}>
              <Copy className="w-4 h-4 mr-2" /> Copiar Markdown
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default CompanyAuditDossier;