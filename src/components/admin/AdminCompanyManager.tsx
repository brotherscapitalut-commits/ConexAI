import React, { useState } from 'react';
import CompanyAuditDossier from './CompanyAuditDossier';
import { useLanguage } from '../../context/LanguageContext';

interface CompanySummary {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
}

export const AdminCompanyManager: React.FC = () => {
  const { t } = useLanguage();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>('comp_01');

  // Lista simulada de empresas cadastradas no sistema
  const [companies] = useState<CompanySummary[]>([
    { id: 'comp_01', name: 'Brother\'s Capital LLC', email: 'contact@brotherscapital.com', plan: 'Premium (20 blocks)', status: 'ACTIVE' },
    { id: 'comp_02', name: 'Alpha Tech Solutions', email: 'ceo@alphatech.io', plan: 'Standard (6 blocks)', status: 'ACTIVE' },
    { id: 'comp_03', name: 'Global Logistics Corp', email: 'ops@globallogistics.com', plan: 'Enterprise (Custom)', status: 'PENDING' }
  ]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-black text-white">{t('companies')} & Autonomous Audit Hub</h2>
          <p className="text-xs text-slate-400 mt-1">Manage corporate clients, view complete history, and inspect autonomous agent logs.</p>
        </div>
        <div className="bg-purple-950/50 border border-purple-500/30 px-4 py-2 rounded-xl text-xs font-mono text-purple-300">
          Total Registered: {companies.length} Companies
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista Lateral de Empresas */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 h-fit">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2">Select Company to Audit</h3>
          <div className="space-y-2">
            {companies.map((comp) => (
              <div 
                key={comp.id}
                onClick={() => setSelectedCompanyId(comp.id)}
                /*
                  Estava `className={p-3.5 ...}` sem as crases do template
                  literal — JSX inválido, o arquivo não parseava e derrubava o
                  build inteiro. O destaque do item selecionado, que o `${...}`
                  ausente claramente pretendia aplicar, foi reconstruído aqui.
                */
                className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col gap-1 ${
                  selectedCompanyId === comp.id
                    ? 'border-purple-500/60 bg-purple-950/30'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-white">{comp.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                    comp.status === 'ACTIVE'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : comp.status === 'PENDING'
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-red-500/15 text-red-300'
                  }`}>
                    {comp.status}
                  </span>
                </div>
                <span className="text-xs text-slate-400">{comp.email}</span>
                <span className="text-[10px] text-purple-300 font-mono mt-1">Plan: {comp.plan}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dossiê Detalhado da Empresa Selecionada */}
        <div className="lg:col-span-2">
          {selectedCompanyId ? (
            <CompanyAuditDossier companyId={selectedCompanyId} />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              Select a company from the left list to inspect its full historical dossier and AI audit trail.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCompanyManager;