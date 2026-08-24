import { memo } from "react";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  Shirt,
  Cpu,
  Dumbbell,
  Gamepad2,
  Sparkles,
  Music,
  Palmtree,
  Laugh,
  UtensilsCrossed,
  Drama,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const CATEGORIES_MIN_HEIGHT = 48;

const DEFAULT_CATEGORIES = [
  "Todos",
  "Moda",
  "Tecnologia",
  "Fitness",
  "Games",
  "Beleza",
  "Música",
  "Lifestyle",
];

const ICON_BY_CAT: Record<string, LucideIcon> = {
  Todos: LayoutGrid,
  Moda: Shirt,
  Tecnologia: Cpu,
  Fitness: Dumbbell,
  Games: Gamepad2,
  Beleza: Sparkles,
  Música: Music,
  Lifestyle: Palmtree,
};

interface CategoriesBarProps {
  categories?: string[];
  value: string;
  onChange: (category: string) => void;
  className?: string;
}

/**
 * `default` / `bento` — dock flutuante (card escuro com sombra grande).
 * `inline`          — linha dentro do header: sem card, sem sombra, botões
 *                     menores e rolagem horizontal quando não cabem. É a
 *                     variante usada no mural de criadores, onde o dock
 *                     flutuante cobria os cards.
 */
type CategoriesVariant = "default" | "bento" | "inline";

function CategoriesBarInner({
  categories = DEFAULT_CATEGORIES,
  value,
  onChange,
  className = "",
  variant = "default",
}: CategoriesBarProps & { variant?: CategoriesVariant }) {
  const isInline = variant === "inline";
  const isInfluencer = variant === "bento" || isInline;
  const themeColor = isInfluencer ? "fuchsia" : "primary";

  return (
    <motion.nav
      initial={variant === "inline" ? false : { y: 50, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={cn(
        "flex items-center",
        isInline
          // Dentro do header: transparente, encostado à esquerda e rolável
          // no eixo X para categorias que não couberem na largura da tela.
          ? "gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : cn(
              "gap-2 p-2 rounded-2xl border bg-black/60 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)]",
              isInfluencer ? "border-fuchsia-500/20 shadow-fuchsia-500/10" : "border-primary/20 shadow-primary/10"
            ),
        className
      )}
      role="tablist"
    >
      {categories.map((cat) => {
        const Icon = ICON_BY_CAT[cat] ?? LayoutGrid;
        const selected = value === cat;
        return (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(cat)}
            className={cn(
              "group relative flex items-center justify-center rounded-xl transition-all duration-300",
              isInline ? "h-9 w-9 shrink-0" : "h-12 w-12",
              selected 
                ? (isInfluencer ? "bg-fuchsia-500/20 text-fuchsia-400 shadow-[inset_0_0_20px_rgba(217,70,239,0.3)]" : "bg-primary/20 text-primary shadow-[inset_0_0_20px_rgba(34,197,94,0.3)]")
                : "text-white/40 hover:text-white hover:bg-white/10 hover:shadow-lg"
            )}
            title={cat}
          >
            {selected && (
              <motion.span
                layoutId={`cat-glow-${variant}`}
                className={cn(
                  "absolute inset-0 rounded-xl border-2",
                  isInfluencer ? "border-fuchsia-500/50 shadow-[0_0_15px_rgba(217,70,239,0.5)]" : "border-primary/50 shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                )}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <Icon className={cn("transition-transform group-hover:scale-110", isInline ? "h-4 w-4" : "h-5 w-5", selected ? "stroke-[2.5px]" : "stroke-[1.5px]")} />
            
            {/* Tooltip on hover */}
            <span className={cn(
              "absolute left-1/2 -translate-x-1/2 scale-0 rounded-lg bg-black/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white border transition-all duration-200 group-hover:scale-100 whitespace-nowrap shadow-xl z-20",
              isInline ? "top-11" : "-top-12",
              isInfluencer ? "border-fuchsia-500/30" : "border-primary/30"
            )}>
              {cat}
              {!isInline && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/95" />}
            </span>
          </button>
        );
      })}
    </motion.nav>
  );
}

export const CategoriesBar = memo(CategoriesBarInner);
