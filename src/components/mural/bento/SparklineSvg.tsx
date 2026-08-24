import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

/** Linha de interesse estável por id — sparkline decorativa (não é dado financeiro real). */
export function SparklineSvg({ seed, accent = "emerald", className }: { seed: string; accent?: "emerald" | "fuchsia"; className?: string }) {
  const gid = useId().replace(/:/g, "");
  const stroke = accent === "fuchsia" ? "rgb(232 121 249)" : "rgb(52 211 153)";
  const fillFrom = accent === "fuchsia" ? "rgb(232 121 249)" : "rgb(52 211 153)";

  const pathD = useMemo(() => {
    const h0 = hashSeed(seed);
    const n = 28;
    const w = 120;
    const h = 28;
    const vals: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = (h0 + i * 9973) % 1000;
      const wave = Math.sin(i * 0.42 + (h0 % 11) * 0.15) * 0.22;
      const v = 0.38 + wave + (t / 1000) * 0.28 + (i / n) * 0.08;
      vals.push(Math.min(0.92, Math.max(0.18, v)));
    }
    return vals
      .map((v, i) => {
        const x = (i / (n - 1)) * w;
        const y = h - v * (h - 4) - 2;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [seed]);

  const fillPath = `${pathD} L 120 28 L 0 28 Z`;

  return (
    <svg className={cn("h-7 w-full max-w-[140px] opacity-90", className)} viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`sf-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillFrom} stopOpacity="0.28" />
          <stop offset="100%" stopColor={fillFrom} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#sf-${gid})`} />
      <path d={pathD} fill="none" stroke={stroke} strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}
