import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Zap, Users, Star, Layers, TrendingUp } from "lucide-react";
import type { MuralBrand } from "@/lib/mural/types";

interface TilePreviewCardProps {
  brand: MuralBrand | null;
  coordinate?: string | null;
  position: { x: number; y: number };
  isDragging: boolean;
}

const CARD_W = 300;
const CARD_H = 226;
const GUTTER = 18;

/**
 * Engajamento estimado: cliques na última hora projetados sobre a base de
 * seguidores. Quando não há base de seguidores (marcas, tipicamente), usa
 * cliques por bloco ocupado — mede o retorno da posição no mural, que é a
 * métrica que interessa a um anunciante.
 */
function engagementLabel(brand: MuralBrand): { value: string; caption: string } {
  const followers = brand.followers_count ?? 0;
  if (followers > 0) {
    const rate = Math.min(99, ((brand.clicks_last_hour ?? 0) / followers) * 100 * 24);
    return { value: `${rate.toFixed(1)}%`, caption: "engmt" };
  }
  const blocks = Math.max(1, brand.blocks?.length ?? 1);
  return { value: Math.round((brand.clicks ?? 0) / blocks).toLocaleString("en-US"), caption: "clicks/blk" };
}

function formatJoined(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function normalizeUrl(website?: string): string | null {
  if (!website) return null;
  const trimmed = website.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Card flutuante revelado no hover de um módulo do mural.
 *
 * Diferente de um tooltip 2D, o card entra com rotação em X e translação
 * em Z: ele "descola" do plano do grid em direção ao observador. O logo
 * é renderizado em alta resolução (não a versão rasterizada do canvas),
 * porque no canvas o logo é desenhado no tamanho do tile — aqui temos
 * espaço para mostrá-lo de verdade.
 */
export function TilePreviewCard({ brand, coordinate, position, isDragging }: TilePreviewCardProps) {
  const [logoOk, setLogoOk] = useState(true);
  const lastBrandId = useRef<string | null>(null);

  // Reseta o estado de erro do logo ao trocar de marca
  useEffect(() => {
    if (brand?.id !== lastBrandId.current) {
      lastBrandId.current = brand?.id ?? null;
      setLogoOk(true);
    }
  }, [brand?.id]);

  const visible = Boolean(brand) && !isDragging;
  const url = normalizeUrl(brand?.website);
  const engagement = brand ? engagementLabel(brand) : { value: "—", caption: "engmt" };
  const joined = formatJoined(brand?.joinedAt);
  const isInfluencer = brand?.mural_type === "influencers";

  // Flip inteligente: o card nunca sai da viewport
  const flipX = position.x + CARD_W + GUTTER * 2 > window.innerWidth;
  const flipY = position.y + CARD_H + GUTTER * 2 > window.innerHeight;
  const left = flipX ? Math.max(GUTTER, position.x - CARD_W - GUTTER) : position.x + GUTTER;
  const top = flipY ? Math.max(GUTTER, position.y - CARD_H - GUTTER) : position.y + GUTTER;

  return (
    <AnimatePresence>
      {visible && brand && (
        <motion.div
          className="pointer-events-none fixed z-[120]"
          style={{ left, top, width: CARD_W, perspective: 900 }}
          initial={{ opacity: 0, scale: 0.94, rotateX: -10, y: 8 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, rotateX: -6, y: 4 }}
          transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.6 }}
        >
          {/* Anel de borda neon gradiente: wrapper externo de 1px */}
          <div
            style={{
              borderRadius: 20,
              padding: 1,
              background: `linear-gradient(135deg, ${brand.color}99 0%, ${brand.color}33 40%, rgba(124,58,237,0.55) 70%, ${brand.color}77 100%)`,
              boxShadow: [
                `0 0 28px ${brand.color}55`,
                `0 0 60px ${brand.color}22`,
                `0 0 100px rgba(124,58,237,0.15)`,
                `0 24px 56px rgba(0,0,0,0.75)`,
              ].join(", "),
            }}
          >
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: 19,
              background: isInfluencer
                ? "rgba(12,5,22,0.95)"
                : "rgba(5,8,12,0.95)",
              backdropFilter: "blur(24px)",
            }}
          >
            {/* Faixa de luz superior — mais espessa, com glow */}
            <div
              style={{
                height: 3,
                background: `linear-gradient(90deg, transparent 0%, ${brand.color} 40%, ${brand.color} 60%, transparent 100%)`,
                boxShadow: `0 0 12px ${brand.color}99, 0 0 24px ${brand.color}44`,
              }}
            />

            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Chip 3D do logo — mesma linguagem visual dos tiles do mural */}
                <div
                  className="tile-3d relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden text-sm font-bold text-white"
                  style={{
                    background: `linear-gradient(145deg, ${brand.color}, ${brand.color}99)`,
                  }}
                  data-lifted="true"
                >
                  {brand.logo_url && logoOk ? (
                    <img
                      src={brand.logo_url}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={() => setLogoOk(false)}
                      loading="eager"
                      decoding="async"
                    />
                  ) : (
                    <span className="relative z-10">{brand.logo}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate font-ui text-[15px] font-bold leading-tight text-white">
                      {brand.name}
                    </h3>
                    {brand.isPerpetual && (
                      <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-ui text-[12px] text-white/45">
                    {brand.category}
                    {isInfluencer && " · Influencer"}
                  </p>
                  {joined && (
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">
                      since {joined}
                    </p>
                  )}
                </div>
              </div>

              {/* Métricas em mono — grid com accent color do topo */}
              <div
                className="mt-3.5 grid grid-cols-4 gap-px overflow-hidden rounded-xl"
                style={{
                  border: `1px solid ${brand.color}20`,
                  background: `${brand.color}06`,
                }}
              >
                <Metric icon={<Layers className="h-3 w-3" />} label="blocks" value={brand.blocks.length} accentColor={brand.color} />
                <Metric icon={<Zap className="h-3 w-3" />} label="clicks" value={brand.clicks} compact accentColor={brand.color} />
                <Metric
                  icon={<Users className="h-3 w-3" />}
                  label="reach"
                  value={brand.followers_count ?? 0}
                  compact
                  accentColor={brand.color}
                />
                <Metric
                  icon={<TrendingUp className="h-3 w-3" />}
                  label={engagement.caption}
                  display={engagement.value}
                  accentColor={brand.color}
                />
              </div>

              {/* Rodapé: coordenada + destino do link */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] tracking-[0.16em] text-white/35">
                  {coordinate ?? "—"}
                </span>
                {url && (
                  <span
                    className="inline-flex max-w-[62%] items-center gap-1 truncate rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-tight"
                    style={{
                      color: brand.color,
                      borderColor: `${brand.color}33`,
                      background: `${brand.color}12`,
                    }}
                  >
                    <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
                    <ArrowUpRight className="h-3 w-3 shrink-0" />
                  </span>
                )}
              </div>
            </div>
          </div>
          </div>{/* /neon border wrapper */}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Metric({
  icon,
  label,
  value,
  display,
  compact,
  accentColor,
}: {
  icon: React.ReactNode;
  label: string;
  /** Valor numérico, formatado automaticamente. Ignorado se `display` vier. */
  value?: number;
  /** Valor já formatado (percentuais, razões). */
  display?: string;
  compact?: boolean;
  accentColor?: string;
}) {
  const n = value ?? 0;
  const shown =
    display ??
    (compact && n >= 1000
      ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
      : n.toLocaleString("en-US"));

  return (
    <div className="flex flex-col items-center gap-0.5 px-1 py-2" style={{ background: "rgba(255,255,255,0.015)" }}>
      <span style={{ color: accentColor ? `${accentColor}bb` : "rgba(255,255,255,0.25)" }}>{icon}</span>
      <span className="font-mono text-[11px] font-medium tabular-nums" style={{ color: "rgba(255,255,255,0.85)" }}>{shown}</span>
      <span className="font-ui text-[8px] uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.28)" }}>{label}</span>
    </div>
  );
}

export default TilePreviewCard;
