import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, TrendingUp, Zap, ShieldCheck, AlertCircle } from "lucide-react";
import { MuralBiddingService, MIN_BID_MULTIPLIER } from "@/lib/mural/MuralBidding";
import { formatUsd } from "@/lib/stripe";
import { cn } from "@/lib/utils";

interface HostileTakeoverModalProps {
  open: boolean;
  blockCoord: string | null;
  blockId?: string;
  originalPrice: number;
  brandName: string;
  brandId: string;
  myCompanyId: string | null;
  onSubmit: (amount: number) => void;
  onClose: () => void;
}

export const HostileTakeoverModal = ({
  open,
  blockCoord,
  originalPrice,
  brandName,
  onSubmit,
  onClose,
}: HostileTakeoverModalProps) => {
  const stats = useMemo(
    () => MuralBiddingService.calculateBidStats(originalPrice),
    [originalPrice]
  );

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Reabrir o modal precisa restaurar o estado; sem isso o valor digitado
  // numa disputa anterior reaparece na próxima posição.
  useEffect(() => {
    if (open) {
      setSelectedIdx(0);
      setCustomAmount("");
      setSubmitting(false);
    }
  }, [open, blockCoord]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const parsedCustom = parseFloat(customAmount.replace(",", "."));
  const usingCustom = customAmount.trim() !== "" && Number.isFinite(parsedCustom);
  const amount = usingCustom ? parsedCustom : stats.options[selectedIdx]?.value ?? stats.minBid;

  const validation = MuralBiddingService.validateBid(amount, originalPrice);
  const isValid = validation.ok;
  const validationError = validation.error;
  const canSubmit = isValid && !submitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    onSubmit(Math.round(amount));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Bid for position ${blockCoord ?? ""}`}
        >
          <div
            className="absolute inset-0"
            style={{
              background: "hsl(var(--stage-void) / 0.8)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          />

          {/*
            `max-h-[90dvh]` + scroll interno: antes o painel tinha altura
            livre e, em telas menores, o cabeçalho e o botão de confirmação
            ficavam fora da viewport, sem nenhuma forma de alcançá-los.
            `dvh` (e não `vh`) porque no mobile a barra de endereço muda a
            altura visível e `vh` não acompanha.
          */}
          <motion.div
            className="glass-panel glass-panel--strong glass-panel--beveled relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.7 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 z-20 grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2 pt-7">
              {/* ── Cabeçalho ── */}
              <div className="text-center">
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-stream-core">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h2 className="font-ui text-[22px] font-bold tracking-[-0.02em] text-white">
                  Take over this position
                </h2>
                <p className="mx-auto mt-2 max-w-[36ch] font-ui text-[13px] leading-relaxed text-white/45">
                  Offer to buy <span className="font-medium text-white/80">{brandName}</span>&rsquo;s
                  spot at <span className="font-mono text-stream-core">{blockCoord}</span>. If they
                  accept, the block becomes yours.
                </p>
              </div>

              {/* ── Referência de preço ── */}
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                <Stat label="They paid" value={formatUsd(originalPrice)} />
                <Stat
                  label="Minimum bid"
                  value={formatUsd(stats.minBid)}
                  hint={`${MIN_BID_MULTIPLIER}× paid`}
                  accent
                />
              </div>

              {/* ── Presets ── */}
              <div className="mt-5">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">
                  choose your offer
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {stats.options.map((opt, idx) => {
                    const active = !usingCustom && selectedIdx === idx;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setSelectedIdx(idx);
                          setCustomAmount("");
                        }}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-colors duration-200",
                          active
                            ? "border-stream-core/45 bg-stream-core/10"
                            : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                        )}
                      >
                        <div
                          className={cn(
                            "font-mono text-[8px] uppercase tracking-[0.14em]",
                            active ? "text-stream-core" : "text-white/35"
                          )}
                        >
                          {opt.label}
                        </div>
                        <div className="mt-1 font-mono text-[14px] font-medium text-white">
                          {formatUsd(opt.value)}
                        </div>
                        <div className="mt-0.5 font-mono text-[8px] text-white/25">
                          {opt.multiplier}×
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Valor livre ── */}
              <div className="mt-4">
                <label
                  htmlFor="takeover-amount"
                  className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-white/35"
                >
                  or enter your own
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-[13px] text-white/35">
                    $
                  </span>
                  <input
                    id="takeover-amount"
                    inputMode="decimal"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                    placeholder={String(stats.minBid)}
                    aria-invalid={!isValid}
                    className={cn(
                      "w-full rounded-xl border bg-white/[0.02] py-2.5 pl-7 pr-3",
                      "font-mono text-[14px] tabular-nums text-white placeholder:text-white/20",
                      "transition-colors focus:outline-none",
                      isValid
                        ? "border-white/[0.08] focus:border-white/25"
                        : "border-red-400/40 focus:border-red-400/60"
                    )}
                  />
                </div>

                {validationError && (
                  <p className="mt-2 flex items-start gap-1.5 font-ui text-[11px] leading-snug text-red-300/85">
                    <AlertCircle className="mt-[1px] h-3 w-3 shrink-0" />
                    {validationError}
                  </p>
                )}
              </div>
            </div>

            {/* ── Rodapé fixo: a ação nunca sai da tela ── */}
            <div className="shrink-0 border-t border-white/[0.06] bg-white/[0.015] px-6 py-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="font-ui text-[12px] text-white/50">You pay</span>
                <span className="font-mono text-[20px] font-medium text-white">
                  {isValid ? formatUsd(Math.round(amount)) : "—"}
                </span>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={cn(
                  "tile-3d flex w-full items-center justify-center gap-2 rounded-tile px-5 py-3.5",
                  "bg-gradient-to-b from-white to-white/85 font-ui text-[14px] font-bold text-stage-void",
                  "disabled:cursor-not-allowed disabled:opacity-40"
                )}
              >
                <Zap className="h-4 w-4" />
                {submitting ? "Sending offer…" : "Send offer"}
              </button>

              <p className="mt-2.5 flex items-center justify-center gap-1.5 font-ui text-[10px] text-white/25">
                <ShieldCheck className="h-3 w-3" />
                Funds held in escrow until the owner responds
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-center",
        accent ? "border-stream-core/25 bg-stream-core/[0.07]" : "border-white/[0.08] bg-white/[0.02]"
      )}
    >
      <div
        className={cn(
          "font-mono text-[8px] uppercase tracking-[0.16em]",
          accent ? "text-stream-core/80" : "text-white/35"
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-[17px] font-medium tabular-nums",
          accent ? "text-stream-core" : "text-white/90"
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 font-mono text-[8px] text-white/25">{hint}</div>}
    </div>
  );
}

export default HostileTakeoverModal;
