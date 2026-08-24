/**
 * Placeholder exibido enquanto o chunk de uma rota é baixado.
 *
 * Deliberadamente sóbrio: um spinner grande e centralizado chamaria mais
 * atenção que o conteúdo que está chegando. Em conexões rápidas o chunk
 * carrega em poucos milissegundos, então o fallback aparece por um instante —
 * um elemento discreto evita o "flash" que um layout completo causaria.
 *
 * O fundo usa o mesmo `stage-void` das telas para não piscar branco/preto
 * entre a saída de uma rota e a entrada da próxima.
 */
export function RouteFallback() {
  return (
    <div
      className="flex min-h-[100dvh] w-full items-center justify-center bg-stage-void"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-9 w-9 rounded-xl"
          style={{
            background: "linear-gradient(145deg, hsl(var(--stream-core)), hsl(var(--stream-halo)))",
            boxShadow: "0 0 32px -6px hsl(var(--stream-core) / 0.6)",
            animation: "ambient-breathe 1.6s ease-in-out infinite",
          }}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
          loading
        </span>
      </div>
    </div>
  );
}

export default RouteFallback;
