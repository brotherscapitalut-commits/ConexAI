import { useEffect, useRef, useState } from "react";
import { useSpring, useMotionValueEvent } from "framer-motion";
import { cn } from "@/lib/utils";

interface OledCounterProps {
  value: number;
  /** Total de dígitos exibidos. Zeros à esquerda ficam "apagados", como num display real. */
  digits?: number;
  /** Sufixo curto exibido ao lado do número (ex.: "px", "%"). */
  suffix?: string;
  prefix?: string;
  className?: string;
}

/**
 * Contador com estética de display OLED de hardware premium.
 *
 * Dois detalhes vendem a ilusão de "display físico":
 *  1. Largura fixa de dígitos — o número nunca reflui ao contar, porque
 *     zeros à esquerda são renderizados apagados em vez de omitidos.
 *  2. Contagem por spring (não linear) — desacelera na chegada, como um
 *     mecanismo assentando, em vez do tick robótico de um setInterval.
 */
export function OledCounter({ value, digits = 6, suffix, prefix, className }: OledCounterProps) {
  const [display, setDisplay] = useState(0);
  const spring = useSpring(0, { stiffness: 90, damping: 24, mass: 0.9 });
  const mounted = useRef(false);

  useEffect(() => {
    // Primeiro valor: anima de 0 para dar o "boot" do display.
    // Valores seguintes: anima do atual, sem resetar.
    spring.set(value);
    mounted.current = true;
  }, [value, spring]);

  useMotionValueEvent(spring, "change", (latest) => {
    setDisplay(Math.round(latest));
  });

  const raw = Math.max(0, Math.round(display)).toString();
  const padded = raw.padStart(digits, "0");
  const firstLit = padded.length - raw.length;

  return (
    <span
      className={cn("oled-display animate-oled-flicker inline-flex items-baseline gap-[0.15em]", className)}
      // Leitores de tela recebem o valor real, não a sequência de dígitos
      aria-label={`${prefix ?? ""}${value.toLocaleString("en-US")}${suffix ?? ""}`}
      role="status"
    >
      {prefix && <span className="opacity-60">{prefix}</span>}

      <span aria-hidden className="inline-flex">
        {padded.split("").map((d, i) => (
          <span
            key={i}
            className={cn(
              "inline-block text-center tabular-nums",
              // Zeros à esquerda: apagados, mas ocupando espaço
              i < firstLit && value > 0 && "oled-display__ghost"
            )}
            style={{ width: "0.62em" }}
          >
            {d}
          </span>
        ))}
      </span>

      {suffix && <span className="text-[0.62em] opacity-70">{suffix}</span>}
    </span>
  );
}

export default OledCounter;
