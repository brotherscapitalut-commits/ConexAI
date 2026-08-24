import React, { useState } from 'react';
import { useMuralConfigStore } from '@/store/useMuralConfigStore';

export function AdminMuralConfig() {
  const config = useMuralConfigStore();
  
  const [premiumX1, setPremiumX1] = useState(config.premiumZone.x1);
  const [premiumX2, setPremiumX2] = useState(config.premiumZone.x2);
  const [premiumY1, setPremiumY1] = useState(config.premiumZone.y1);
  const [premiumY2, setPremiumY2] = useState(config.premiumZone.y2);
  
  const [scarcityMult, setScarcityMult] = useState(config.scarcityMultiplier);

  const handleSave = () => {
    config.updatePremiumZone({ x1: premiumX1, x2: premiumX2, y1: premiumY1, y2: premiumY2 });
    config.updateScarcityMultiplier(scarcityMult);
    alert('Configurações do Mural atualizadas com sucesso em tempo real!');
  };

  const handleReset = () => {
    config.resetToDefaults();
    const state = useMuralConfigStore.getState();
    setPremiumX1(state.premiumZone.x1);
    setPremiumX2(state.premiumZone.x2);
    setPremiumY1(state.premiumZone.y1);
    setPremiumY2(state.premiumZone.y2);
    setScarcityMult(state.scarcityMultiplier);
  };

  return (
    <div className="space-y-6 bg-slate-900/50 border border-slate-800 p-6 rounded-xl text-slate-300">
      <div>
        <h2 className="text-xl font-bold text-white mb-2">Motor Cartográfico Dinâmico</h2>
        <p className="text-sm text-slate-400 mb-6">Ajuste as zonas e multiplicadores de escassez sem necessidade de deploy. As alterações afetam clientes conectados instantaneamente.</p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Zona Premium */}
        <div className="space-y-4">
          <h3 className="font-semibold text-emerald-400">Dimensões: Centro Premium</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1">X Inicial (Coluna)</label>
              <input type="number" value={premiumX1} onChange={e => setPremiumX1(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white" />
            </div>
            <div>
              <label className="block text-xs mb-1">X Final (Coluna)</label>
              <input type="number" value={premiumX2} onChange={e => setPremiumX2(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white" />
            </div>
            <div>
              <label className="block text-xs mb-1">Y Inicial (Linha)</label>
              <input type="number" value={premiumY1} onChange={e => setPremiumY1(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white" />
            </div>
            <div>
              <label className="block text-xs mb-1">Y Final (Linha)</label>
              <input type="number" value={premiumY2} onChange={e => setPremiumY2(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white" />
            </div>
          </div>
        </div>

        {/* Regras Financeiras */}
        <div className="space-y-4">
          <h3 className="font-semibold text-amber-400">Motor Financeiro & Escassez</h3>
          <div>
            <label className="block text-xs mb-1">Multiplicador de Escassez (Micro-blocos Premium)</label>
            <input 
              type="number" 
              step="0.1" 
              value={scarcityMult} 
              onChange={e => setScarcityMult(Number(e.target.value))} 
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white" 
            />
            <p className="text-xs text-slate-500 mt-2">Se sobrarem espaços apertados de 1-2 blocos entre corporações, o valor base será multiplicado por este fator para refletir altíssima demanda.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 pt-4 border-t border-slate-800">
        <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-6 rounded transition">
          Aplicar Configurações no Motor
        </button>
        <button onClick={handleReset} className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-6 rounded transition">
          Restaurar Padrões
        </button>
      </div>
    </div>
  );
}
