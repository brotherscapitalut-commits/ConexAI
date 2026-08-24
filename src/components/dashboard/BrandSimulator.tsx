import React, { useState } from 'react';
import { ShieldCheck, Zap, Globe, Building, Mail } from 'lucide-react';
import { STRIPE_CONFIG } from '../../lib/stripeConfig';

interface BrandSimulatorProps {
  onCheckoutSuccess?: () => void;
}

export const BrandSimulator: React.FC<BrandSimulatorProps> = ({ onCheckoutSuccess }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'standard' | 'premium'>('standard');
  const [blockCount, setBlockCount] = useState<number>(7);
  
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const planDetails = STRIPE_CONFIG.plans[selectedPlan];

  const calculateTotal = () => {
    const base = planDetails.baseAmountUsd;
    const perBlock = planDetails.blockAmountUsd;
    const extraBlocks = Math.max(0, blockCount - planDetails.minBlocks);
    return (base + (extraBlocks * perBlock)).toFixed(2);
  };

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleStartCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      if (!companyName.trim()) {
        throw new Error('Por favor, informe o nome da marca para continuar.');
      }
      // O e-mail é obrigatório: é a chave do auto-provisionamento — o
      // servidor cria a conta e a empresa "PENDING_PAYMENT" nesse endereço no
      // instante do checkout, sem pedir cadastro ou login antes de pagar.
      if (!isValidEmail(companyEmail)) {
        throw new Error('Informe um e-mail válido — é para onde enviamos o acesso após o pagamento.');
      }

      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planType: selectedPlan,
          blocksCount: blockCount,
          companyName,
          email: companyEmail,
          website: companyWebsite || 'https://conexai.app',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // O servidor responde com { error: { message } }, não { error: string }
        // — usar `data.error` direto aqui virava um `new Error({...})`, que
        // renderiza como "[object Object]" e esconde a causa real do erro.
        throw new Error(data?.error?.message || data?.error || 'Erro ao iniciar o pagamento.');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL de checkout não retornada pelo servidor.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado ao processar.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-center my-6">
        <button
          onClick={() => setIsOpen(true)}
          className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:opacity-95 transition-all flex items-center gap-3 text-lg cursor-pointer"
        >
          <Zap className="w-5 h-5" /> Resgatar Meu Bloco (7 Dias Grátis)
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 text-white shadow-2xl relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white text-xl cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" /> Preparar Publicação no Mural
            </h3>
            <p className="text-xs text-zinc-400 mb-6">
              Garantia de 7 dias grátis. Insira seus dados para ativar o território instantaneamente.
            </p>

            <form onSubmit={handleStartCheckout} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Plano Selecionado</label>
                <select
                  value={selectedPlan}
                  onChange={(e) => {
                    const plan = e.target.value as 'basic' | 'standard' | 'premium';
                    setSelectedPlan(plan);
                    setBlockCount(STRIPE_CONFIG.plans[plan].minBlocks);
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="basic">Basic (Edge) - Base $9.99</option>
                  <option value="standard">Standard (Mid) - Base $20.99</option>
                  <option value="premium">Premium (Prime Center) - Base $49.99</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Quantidade de Blocos ({STRIPE_CONFIG.plans[selectedPlan].minBlocks} a {STRIPE_CONFIG.plans[selectedPlan].maxBlocks})
                </label>
                <input
                  type="number"
                  min={STRIPE_CONFIG.plans[selectedPlan].minBlocks}
                  max={STRIPE_CONFIG.plans[selectedPlan].maxBlocks}
                  value={blockCount}
                  onChange={(e) => setBlockCount(Number(e.target.value))}
                  onBlur={() => {
                    // Sem isso, um número fora da faixa (ex.: 99 blocos num
                    // plano de 6) só seria pego no servidor — o usuário
                    // preencheria tudo, pagaria, e só descobriria o erro
                    // depois de tentar submeter.
                    const { minBlocks, maxBlocks } = planDetails;
                    setBlockCount((n) => Math.min(maxBlocks, Math.max(minBlocks, Number.isFinite(n) ? n : minBlocks)));
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50 flex justify-between items-center text-sm">
                <span className="text-zinc-400">Total com Trial de 7 Dias:</span>
                <span className="text-emerald-400 font-bold text-lg">${calculateTotal()} / mês</span>
              </div>

              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-purple-400" /> Nome da Empresa / Marca
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Minha Empresa LLC"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-purple-400" /> E-mail do Responsável
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="voce@sualocacao.com"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Sua conta é criada automaticamente com este e-mail — sem cadastro prévio.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-purple-400" /> Website / Link de Destino
                  </label>
                  <input
                    type="text"
                    placeholder="https://sualoja.com"
                    value={companyWebsite}
                    onChange={(e) => setCompanyWebsite(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-900/50 border border-red-700 text-red-200 text-xs rounded-lg">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Preparando Sessão Segura...' : 'Ir para o Checkout Seguro ➔'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandSimulator;