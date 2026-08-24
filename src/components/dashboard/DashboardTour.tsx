import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Eye, Wallet, X, ChevronRight } from "lucide-react";

const STORAGE_KEY = "dashboard_tour_done";

const STEPS: { id: string; title: string; description: string; icon: React.ReactNode }[] = [
  {
    id: "simulador",
    title: "Simulador de Marca",
    description: "Escolha os blocos no mural, defina sua logo e cor, e publique sua marca. Use o arrasto para selecionar vários blocos de uma vez.",
    icon: <Eye className="w-5 h-5 text-primary" />,
  },
  {
    id: "financas",
    title: "Painel de Finanças",
    description: "Acompanhe seu saldo de créditos para influencers e ofertas. Carregue créditos quando precisar e veja suas ofertas atuais aqui.",
    icon: <Wallet className="w-5 h-5 text-primary" />,
  },
];

export default function DashboardTour() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const updateSpotlight = useCallback(() => {
    const step = STEPS[stepIndex];
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.id}"]`);
    if (!el) {
      setSpotlight(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const rect = el.getBoundingClientRect();
    setSpotlight({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [stepIndex]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (done === "true") return;
    setActive(true);
  }, []);

  useEffect(() => {
    if (!active) return;
    updateSpotlight();
    const onResize = () => updateSpotlight();
    window.addEventListener("resize", onResize);
    const t1 = setTimeout(updateSpotlight, 100);
    const t2 = setTimeout(updateSpotlight, 500);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active, stepIndex, updateSpotlight]);

  const handleNext = () => {
    if (stepIndex >= STEPS.length - 1) {
      localStorage.setItem(STORAGE_KEY, "true");
      setActive(false);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setActive(false);
  };

  if (!active) return null;

  const step = STEPS[stepIndex];
  if (!step) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop com recorte (spotlight) */}
        <div className="absolute inset-0 bg-black/60" onClick={handleClose} aria-hidden />
        {spotlight && (
          <div
            className="absolute rounded-xl bg-transparent pointer-events-none border-2 border-primary"
            style={{
              top: spotlight.top - 6,
              left: spotlight.left - 6,
              width: spotlight.width + 12,
              height: spotlight.height + 12,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
            }}
          />
        )}

        {/* Tooltip */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pointer-events-auto">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-white/20 bg-card p-5 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">{step.icon}</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={handleClose}
                aria-label="Fechar tour"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex justify-between items-center mt-4">
              <span className="text-xs text-muted-foreground">
                {stepIndex + 1} de {STEPS.length}
              </span>
              <Button size="sm" className="gap-1.5" onClick={handleNext}>
                {stepIndex >= STEPS.length - 1 ? "Concluir" : "Próximo"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
