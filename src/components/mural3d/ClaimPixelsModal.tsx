import { useMemo, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Gavel, ShieldCheck, Loader2 } from "lucide-react";
import { coordinateToGrid } from "@/lib/mural/MuralEngine";
import { cn } from "@/lib/utils";
import { formatUsd, PLANS } from "@/lib/stripe";
import { regionForBlock } from "@/lib/mural/MuralMarketplace";

export interface ClaimPixelsModalProps {
  blockCoord: string | null;
  price: number | null;
  status: "available" | "auction" | "reserved" | "occupied" | "bid_received";
  auctionInfo?: {
    startingPrice: number;
    highestBid: number;
    auctionEndTime: number;
  } | null;
  open: boolean;
  onReserve: () => void;
  onStartAuction: () => void;
  onClose: () => void;
  /** Redireciona para a página de compra (ex.: dashboard com fluxo de compra) */
  onGoToPurchase?: () => void;
}

const PREVIEW_RADIUS = 4; // 9×9 células ao redor da seleção

const currency = (v: number) => formatUsd(v);

/**
 * Painel de reserva no espírito do Stripe Checkout: uma coluna de contexto
 * (o que você está comprando, mostrado visualmente) e uma coluna de ação
 * (preço, garantias, botão). Substitui o ReserveTerritoryModal — mesma
 * assinatura de props, então é um drop-in.
 */
export function ClaimPixelsModal({
  blockCoord,
  price,
  status,
  auctionInfo,
  open,
  onReserve,
  onStartAuction,
  onClose,
  onGoToPurchase,
}: ClaimPixelsModalProps) {
  const [pending, setPending] = useState<null | "reserve" | "auction" | "purchase">(null);

  // Limpa o estado de loading sempre que o painel reabre
  useEffect(() => {
    if (open) setPending(null);
  }, [open, blockCoord]);

  // Fecha com Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const grid = blockCoord ? coordinateToGrid(blockCoord) : null;
  const region = grid ? regionForBlock(grid.gx, grid.gy) : "borda";
  const plan = PLANS[region];
  const basePrice = plan.baseMonthlyUsd;

  // Vizinhança da célula selecionada — dá contexto espacial à compra
  const preview = useMemo(() => {
    if (!grid) return [];
    const cells: { gx: number; gy: number; isTarget: boolean }[] = [];
    for (let dy = -PREVIEW_RADIUS; dy <= PREVIEW_RADIUS; dy++) {
      for (let dx = -PREVIEW_RADIUS; dx <= PREVIEW_RADIUS; dx++) {
        cells.push({ gx: grid.gx + dx, gy: grid.gy + dy, isTarget: dx === 0 && dy === 0 });
      }
    }
    return cells;
  }, [grid]);

  const isAuction = status === "auction";
  const effectivePrice = isAuction ? auctionInfo?.highestBid ?? price ?? 0 : price ?? 0;

  const blockCount = plan.minBlocks;
  const totalBlockPrice = effectivePrice * blockCount;
  const totalRecurring = basePrice + totalBlockPrice;

  const run = (kind: "reserve" | "auction" | "purchase", fn?: () => void) => {
    if (!fn) return;
    setPending(kind);
    // Deixa o feedback de loading pintar um frame antes de disparar a ação
    requestAnimationFrame(() => fn());
  };

  return (
    <AnimatePresence>
      {open && blockCoord && (
        <motion.div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Claim block ${blockCoord}`}
        >
          {/* Backdrop: escurece e desfoca o palco atrás */}
          <div
            className="absolute inset-0"
            style={{
              background: "hsl(var(--stage-void) / 0.72)",
              backdropFilter: "blur(10px) saturate(120%)",
              WebkitBackdropFilter: "blur(10px) saturate(120%)",
            }}
          />

          <motion.div
            className="glass-panel glass-panel--strong glass-panel--beveled relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl"
            initial={{ opacity: 0, scale: 0.96, y: 16, rotateX: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.7 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[1fr_1.05fr]">
              {/* ── Coluna de contexto: o que você está reservando ── */}
              <div className="border-b border-white/[0.06] p-6 md:border-b-0 md:border-r">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
                  selected position
                </p>
                <p className="mt-1 whitespace-nowrap font-mono text-[30px] font-medium tabular-nums leading-none text-white">
                  {blockCoord}
                </p>
                {/* Rótulo de distrito removido: a grade não expõe mais
                    "Financial District" e afins, e o modal não deve
                    reintroduzir uma taxonomia que saiu do produto. */}

                {/* Minigrid: a célula alvo no seu contexto imediato */}
                <div
                  className="mt-5 grid gap-[3px] rounded-2xl border border-white/[0.06] bg-black/25 p-3"
                  style={{ gridTemplateColumns: `repeat(${PREVIEW_RADIUS * 2 + 1}, minmax(0, 1fr))` }}
                  aria-hidden
                >
                  {preview.map((c) => (
                    <div
                      key={`${c.gx},${c.gy}`}
                      className={cn(
                        "aspect-square rounded-[3px] transition-colors",
                        c.isTarget ? "tile-3d" : "bg-white/[0.035]"
                      )}
                      style={
                        c.isTarget
                          ? {
                              background: "linear-gradient(145deg, hsl(var(--stream-core)), hsl(var(--stream-halo)))",
                              boxShadow: "0 0 14px hsl(var(--stream-core) / 0.7)",
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>

                <p className="mt-3 font-ui text-[11px] leading-relaxed text-white/35">
                  You control the logo, the link and the brand shown at this
                  coordinate for as long as your subscription is active.
                </p>
              </div>

              {/* ── Coluna de ação: preço e confirmação ── */}
              <div className="flex flex-col p-6">
                <div className="flex items-baseline justify-between gap-3 mb-4">
                  <span className="font-ui text-[13px] text-white/50">
                    Order Summary
                  </span>
                  <StatusChip status={status} />
                </div>

                <div className="space-y-2 mb-4 font-mono text-[13px] text-white/70">
                  <div className="flex justify-between items-center">
                    <span>Platform Base</span>
                    <span className="tabular-nums text-white">${basePrice}<span className="text-[10px] text-white/40">/mo</span></span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
                    <span>Blocks ({blockCount}x minimum)</span>
                    <span className="tabular-nums text-white">{currency(totalBlockPrice)}<span className="text-[10px] text-white/40">/mo</span></span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="font-ui text-[12px] uppercase tracking-wider text-white/50">Total Recurring</span>
                    <span className="text-[24px] font-medium text-white tabular-nums">
                      {currency(totalRecurring)}<span className="text-[12px] font-normal text-white/40">/mo</span>
                    </span>
                  </div>
                </div>

                <p className="mt-1 font-ui text-[11px] text-white/35">
                  Recurring monthly subscription. Cancel anytime.
                </p>

                {isAuction && auctionInfo && (
                  <p className="mt-2 font-mono text-[11px] text-white/40">
                    opens at {currency(auctionInfo.startingPrice)} · ends{" "}
                    {new Date(auctionInfo.auctionEndTime).toLocaleString("en-US", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}

                <ul className="mt-5 space-y-2.5">
                  <Perk>Keep your spot for as long as your subscription is active</Perk>
                  <Perk>Edit your logo, link and description anytime</Perk>
                  <Perk>Real-time click and reach metrics</Perk>
                </ul>

                <div className="mt-auto space-y-2 pt-6">
                  <button
                    type="button"
                    disabled={pending !== null}
                    onClick={() =>
                      onGoToPurchase
                        ? run("purchase", onGoToPurchase)
                        : run("reserve", onReserve)
                    }
                    className={cn(
                      "tile-3d flex w-full items-center justify-center gap-2 rounded-tile px-5 py-3.5",
                      "bg-gradient-to-b from-white to-white/85 font-ui text-[14px] font-bold text-stage-void",
                      "disabled:cursor-not-allowed disabled:opacity-60"
                    )}
                  >
                    {pending === "purchase" || pending === "reserve" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Claim {blockCoord}
                  </button>



                  <p className="flex items-center justify-center gap-1.5 pt-1 font-ui text-[10px] text-white/25">
                    <ShieldCheck className="h-3 w-3" />
                    Payments processed with end-to-end encryption
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Perk({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 font-ui text-[12px] leading-snug text-white/55">
      <Check className="mt-[2px] h-3.5 w-3.5 shrink-0 text-stream-core" />
      {children}
    </li>
  );
}

function StatusChip({ status }: { status: ClaimPixelsModalProps["status"] }) {
  const map: Record<ClaimPixelsModalProps["status"], { label: string; className: string }> = {
    available: { label: "available", className: "border-stream-core/30 bg-stream-core/10 text-stream-core" },
    auction: { label: "in auction", className: "border-orange-400/30 bg-orange-400/10 text-orange-300" },
    reserved: { label: "reserved", className: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
    occupied: { label: "taken", className: "border-white/15 bg-white/5 text-white/50" },
    bid_received: { label: "has offer", className: "border-stream-alt/30 bg-stream-alt/10 text-stream-alt" },
  };
  const s = map[status] ?? map.available;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em]",
        s.className
      )}
    >
      {s.label}
    </span>
  );
}

export default ClaimPixelsModal;
