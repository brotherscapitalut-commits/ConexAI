/** ConeXai — canvas (#050505) + Neon Glass */

export const MURAL_DEEP_BG = "#050505";

/** Borda metálica 1px: cinza → dourado — aplicar no wrapper externo */
export const neonGlassBorderWrap =
  "rounded-2xl p-px bg-gradient-to-br from-zinc-600/85 via-zinc-800/70 to-amber-500/45 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-[box-shadow] duration-300 ease-out group-hover:shadow-[0_0_26px_rgba(255,215,0,0.28)]";

/** Interior: preto translúcido + blur 20px */
export const neonGlassInner =
  "h-full min-h-0 rounded-[15px] bg-[rgba(0,0,0,0.6)] backdrop-blur-[20px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]";

/** Hover: scale 1.02 no conteúdo interno */
export const neonGlassHoverMotion =
  "transition-[transform,box-shadow] duration-300 ease-out will-change-transform hover:z-10 hover:scale-[1.02]";

/** Legado — cartão único (sem wrapper de borda gradiente) */
export const glassBentoMural =
  "rounded-2xl border border-solid border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.6)] backdrop-blur-[20px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]";

export const glassBentoHoverInteraction = neonGlassHoverMotion;

/** Brilho Plus / líderes */
export const goldGlowPulse =
  "shadow-[0_0_24px_rgba(255,215,0,0.35),0_0_48px_rgba(255,215,0,0.12)] animate-[goldGlowPulse_2.8s_ease-in-out_infinite]";

export const glassBento = glassBentoMural;
export const glassBentoHover = neonGlassHoverMotion;
