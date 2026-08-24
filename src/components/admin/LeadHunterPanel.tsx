import React, { useState } from 'react';
import { Target, Globe, Hash, Play, Loader2, CheckCircle2 } from 'lucide-react';

interface LeadHunterPanelProps {
  onHunterFinished: () => void;
}

export const LeadHunterPanel: React.FC<LeadHunterPanelProps> = ({ onHunterFinished }) => {
  const [niche, setNiche] = useState('SaaS & Tecnologia');
  const [region, setRegion] = useState('Global');
  const [quantity, setQuantity] = useState(3);
  const [status, setStatus] = useState<'idle' | 'sweeping' | 'enriching' | 'saving' | 'success' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const handleRunHunter = async () => {
    setStatus('sweeping');
    setLogs([]);
    addLog(`Iniciando varredura web para nicho: ${niche}`);
    
    // Simula delays para feedback visual (varrendo, enriquecendo)
    await new Promise(r => setTimeout(r, 1500));
    setStatus('enriching');
    addLog(`Enriquecendo dados e cruzando contatos...`);
    
    await new Promise(r => setTimeout(r, 1500));
    setStatus('saving');
    addLog(`Persistindo ${quantity} novos leads no banco...`);

    try {
      const response = await fetch('/api/admin/run-hunter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, region, quantity })
      });
      
      if (!response.ok) throw new Error('Erro na API do Agente');
      
      const { data } = await response.json();
      setStatus('success');
      addLog(`Sucesso! ${data.totalImported} empresas salvas no funil de Growth.`);
      onHunterFinished(); // Notifica o pai para atualizar a tabela
      
      setTimeout(() => {
        setStatus('idle');
      }, 5000);
    } catch (error) {
      console.error(error);
      setStatus('error');
      addLog(`Falha crítica: ${error instanceof Error ? error.message : 'Desconhecida'}`);
    }
  };

  return (
    <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />
      
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
          <Target className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">Agentes de Prospecção (Lead Hunters)</h2>
          <p className="text-xs text-slate-400">Agentes de IA autônomos que varrem a web buscando empresas qualificadas.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 relative z-10">
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Nicho / Categoria</label>
          <div className="relative">
            <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-10 pr-3 text-sm text-white focus:outline-none focus:border-purple-500/50"
              placeholder="Ex: Startups B2B"
              disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Região Alvo</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-10 pr-3 text-sm text-white focus:outline-none focus:border-purple-500/50"
              placeholder="Ex: United States"
              disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Qtd. de Leads</label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="number" 
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-10 pr-3 text-sm text-white focus:outline-none focus:border-purple-500/50"
              min="1" max="50"
              disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between relative z-10">
        <button
          onClick={handleRunHunter}
          disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all flex items-center gap-2 disabled:opacity-50 w-full md:w-auto justify-center"
        >
          {status === 'idle' || status === 'success' || status === 'error' ? (
            <><Play className="w-4 h-4 fill-current" /> Acionar Caçador de Empresas Agora</>
          ) : (
            <><Loader2 className="w-4 h-4 animate-spin" /> Agente Trabalhando...</>
          )}
        </button>

        {/* Status Tracker Indicator */}
        <div className="flex items-center gap-4 text-xs font-mono w-full md:w-auto bg-slate-950 px-4 py-2.5 rounded-lg border border-slate-800">
          <span className={`flex items-center gap-1 ${status === 'idle' || status === 'success' ? 'text-slate-500' : 'text-purple-400'}`}>
            <div className={`w-2 h-2 rounded-full ${status === 'sweeping' ? 'bg-purple-500 animate-pulse' : 'bg-slate-700'}`} /> Varredura
          </span>
          <span className={`flex items-center gap-1 ${status === 'idle' || status === 'sweeping' ? 'text-slate-500' : 'text-indigo-400'}`}>
            <div className={`w-2 h-2 rounded-full ${status === 'enriching' ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`} /> Enriquecimento
          </span>
          <span className={`flex items-center gap-1 ${status === 'idle' || status === 'sweeping' || status === 'enriching' ? 'text-slate-500' : 'text-emerald-400'}`}>
            <div className={`w-2 h-2 rounded-full ${status === 'saving' || status === 'success' ? 'bg-emerald-500' : 'bg-slate-700'}`} /> Persistência
          </span>
        </div>
      </div>

      {/* Terminal Visual (Logs) */}
      {logs.length > 0 && (
        <div className="mt-6 bg-black/50 border border-slate-800 rounded-lg p-4 font-mono text-xs text-green-400 h-32 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className="mb-1">{log}</div>
          ))}
          {status === 'success' && (
            <div className="mt-2 text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> CICLO DO CAÇADOR FINALIZADO.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LeadHunterPanel;
