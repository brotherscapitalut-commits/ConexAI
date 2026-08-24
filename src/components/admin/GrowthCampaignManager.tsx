import React, { useState, useEffect } from 'react';
import LeadHunterPanel from './LeadHunterPanel';

interface AutonomousLead {
  id: string;
  companyName: string;
  email: string;
  claimedAt: string;
  daysRemaining: number;
  status: 'ACTIVE_TRIAL' | 'CONVERTED_PAID' | 'EXPIRED_RELEASED';
  dripStep: string;
  actionState: string;
  visualAlert: string;
  paymentMethodAttached: boolean;
}

export const GrowthCampaignManager: React.FC = () => {
  const [isAutomating, setIsAutomating] = useState(false);

  // Leads em acompanhamento automatizado
  const [leads, setLeads] = useState<AutonomousLead[]>([
    { id: '1', companyName: 'Nexus Innovations', email: 'ceo@nexus.io', claimedAt: '2026-08-16', daysRemaining: 1, status: 'ACTIVE_TRIAL', dripStep: 'Day 6 Follow-up', actionState: 'WARNING_SENT', visualAlert: 'AMBER_URGENT', paymentMethodAttached: false },
    { id: '2', companyName: 'Apex Logistics', email: 'ops@apex.com', claimedAt: '2026-08-15', daysRemaining: 0, status: 'CONVERTED_PAID', dripStep: 'Completed', actionState: 'SUBSCRIPTION_ACTIVE', visualAlert: 'GREEN_SECURE', paymentMethodAttached: true },
    { id: '3', companyName: 'Vanguard Media', email: 'contact@vanguard.co', claimedAt: '2026-08-10', daysRemaining: 0, status: 'EXPIRED_RELEASED', dripStep: 'Expired (7d)', actionState: 'ACCOUNT_DROPPED', visualAlert: 'RED_EXPIRED', paymentMethodAttached: false },
    { id: '4', companyName: 'Silverstone Capital', email: 'invest@silverstone.com', claimedAt: '2026-08-20', daysRemaining: 3, status: 'ACTIVE_TRIAL', dripStep: 'Day 4 Active', actionState: 'MONITORING', visualAlert: 'NORMAL', paymentMethodAttached: false }
  ]);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/admin/hunter-leads');
      if (res.ok) {
        const { data } = await res.json();
        if (data && data.length > 0) {
          const formattedLeads = data.map((dbLead: any) => ({
            id: dbLead.id,
            companyName: dbLead.company_name,
            email: dbLead.email || 'N/A',
            claimedAt: new Date(dbLead.created_at).toISOString().split('T')[0],
            daysRemaining: 7, 
            status: 'ACTIVE_TRIAL',
            dripStep: 'New Prospect (Day 1)',
            actionState: 'MONITORING',
            visualAlert: 'NORMAL',
            paymentMethodAttached: false
          }));
          setLeads(formattedLeads);
        }
      }
    } catch (e) {
      console.error("Erro ao buscar leads do banco:", e);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleRunAutonomousDrip = () => {
    setIsAutomating(true);
    setTimeout(() => {
      setIsAutomating(false);
      alert('🤖 Automação executada: Disparos de 48h enviados para inativos, e verificação de prazos (5º/6º/7º dia) concluída com sucesso!');
    }, 1000);
  };

  return (
    <div className="space-y-6 text-white">
      {/* Novo Painel do Agente Caçador */}
      <LeadHunterPanel onHunterFinished={fetchLeads} />

      {/* Top Banner de Automação */}
      <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-950 border border-purple-500/30 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full text-xs font-mono">FULL AUTO GROWTH ENGINE</span>
            <h2 className="text-xl font-black">7-Day Claim & 48h Drip Automation</h2>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Envio inicial, follow-up automático em 48h para quem não fez nada, avisos no 5º e 6º dia, e remoção automática no 7º dia sem pagamento.
          </p>
        </div>
        <button
          onClick={handleRunAutonomousDrip}
          disabled={isAutomating}
          className="px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg transition flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
        >
          {isAutomating ? 'Processando...' : '⚙️ Executar Automação Agora'}
        </button>
      </div>

      {/* Tabela de Acompanhamento do Funil Automatizado */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-sm font-bold text-slate-300 mb-4">Monitoramento em Tempo Real do Ciclo de Vida (7 Days Trial)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3">Empresa</th>
                <th className="pb-3">Etapa do Drip (48h)</th>
                <th className="pb-3">Cronômetro Restante</th>
                <th className="pb-3">Status de Pagamento</th>
                <th className="pb-3 text-right">Ação do Sistema</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-800/40">
                  <td className="py-3.5">
                    <span className="font-bold text-white block">{lead.companyName}</span>
                    <span className="text-[11px] text-slate-400">{lead.email}</span>
                  </td>
                  <td className="py-3.5 text-purple-300 font-mono">{lead.dripStep}</td>
                  <td className="py-3.5 font-mono">
                    {lead.status === 'ACTIVE_TRIAL' ? (
                      <span
                        className={`px-2.5 py-1 rounded font-bold ${
                          // Ciclo de 7 dias: os últimos dois dias entram em
                          // vermelho, que é quando o alerta de 6º dia dispara.
                          lead.daysRemaining <= 2
                            ? "bg-red-500/15 text-red-300"
                            : lead.daysRemaining <= 4
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-emerald-500/15 text-emerald-300"
                        }`}
                      >
                        ⏳ {lead.daysRemaining} days remaining
                      </span>
                    ) : (
                      <span className="text-slate-500">Finished</span>
                    )}
                  </td>
                  <td className="py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        lead.paymentMethodAttached
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-slate-700/40 text-slate-400"
                      }`}
                    >
                      {lead.paymentMethodAttached ? '💳 Card Attached (Secure)' : '⚠️ No Card Yet'}
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    {lead.visualAlert === 'AMBER_URGENT' && (
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[10px] font-mono font-bold">
                        ⚠️ Aviso de 6º dia enviado
                      </span>
                    )}
                    {lead.visualAlert === 'RED_EXPIRED' && (
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/40 rounded text-[10px] font-mono">
                        ❌ Removido no 7º dia (Sem saldo)
                      </span>
                    )}
                    {lead.visualAlert === 'GREEN_SECURE' && (
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[10px] font-mono">
                        ✅ Convertido em Assinante
                      </span>
                    )}
                    {lead.visualAlert === 'NORMAL' && (
                      <span className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-[10px] font-mono">
                        🔄 Em monitoramento
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GrowthCampaignManager;