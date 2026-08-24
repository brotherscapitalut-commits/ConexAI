import { Link } from "react-router-dom";
import { MOCK_INFLUENCERS, getInfluencerRankScore, type MuralInfluencer } from "@/data/influencerMockData";
import type { MuralBrand } from "@/lib/mural/types";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { SparklineSvg } from "@/components/mural/bento/SparklineSvg";
import { neonGlassBorderWrap, neonGlassInner } from "@/components/mural/bento/bentoTokens";

function scoreBrand(b: MuralBrand): number {
  const bids = b.blocks?.length ?? 0;
  const deals = b.completed_deals ?? 0;
  return (b.isPerpetual ? 1000 : 0) + bids * 10 + deals * 5 + (b.clicks ?? 0) * 0.01;
}

/** Índice de atividade no mural (cliques normalizados) — não é taxa de engajamento medida. */
function activityIndex(inf: MuralInfluencer): number {
  const c = inf.clicks ?? 0;
  return Math.min(100, Math.round(Math.log10(c + 10) * 28));
}

interface MuralRightSidebarProps {
  mode: "empresas" | "influencers";
  brands: MuralBrand[];
}

export function MuralRightSidebar({ mode, brands }: MuralRightSidebarProps) {
  const topInfluencers = [...MOCK_INFLUENCERS]
    .sort((a, b) => getInfluencerRankScore(b) - getInfluencerRankScore(a))
    .slice(0, 5);

  const topBrands = [...brands].sort((a, b) => scoreBrand(b) - scoreBrand(a)).slice(0, 3);
  const podiumReady = topBrands.length >= 3;
  const podiumOrder: [MuralBrand, MuralBrand, MuralBrand] | null = podiumReady
    ? [topBrands[1], topBrands[0], topBrands[2]]
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-2 font-body sm:gap-4 sm:p-3">
      <div className={cn(neonGlassBorderWrap, "group")}>
        <div className={cn(neonGlassInner, "p-3")}>
          <p className="mb-2.5 font-display text-[10px] font-semibold uppercase tracking-wider text-white/40">Mini-mural</p>
          <div className="flex max-h-[240px] flex-col gap-2 overflow-y-auto pr-0.5">
            {topInfluencers.map((inf) => {
              const niches = [inf.category, ...(inf.interest_categories ?? []).slice(0, 1)].filter(Boolean);
              return (
                <Link
                  key={inf.id}
                  to="/influencers"
                  className="group/row block rounded-xl border border-white/[0.08] bg-[rgba(0,0,0,0.35)] p-2 backdrop-blur-md transition-[transform,box-shadow] duration-300 hover:scale-[1.02] hover:border-amber-500/25 hover:shadow-[0_0_16px_rgba(255,215,0,0.12)]"
                >
                  <div className="flex gap-2.5">
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.06] bg-cover bg-center font-ui text-[11px] font-semibold text-white/70 ring-1 ring-white/10"
                      style={inf.logo_url ? { backgroundImage: `url(${inf.logo_url})` } : undefined}
                    >
                      {/* Sem foto: monograma sóbrio, nunca avatar cartoon */}
                      {!inf.logo_url && (inf.name || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">{inf.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {niches.map((n) => (
                          <span
                            key={n}
                            className="rounded-full border border-fuchsia-500/25 bg-fuchsia-950/30 px-1.5 py-0.5 text-[9px] font-medium text-fuchsia-200/90"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-white/50">
                        <span>
                          Atividade <span className="tabular-nums text-emerald-400/90">{activityIndex(inf)}</span>
                        </span>
                        <span>
                          Cliques <span className="tabular-nums text-white/75">{(inf.clicks ?? 0).toLocaleString("pt-BR")}</span>
                        </span>
                      </div>
                      <SparklineSvg seed={`side-${inf.id}`} accent="fuchsia" className="mt-1 h-6 max-w-full" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className={cn(neonGlassBorderWrap, "group flex min-h-0 flex-1 flex-col")}>
        <div className={cn(neonGlassInner, "flex flex-1 flex-col p-3")}>
          <div className="mb-2 flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-amber-400" />
            <p className="font-display text-sm font-semibold text-white">Ranking elite</p>
          </div>
          <p className="mb-3 text-[10px] leading-snug text-white/40">
            {mode === "empresas" ? "Pódio por lotes e relevância na bolsa." : "Mesma lógica aplicada às marcas no contexto do mural."}
          </p>

          {podiumOrder ? (
            <div className="flex min-h-[132px] items-end justify-center gap-1.5 px-0.5">
              {[0, 1, 2].map((slot) => {
                const b = podiumOrder[slot as 0 | 1 | 2];
                const place = slot === 0 ? 2 : slot === 1 ? 1 : 3;
                const isFirst = place === 1;
                return (
                  <div
                    key={b.id}
                    className={cn(
                      "flex min-w-0 flex-1 flex-col items-center rounded-t-lg border border-b-0 px-1.5 pt-2 text-center",
                      isFirst
                        ? "max-w-[38%] border-amber-400/45 bg-gradient-to-b from-amber-500/12 to-transparent pb-3 shadow-[0_0_30px_rgba(255,215,0,0.2)]"
                        : "border-white/[0.1] bg-white/[0.03] pb-2",
                      !isFirst && "self-end pb-1.5",
                    )}
                    style={{ minHeight: isFirst ? 132 : 96 }}
                  >
                    <span
                      className={cn(
                        "mb-1 flex h-7 w-7 items-center justify-center rounded-full font-display text-[11px] font-bold",
                        isFirst ? "bg-amber-500/25 text-amber-200" : "bg-white/10 text-white/70",
                      )}
                    >
                      {place}º
                    </span>
                    <div
                      className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                      style={{ backgroundColor: b.color }}
                    >
                      {b.logo?.slice(0, 2) ?? "?"}
                    </div>
                    <p className="w-full truncate text-[10px] font-medium leading-tight text-white">{b.name}</p>
                    <p className="text-[9px] text-emerald-400/90">{b.blocks?.length ?? 0} lotes</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {topBrands.map((b, i) => (
                <div
                  key={b.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-2",
                    i === 0 ? "border-amber-400/40 shadow-[0_0_30px_rgba(255,215,0,0.2)]" : "border-white/[0.08]",
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 font-display text-xs font-bold text-white/80">
                    {i + 1}
                  </span>
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                    style={{ backgroundColor: b.color }}
                  >
                    {b.logo?.slice(0, 2) ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs font-medium text-white">{b.name}</p>
                    <p className="text-[10px] text-emerald-400/90">{b.blocks?.length ?? 0} lotes</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link to="/ranking" className="mt-3 text-center text-[10px] font-medium text-amber-400/90 hover:text-amber-300">
            Ver ranking completo →
          </Link>
        </div>
      </div>
    </div>
  );
}
