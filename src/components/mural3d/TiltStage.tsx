import { useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TiltStageProps {
  children: ReactNode;
  /** Amplitude máxima da rotação, em graus. Sutil por padrão. */
  maxTilt?: number;
  /** Desativa o efeito (ex.: durante drag do mural, ou em telas pequenas). */
  disabled?: boolean;
  className?: string;
}

/**
 * Palco 3D com parallax tilt.
 *
 * Envolve qualquer conteúdo (inclusive um <canvas>) em uma camada com
 * `perspective` e aplica uma rotação sutil seguindo o cursor — o mesmo
 * princípio de "gyro tilt" usado em cenas Spline, mas via CSS 3D puro,
 * sem custo de WebGL.
 *
 * Implementação: o cursor é lido em um listener passivo e escrito direto
 * em CSS custom properties via `style.setProperty`, dentro de um rAF.
 * Isso mantém o efeito fora do ciclo de render do React — zero re-renders
 * durante o movimento, o que importa porque o filho é um canvas rodando
 * seu próprio loop de rAF a 60fps.
 */
export function TiltStage({ children, maxTilt = 2.4, disabled = false, className }: TiltStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!stage || !layer) return;

    // Respeita a preferência de sistema por menos movimento
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (disabled || reduced) {
      layer.style.setProperty("--tilt-x", "0deg");
      layer.style.setProperty("--tilt-y", "0deg");
      return;
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // Normaliza para [-1, 1] a partir do centro do palco
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      // Y do cursor inclina em X (e vice-versa) — é o que dá sensação de mesa
      target.current = { x: -ny * maxTilt * 2, y: nx * maxTilt * 2 };
    };

    const onPointerLeave = () => {
      target.current = { x: 0, y: 0 };
    };

    // Lerp para suavizar: o tilt "persegue" o alvo em vez de saltar
    const tick = () => {
      const c = current.current;
      const t = target.current;
      c.x += (t.x - c.x) * 0.08;
      c.y += (t.y - c.y) * 0.08;
      layer.style.setProperty("--tilt-x", `${c.x.toFixed(3)}deg`);
      layer.style.setProperty("--tilt-y", `${c.y.toFixed(3)}deg`);
      rafRef.current = requestAnimationFrame(tick);
    };

    // Escuta na janela, não no próprio palco: assim o TiltStage pode ser
    // usado como camada decorativa com `pointer-events: none` (necessário
    // quando ele fica sobre/atrás de um canvas que precisa receber os
    // eventos de pan e clique).
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerLeave, { passive: true });
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [maxTilt, disabled]);

  return (
    <div ref={stageRef} className={cn("stage-3d relative h-full w-full", className)}>
      {/* Iluminação ambiente do palco, atrás do conteúdo */}
      <div className="stage-3d__ambient ambient-breathe" aria-hidden />

      <div
        ref={layerRef}
        className="stage-3d__layer relative h-full w-full"
        // A transição do CSS cobre o retorno ao repouso; o rAF cobre o movimento
        style={{ transitionDuration: "0ms" }}
      >
        {children}
      </div>
    </div>
  );
}

export default TiltStage;
