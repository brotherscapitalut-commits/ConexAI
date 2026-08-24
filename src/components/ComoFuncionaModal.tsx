import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Blocks, UserPlus, TrendingUp, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComoFuncionaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  {
    id: "mapa",
    icon: Blocks,
    title: "O Mapa de Blocos",
    description: "1 milhão de blocos formam o mural digital. Sua marca ocupa um território visível: quanto mais central, mais destaque. Explore, clique e descubra empresas em tempo real.",
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-500",
  },
  {
    id: "influencers",
    icon: UserPlus,
    title: "A Conexão com Influencers",
    description: "O mural conecta marcas e criadores. Arraste uma marca até o painel e veja matches com influenciadores do mesmo nicho. Parcerias diretas, sem intermediários.",
    gradient: "from-fuchsia-500/20 via-purple-500/10 to-transparent",
    iconBg: "bg-fuchsia-500/20",
    iconColor: "text-fuchsia-500",
  },
  {
    id: "roi",
    icon: TrendingUp,
    title: "O Retorno de Investimento",
    description: "Cada bloco gera cliques reais para seu site ou redes. Métricas transparentes, visibilidade mensurável. Invista no centro do mural e multiplique o alcance.",
    gradient: "from-emerald-500/20 via-green-500/10 to-transparent",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-500",
  },
];

const ComoFuncionaModal = ({ open, onOpenChange }: ComoFuncionaModalProps) => {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const Icon = step.icon;

  useEffect(() => {
    if (!open) setIndex(0);
  }, [open]);

  const next = () => setIndex((i) => (i + 1) % STEPS.length);
  const prev = () => setIndex((i) => (i - 1 + STEPS.length) % STEPS.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl overflow-hidden border-white/10 bg-gradient-to-b from-background to-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl bg-gradient-to-r from-primary to-fuchsia-500 bg-clip-text text-transparent">
            Como funciona
          </DialogTitle>
        </DialogHeader>

        <div className="relative min-h-[280px] rounded-2xl overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${step.gradient} p-6 flex flex-col`}
            >
              <div className={`w-16 h-16 rounded-2xl ${step.iconBg} flex items-center justify-center mb-4`}>
                <Icon className={`w-8 h-8 ${step.iconColor}`} />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">{step.description}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={prev}
            className="p-2 rounded-xl border border-border bg-muted/50 hover:bg-muted transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${i === index ? "bg-primary scale-125" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            className="p-2 rounded-xl border border-border bg-muted/50 hover:bg-muted transition-colors"
            aria-label="Próximo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="pt-4 border-t border-border">
          <Link to="/guia" onClick={() => onOpenChange(false)}>
            <Button variant="outline" className="w-full gap-2">
              <BookOpen className="w-4 h-4" />
              Ver guia completo (The Mural Guide)
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ComoFuncionaModal;
