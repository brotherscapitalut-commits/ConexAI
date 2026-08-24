import { motion } from "framer-motion";
import { useMemo } from "react";

interface SpotlightConfettiProps {
  /** Center X position in % */
  x: number;
  /** Center Y position in % */
  y: number;
  /** Brand color for themed confetti */
  color: string;
  /** Unique key to re-trigger animation */
  triggerId: string;
  /** Number of confetti pieces */
  count?: number;
}

const CONFETTI_SHAPES = ["circle", "square", "star"] as const;

const CONFETTI_COLORS_GOLD = [
  "hsl(45 90% 60%)",
  "hsl(38 85% 55%)",
  "hsl(50 95% 70%)",
  "hsl(42 80% 50%)",
  "hsl(35 70% 65%)",
  "#fff",
];

const CONFETTI_COLORS_PURPLE = [
  "hsl(280 70% 60%)",
  "hsl(260 65% 55%)",
  "hsl(300 80% 70%)",
  "hsl(270 60% 50%)",
  "hsl(290 75% 65%)",
  "#fff",
];

interface ConfettiPiece {
  id: number;
  offsetX: number;
  offsetY: number;
  endX: number;
  endY: number;
  rotation: number;
  size: number;
  color: string;
  shape: typeof CONFETTI_SHAPES[number];
  duration: number;
  delay: number;
}

const SpotlightConfetti = ({
  x,
  y,
  color,
  triggerId,
  count = 18,
}: SpotlightConfettiProps) => {
  const pieces = useMemo<ConfettiPiece[]>(() => {
    // Determine palette based on hue
    const isWarm =
      color.includes("hsl(4") || color.includes("hsl(3") || color.includes("#");
    const palette = isWarm ? CONFETTI_COLORS_GOLD : CONFETTI_COLORS_PURPLE;
    // Also include the brand color itself
    const colors = [...palette, color];

    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const distance = 40 + Math.random() * 80;
      return {
        id: i,
        offsetX: 0,
        offsetY: 0,
        endX: Math.cos(angle) * distance,
        endY: Math.sin(angle) * distance - 20, // slight upward bias
        rotation: Math.random() * 720 - 360,
        size: 3 + Math.random() * 5,
        color: colors[i % colors.length],
        shape: CONFETTI_SHAPES[i % CONFETTI_SHAPES.length],
        duration: 1.2 + Math.random() * 0.8,
        delay: Math.random() * 0.3,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerId, count]);

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        zIndex: 50,
        transform: "translate(-50%, -50%)",
      }}
    >
      {pieces.map((piece) => (
        <motion.div
          key={`${triggerId}-${piece.id}`}
          className="absolute"
          style={{
            width: piece.size,
            height: piece.shape === "circle" ? piece.size : piece.size * 0.6,
            backgroundColor: piece.color,
            borderRadius: piece.shape === "circle" ? "50%" : piece.shape === "star" ? "2px" : "1px",
            boxShadow: `0 0 ${piece.size}px ${piece.color}80`,
          }}
          initial={{
            x: 0,
            y: 0,
            opacity: 1,
            scale: 0,
            rotate: 0,
          }}
          animate={{
            x: piece.endX,
            y: piece.endY,
            opacity: [0, 1, 1, 0],
            scale: [0, 1.2, 1, 0.5],
            rotate: piece.rotation,
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: "easeOut",
          }}
        />
      ))}

      {/* Central flash */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 20,
          height: 20,
          background: `radial-gradient(circle, ${color}cc, ${color}00)`,
          transform: "translate(-50%, -50%)",
        }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: [0, 3, 4], opacity: [1, 0.6, 0] }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
};

export default SpotlightConfetti;
