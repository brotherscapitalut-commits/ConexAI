import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BidNotificationAlertProps {
  bid: any;
  onAccept: (bidId: string) => void;
  onReject: (bidId: string) => void;
}

export const BidNotificationAlert = ({ bid, onAccept, onReject }: BidNotificationAlertProps) => {
  if (!bid) return null;

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="fixed top-24 right-6 z-[200] w-80 overflow-hidden rounded-2xl border border-primary/20 bg-black/80 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
    >
      <div className="bg-primary/10 px-4 py-2 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-3 w-3 text-primary animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">Nova Oferta</span>
        </div>
        <span className="text-[10px] font-mono text-white/40">Nexus Network</span>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <p className="text-xs text-white/60 leading-relaxed">
            Você recebeu uma oferta de <span className="text-white font-black font-mono">${bid.amount.toLocaleString()}</span> pela sua posição.
          </p>
          <p className="mt-2 text-[10px] font-bold text-primary">Receita líquida estimada: ${ (bid.amount * 0.7).toLocaleString() }</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => onAccept(bid.id)}
            className="flex-1 h-9 rounded-xl bg-primary text-black text-[10px] font-black uppercase tracking-wider hover:bg-primary/90"
          >
            <Check className="mr-1.5 h-3 w-3" /> Aceitar
          </Button>
          <Button 
            variant="outline"
            onClick={() => onReject(bid.id)}
            className="flex-1 h-9 rounded-xl border-white/10 bg-white/5 text-white/60 text-[10px] font-black uppercase tracking-wider hover:bg-white/10"
          >
            <X className="mr-1.5 h-3 w-3" /> Recusar
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
