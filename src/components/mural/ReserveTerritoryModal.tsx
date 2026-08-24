/**
 * @deprecated Substituído por `@/components/mural3d/ClaimPixelsModal`, que tem
 * a mesma assinatura de props (drop-in) e adiciona o preview de coordenadas na
 * grade. Mantido apenas como fallback — remover após validação em produção.
 */
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface ReserveTerritoryModalProps {
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

const ReserveTerritoryModal = ({
  blockCoord,
  price,
  status,
  auctionInfo,
  open,
  onReserve,
  onStartAuction,
  onClose,
  onGoToPurchase,
}: ReserveTerritoryModalProps) => {
  return (
    <AnimatePresence>
      {open && blockCoord && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-foreground/40 backdrop-blur-sm"
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
                <h2 className="font-display font-bold text-lg">Reserve Territory</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Confirm the reservation for this block. You can complete payment in the
                  next step.
                </p>
              </div>

              <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Block</span>
                  <span className="font-medium tabular-nums">{blockCoord}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-semibold capitalize">
                    {status.toLowerCase()}
                  </span>
                </div>
                {price !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-semibold tabular-nums">
                      ${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {auctionInfo && (
                  <div className="pt-1 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Starting price</span>
                      <span className="tabular-nums">
                        ${auctionInfo.startingPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Highest bid</span>
                      <span className="tabular-nums">
                        ${auctionInfo.highestBid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2">
                {status === "available" && onGoToPurchase && (
                  <button
                    type="button"
                    onClick={() => { onGoToPurchase(); onClose(); }}
                    className="w-full inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-display font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Ir para compra
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  {status === "available" && (
                    <>
                      <button
                        type="button"
                        onClick={onReserve}
                        className="flex-1 inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-display font-semibold text-emerald-50 hover:bg-emerald-500/90 transition-colors"
                      >
                        Reservar
                      </button>
                      <button
                        type="button"
                        onClick={onStartAuction}
                        className="flex-1 inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-display font-semibold text-amber-50 hover:bg-amber-500/90 transition-colors"
                      >
                        Iniciar leilão
                      </button>
                    </>
                  )}
                  {status === "auction" && (
                    <button
                      type="button"
                      disabled
                      className="flex-1 inline-flex items-center justify-center rounded-lg bg-amber-500/80 px-4 py-2.5 text-sm font-display font-semibold text-amber-50 cursor-default"
                    >
                      In auction
                    </button>
                  )}
                  {status === "reserved" && (
                    <button
                      type="button"
                      disabled
                      className="flex-1 inline-flex items-center justify-center rounded-lg bg-emerald-500/70 px-4 py-2.5 text-sm font-display font-semibold text-emerald-50 cursor-default"
                    >
                      Reserved
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReserveTerritoryModal;

