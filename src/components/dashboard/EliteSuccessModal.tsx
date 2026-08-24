import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EliteSuccessModalProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
}

export default function EliteSuccessModal({ open, onClose }: EliteSuccessModalProps) {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: { x: number; y: number; vx: number; vy: number; size: number; life: number }[] = [];
    const golds = ["#fbbf24", "#f59e0b", "#fcd34d", "#fde68a", "#fef3c7"];
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2 - 1,
        size: 2 + Math.random() * 4,
        life: 0.5 + Math.random() * 0.5,
      });
    }

    let anim = 0;
    const tick = () => {
      if (!open) return;
      anim += 0.016;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02;
        const t = (anim * 2 + i * 0.1) % 1;
        ctx.globalAlpha = Math.sin(t * Math.PI) * p.life;
        ctx.fillStyle = golds[i % golds.length];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        if (p.y > canvas.height + 20) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(id);
    };
  }, [open]);

  const handleVerMeuSpot = () => {
    onClose();
    navigate("/", { state: { justPaid: true }, replace: true });
  };

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ display: "block" }}
      />
      <motion.div
        className="relative z-10 max-w-2xl mx-4 px-8 py-10 rounded-3xl border border-amber-400/30 bg-gradient-to-b from-amber-950/95 to-black/95 shadow-2xl text-center"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
      >
        <p className="text-4xl md:text-5xl font-display font-bold text-amber-400 mb-4 drop-shadow-lg">
          Bem-vindo ao Mural!
        </p>
        <p className="text-lg text-amber-100/95 leading-relaxed mb-8">
          Sua marca agora brilha no maior ecossistema de conexões digitais. Você faz parte de um grupo visionário.
        </p>
        <Button
          size="lg"
          className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-display font-bold shadow-lg shadow-amber-500/30"
          onClick={handleVerMeuSpot}
        >
          <MapPin className="w-5 h-5" />
          Ver meu Spot no Mural
        </Button>
      </motion.div>
    </motion.div>
  );
}
