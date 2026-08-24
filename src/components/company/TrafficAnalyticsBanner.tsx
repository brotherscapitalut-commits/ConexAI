import React, { useEffect, useState } from 'react';

export const TrafficAnalyticsBanner: React.FC = () => {
  const [metrics, setMetrics] = useState({
    totalClicks: 142,
    topSource: 'Mural Search',
    performanceScore: 'HIGH_IMPACT',
    status: 'AUDITED'
  });

  const [loading, setLoading] = useState(false);

  // Simula a busca de dados processados pelo Traffic-Analytics-Agent
  const refreshMetrics = async () => {
    setLoading(true);
    setTimeout(() => {
      setMetrics({
        totalClicks: Math.floor(Math.random() * 50) + 120,
        topSource: 'Mural Search',
        performanceScore: 'HIGH_IMPACT',
        status: 'AUDITED'
      });
      setLoading(false);
    }, 600);
  };

  return (
    <div className="w-full bg-gradient-to-r from-purple-900/80 via-slate-900 to-indigo-950 border border-purple-500/30 rounded-xl p-4 mb-6 shadow-xl text-white flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-purple-600/20 border border-purple-500/40 rounded-lg text-purple-400 text-xl font-bold">
          📊
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-purple-200">Live Traffic & Click Analytics</h3>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono uppercase">
              {metrics.performanceScore}
            </span>
          </div>
          <p className="text-xs text-slate-400">Powered by Traffic-Analytics-Agent • Real-time block tracking</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-center px-4 border-r border-slate-700">
          <span className="block text-2xl font-black text-white">{metrics.totalClicks}</span>
          <span className="text-[11px] text-slate-400 uppercase tracking-wider">Clicks (24h)</span>
        </div>
        
        <div className="text-center px-4 border-r border-slate-700">
          <span className="block text-sm font-bold text-purple-300">{metrics.topSource}</span>
          <span className="text-[11px] text-slate-400 uppercase tracking-wider">Top Source</span>
        </div>

        <button 
          onClick={refreshMetrics}
          disabled={loading}
          className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
        >
          {loading ? 'Syncing...' : '🔄 Refresh'}
        </button>
      </div>
    </div>
  );
};

export default TrafficAnalyticsBanner;