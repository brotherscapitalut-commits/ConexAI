import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const STORAGE_KEY = "conexai_welcome_seen";

export default function WelcomeConeXaiModal() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const handleExplore = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setOpen(false);
    navigate("/");
  };

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            className="relative z-10 w-full max-w-lg rounded-2xl border border-white/20 bg-gradient-to-b from-background to-background/95 p-6 sm:p-8 shadow-2xl shadow-primary/10"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex justify-center mb-4">
              <span
                className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/20 border border-primary/30"
                style={{
                  filter: "drop-shadow(0 0 12px hsl(var(--primary) / 0.5))",
                }}
              >
                <Sparkles className="w-7 h-7 text-primary" />
              </span>
            </div>
            <h2
              id="welcome-title"
              className="font-display font-bold text-xl sm:text-2xl text-center text-foreground mb-3"
            >
              Bem-vindo à Era ConeXai: Onde as Estrelas do Mercado se Conectam.
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground text-center leading-relaxed mb-6">
              Você acaba de entrar no primeiro ecossistema de marketing inteligente do mundo. Mais que um mural, somos um cosmos de oportunidades onde marcas e influenciadores orbitam em perfeita sintonia. O futuro das parcerias digitais não é mais uma promessa — ele está acontecendo aqui, agora, em Ultra HD.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="font-display font-semibold gap-2"
                onClick={handleExplore}
              >
                <Sparkles className="w-4 h-4" />
                Explorar o Universo
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={handleClose}
                className="text-muted-foreground"
              >
                Fechar
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
