import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gavel, TrendingUp, Info, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MuralBrand } from "./types";
import { regionForBlock } from "./MuralMarketplace";
import { MuralBiddingService, MIN_BID_MULTIPLIER } from "./MuralBidding";
import { formatUsd, blockPriceFor } from "@/lib/stripe";
import { useToast } from "@/hooks/use-toast";

interface MuralBiddingModalProps {
  brand: MuralBrand;
  fromCompanyId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Valor investido pela marca na posição que ocupa.
 *
 * Usa o preço efetivamente pago por bloco quando existe (`purchase_price`) e
 * cai para a mensalidade vigente quando não existe — posições antigas podem
 * não ter o registro do valor pago, e sem esse fallback o piso do lance
 * cairia para zero, permitindo takeover por qualquer quantia.
 */
function positionValue(brand: MuralBrand): number {
  const blocks = brand.blocks ?? [];
  if (blocks.length === 0) return 0;
  // Sem `purchase_price` registrado, usa o preço vigente da zona do bloco —
  // assim o piso do lance nunca cai para zero em posições antigas.
  return blocks.reduce(
    (sum, b) => sum + (b.purchase_price ?? blockPriceFor(regionForBlock(b.x, b.y))),
    0
  );
}

export const MuralBiddingModal = ({
  brand,
  fromCompanyId,
  onClose,
  onSuccess,
}: MuralBiddingModalProps) => {
  const [step, setStep] = useState<"select" | "confirm" | "success">("select");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const paid = useMemo(() => positionValue(brand), [brand]);
  const stats = useMemo(() => MuralBiddingService.calculateBidStats(paid), [paid]);

  const handleSelectMultiplier = (value: number) => {
    setSelectedAmount(value);
    setCustomAmount("");
    setStep("confirm");
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customAmount.replace(",", "."));
    const check = MuralBiddingService.validateBid(val, paid);
    if (!check.ok) {
      toast({ title: "Invalid amount", description: check.error, variant: "destructive" });
      return;
    }
    setSelectedAmount(val);
    setStep("confirm");
  };

  const handleFinalSubmit = async () => {
    if (!fromCompanyId || !selectedAmount) return;
    setSubmitting(true);
    try {
      await MuralBiddingService.submitBid({
        fromCompanyId,
        toBrandId: brand.id,
        amount: selectedAmount,
        purchaseValue: paid,
      });
      setStep("success");
    } catch (err) {
      toast({
        title: "Could not send offer",
        description: err instanceof Error ? err.message : "Unexpected error.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* max-h + scroll interno: em telas baixas o passo "select" ultrapassa
          a viewport e os botões de ação ficavam inalcançáveis. */}
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: 8 }}
        className="relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0A0A0A] shadow-2xl"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-20"
          style={{ background: `linear-gradient(180deg, ${brand.color}, transparent)` }}
        />

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 z-20 rounded-full bg-white/5 p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative min-h-0 flex-1 overflow-y-auto p-7 md:p-9">
          <AnimatePresence mode="wait">
            {step === "select" && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="space-y-7"
              >
                <div>
                  <div className="mb-2 flex items-center gap-2 text-amber-400">
                    <Gavel className="h-4 w-4" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
                      Position market
                    </span>
                  </div>
                  <h2 className="font-ui text-2xl font-bold tracking-[-0.02em] text-white">
                    Make an offer to <span style={{ color: brand.color }}>{brand.name}</span>
                  </h2>
                  <p className="mt-2 font-ui text-[13px] leading-relaxed text-white/50">
                    This brand holds {brand.blocks.length}{" "}
                    {brand.blocks.length === 1 ? "block" : "blocks"}, with{" "}
                    <span className="font-medium text-white">{formatUsd(paid)}</span> invested. The
                    minimum offer is {MIN_BID_MULTIPLIER}× that amount.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {stats.options.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => handleSelectMultiplier(m.value)}
                      className="group flex flex-col items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-center transition-all hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/40 transition-colors group-hover:text-amber-400">
                        {m.label}
                      </span>
                      <div className="my-1.5 font-mono text-lg font-medium text-white">
                        {formatUsd(m.value)}
                      </div>
                      <span className="font-mono text-[9px] text-white/30">{m.description}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/40">
                    Custom amount
                  </span>
                  <form onSubmit={handleCustomSubmit} className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-white/30">
                        $
                      </span>
                      <Input
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                        inputMode="decimal"
                        placeholder={`Minimum ${stats.minBid.toLocaleString("en-US")}`}
                        className="h-12 border-none bg-white/5 pl-9 font-mono text-base font-medium text-white placeholder:text-white/20"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!customAmount}
                      className="h-12 w-12 shrink-0 rounded-2xl bg-white text-black hover:bg-white/90"
                      aria-label="Continue"
                    >
                      <TrendingUp className="h-5 w-5" />
                    </Button>
                  </form>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/10 bg-amber-500/5 p-4 font-ui text-[11px] leading-relaxed text-amber-200/70">
                  <Info className="h-4 w-4 shrink-0 text-amber-400" />
                  <p>
                    Offers are binding and held in escrow. The block only changes hands if the
                    current owner accepts; otherwise your funds are returned in full. See our{" "}
                    <a href="/termos" className="underline underline-offset-2 hover:text-amber-200">
                      Terms of Use
                    </a>{" "}
                    for how proceeds are distributed.
                  </p>
                </div>
              </motion.div>
            )}

            {step === "confirm" && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="space-y-7 py-3"
              >
                <div className="text-center">
                  <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-white/5 text-amber-400">
                    <AlertCircle className="h-8 w-8" />
                  </div>
                  <h3 className="font-ui text-xl font-bold text-white">Confirm your offer</h3>
                  <p className="mt-2 px-4 font-ui text-[13px] text-white/50">
                    You are about to send a binding offer of:
                  </p>
                  <div className="mt-5 font-mono text-4xl font-medium tracking-tight text-white">
                    {formatUsd(Number(selectedAmount))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Button
                    disabled={submitting}
                    onClick={handleFinalSubmit}
                    className="h-13 w-full rounded-2xl bg-white py-3.5 text-base font-bold text-black hover:bg-white/90"
                  >
                    {submitting ? "Processing…" : "Confirm and send"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={submitting}
                    onClick={() => setStep("select")}
                    className="h-11 w-full text-white/50 transition-colors hover:text-white"
                  >
                    Back and adjust
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-7 py-6 text-center"
              >
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-[2rem] bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="font-ui text-2xl font-bold text-white">Offer sent</h3>
                  <p className="mt-3 font-ui text-[13px] leading-relaxed text-white/50">
                    The current owner has been notified. You can track the status from your
                    dashboard — if they decline or the offer expires, your funds are released
                    automatically.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    onSuccess?.();
                    onClose();
                  }}
                  className="h-13 w-full rounded-2xl bg-emerald-500 py-3.5 font-bold text-white hover:bg-emerald-400"
                >
                  Done
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default MuralBiddingModal;
