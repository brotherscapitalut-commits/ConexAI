import { useState, useEffect, type ReactNode } from "react";
import { localDb } from "@/lib/localDbClient";

type MuralKind = "empresas" | "influencers";

export const defaultPulseItems = [
  "PULSE: 90% das ofertas feitas pelo Bid são aceitas em menos de 24h...",
  "URGENTE: Setor de tecnologia lidera os lances da semana com +15% de valorização...",
  "DICA: Use o Bid para conquistar posições centrais e aumentar sua visibilidade em 3x...",
  "SOCIAL: Nova tendência detectada no nicho Lifestyle — marcas de luxo buscam micro-influenciadores...",
];

interface MuralShellProps {
  active: MuralKind;
  sidebar?: ReactNode;
  children: ReactNode;
  pulseItems?: string[];
  /**
   * Exibe a barra PULSE no rodapé. Desligada na tela principal do mural,
   * onde só os blocos das marcas devem competir por atenção.
   */
  showPulse?: boolean;
}

/** Casca do mural: sub-navegação, coluna principal + sidebar, PULSE opcional no rodapé (ticker infinito). */
export function MuralShell({ active, sidebar, children, pulseItems = [], showPulse = true }: MuralShellProps) {
  const [dynamicPulse, setDynamicPulse] = useState<string[]>([]);

  useEffect(() => {
    // Sem a barra visível não há motivo para manter o polling de 15s aberto
    if (!showPulse) return;
    const fetchPulse = async () => {
      const { data } = await localDb.from("pulse_events").select("content").order("created_at", { ascending: false }).limit(5);
      if (data && Array.isArray(data) && data.length > 0) {
        setDynamicPulse(data.map((d: any) => d.content));
      }
    };
    fetchPulse();
    const interval = setInterval(fetchPulse, 15000);
    return () => clearInterval(interval);
  }, [showPulse]);

  const items = dynamicPulse.length > 0 ? [...dynamicPulse, ...pulseItems, ...defaultPulseItems] : (pulseItems.length ? pulseItems : defaultPulseItems);
  const doubled = [...items, ...items];

  const isInfluencer = active === "influencers";

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      {/*
        O alternador de murais saiu daqui e passou a viver dentro da
        MuralNavbar: aqui ele era `absolute` sobre o palco e cobria os
        blocos dos anunciantes.
      */}
      <div className={`flex min-h-0 flex-1 overflow-hidden w-full !max-w-none ${showPulse ? "pb-[3.25rem]" : ""}`}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden w-full !max-w-none">{children}</div>
        {sidebar && (
          <aside className={`hidden w-[min(100%,320px)] shrink-0 overflow-y-auto border-l backdrop-blur-md xl:block xl:w-80 ${
            isInfluencer
              ? "border-fuchsia-500/10 bg-[#0a040f]/80"
              : "border-white/[0.07] bg-[#050505]/80"
          }`}>
            {sidebar}
          </aside>
        )}
      </div>

      {/* PULSE bar — themed per mural type */}
      {showPulse && (
      <div className={`fixed bottom-0 left-0 right-0 z-[60] border-t backdrop-blur-xl ${
        isInfluencer
          ? "border-fuchsia-500/20 bg-[#0a040f]/90"
          : "border-primary/20 bg-black/90"
      }`}>
        <div className="flex w-full items-center gap-4 px-4 py-3 text-sm">
          <span className={`shrink-0 rounded px-3 py-1 font-display text-[10px] font-black uppercase tracking-[0.3em] ${
            isInfluencer
              ? "bg-fuchsia-500/20 text-fuchsia-400 shadow-[0_0_15px_rgba(217,70,239,0.3)]"
              : "bg-primary/20 text-primary shadow-[0_0_15px_rgba(34,197,94,0.3)]"
          }`}>
            {isInfluencer ? "✦ Influencer Pulse" : "⬡ Nexus Pulse"}
          </span>
          {/*
            `min-w-0` é o que impede a barra PULSE de esticar a página.
            O ticker interno usa `w-max` e contém dezenas de mensagens
            duplicadas — facilmente 2500px de largura. Um item flex tem
            `min-width: auto` por padrão, ou seja, NÃO encolhe abaixo da
            largura do próprio conteúdo, mesmo com `flex-1` e
            `overflow-hidden`. Resultado: a barra fixa passava a medir a
            largura do ticker, estourava a viewport e criava aquela barra
            de rolagem horizontal na página inteira.
          */}
          <div className="min-h-[1.5rem] min-w-0 flex-1 overflow-hidden">
            <div className="flex w-max animate-[ticker_60s_linear_infinite] whitespace-nowrap font-mono text-[12px] font-bold tracking-tight uppercase">
              {doubled.map((item, idx) => (
                <span key={`pulse-${idx}`} className="inline-flex items-center gap-4 pr-12">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    isInfluencer
                      ? "bg-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,0.8)]"
                      : "bg-primary shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                  }`} />
                  <span className="text-white/80">{item.split(":")[0]}:</span>
                  <span className={isInfluencer ? "text-fuchsia-400" : "text-primary"}>{item.split(":")[1] || ""}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
