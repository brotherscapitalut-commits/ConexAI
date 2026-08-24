import React, { useState } from 'react';

export const AdminInfluencerManager: React.FC = () => {
  const [influencers, setInfluencers] = useState([
    { id: '1', name: 'Lucas Tech & Business', platform: 'YouTube / LinkedIn', followers: '150k', status: 'INVITED', email: 'lucas@techbusiness.co' },
    { id: '2', name: 'Camila Growth & Marketing', platform: 'Instagram / TikTok', followers: '85k', status: 'ACTIVE_AMBASSADOR', email: 'contato@camilagrowth.com' }
  ]);

  const [isScanning, setIsScanning] = useState(false);

  const handleScanInfluencers = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      alert('🔍 Nova varredura concluída! 2 novos influenciadores qualificados adicionados ao pipeline.');
    }, 1000);
  };

  return (
    <div className="space-y-6 text-white">
      <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-950 border border-purple-500/30 p-6 rounded-2xl shadow-xl flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black">Gestão de Influenciadores & Embaixadores</h2>
          <p className="text-xs text-slate-300 mt-1">Mapeie criadores, dispare abordagens automatizadas por IA e acompanhe conversões de comissão.</p>
        </div>
        <button
          onClick={handleScanInfluencers}
          disabled={isScanning}
          className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition disabled:opacity-50 flex items-center gap-2"
        >
          {isScanning ? 'Varrendo Redes...' : '🌐 Varrer Novos Influenciadores'}
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-sm font-bold text-slate-300 mb-4">Embaixadores e Criadores Cadastrados</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3">Influenciador</th>
                <th className="pb-3">Plataforma</th>
                <th className="pb-3">Seguidores</th>
                <th className="pb-3">E-mail de Contato</th>
                <th className="pb-3">Status da Parceria</th>
                <th className="pb-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {influencers.map((inf) => (
                <tr key={inf.id} className="hover:bg-slate-800/40">
                  <td className="py-3.5 font-bold text-white">{inf.name}</td>
                  <td className="py-3.5 text-slate-300">{inf.platform}</td>
                  <td className="py-3.5 font-mono text-purple-300">{inf.followers}</td>
                  <td className="py-3.5 text-slate-400 font-mono">{inf.email}</td>
                  <td className="py-3.5">
                    {/*
                      Estava `className={px-2.5 ...}` sem as crases do template
                      literal — JSX inválido. Era a razão real de a tela de
                      Influencers não renderizar: o roteamento sempre esteve
                      correto, mas o módulo não compilava, então o `lazy()`
                      falhava ao carregá-lo e a área principal ficava vazia.
                    */}
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono ${
                        inf.status === "ACTIVE_AMBASSADOR"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : inf.status === "INVITED"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-slate-700/40 text-slate-300"
                      }`}
                    >
                      {inf.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    <button onClick={() => alert('Enviando material de campanha personalizado gerado por IA para ' + inf.name)} className="px-3 py-1 bg-slate-800 hover:bg-purple-600 text-slate-200 hover:text-white rounded-lg transition font-mono text-[11px]">
                      ✨ Enviar Copy IA
                    </button>
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

export default AdminInfluencerManager;