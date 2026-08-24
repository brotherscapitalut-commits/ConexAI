import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface BidModalProps {
  open: boolean;
  blockCoord: string | null;
  currentPrice: number | null;
  minimumBid: number | null;
  onSubmit: (value: number) => void;
  onClose: () => void;
}

const BidModal = ({ open, blockCoord, currentPrice, minimumBid, onSubmit, onClose }: BidModalProps) => {
  const [value, setValue] = useState<string>("");

  const numericMin = minimumBid ?? currentPrice ?? 0;

  return (
    <AnimatePresence>
      {open && blockCoord && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-foreground/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-[90vw] max-w-sm rounded-2xl border border-border bg-popover p-6 shadow-2xl"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="space-y-4">
              <div>
                <h2 className="font-display font-bold text-lg">Make Offer</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Propose a bid for this territory block. The owner will be notified and can accept or counter.
                </p>
              </div>

              <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Block</span>
                  <span className="font-medium tabular-nums">{blockCoord}</span>
                </div>
                {currentPrice !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated value</span>
                    <span className="font-semibold tabular-nums">
                      ${currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {minimumBid !== null && (
                  <div className="flex justify-between text-xs text-muted-foreground pt-1">
                    <span>Minimum bid</span>
                    <span className="tabular-nums">
                      ${minimumBid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-muted-foreground">
                  Your offer (USD)
                </label>
                <input
                  type="number"
                  min={numericMin || undefined}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {numericMin > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Enter at least ${numericMin.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const num = parseFloat(value);
                    if (!Number.isFinite(num) || num <= 0 || num < numericMin) return;
                    onSubmit(num);
                    setValue("");
                  }}
                  className="flex-1 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-display font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Submit bid
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BidModal;

