import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";

export type AdvertiserTier = "bronze" | "prata" | "ouro";

const TIER_CONFIG: Record<AdvertiserTier, { label: string; className: string; desc: string }> = {
  bronze: {
    label: "Bronze",
    className: "bg-amber-700/90 text-amber-100 border-amber-600/50 shadow-lg shadow-amber-900/30",
    desc: "0–2 campanhas",
  },
  prata: {
    label: "Prata",
    className: "bg-slate-400/90 text-slate-900 border-slate-300/50 shadow-lg shadow-slate-600/30",
    desc: "3–5 campanhas",
  },
  ouro: {
    label: "Ouro",
    className: "bg-amber-500/90 text-amber-950 border-amber-400/50 shadow-lg shadow-amber-600/30",
    desc: "6+ campanhas",
  },
};

function getTier(campaignCount: number): AdvertiserTier {
  if (campaignCount >= 6) return "ouro";
  if (campaignCount >= 3) return "prata";
  return "bronze";
}

interface AdvertiserStatusProps {
  campaignCount: number;
  className?: string;
}

/** Badge de status do anunciante (Bronze, Prata, Ouro) baseado em active_campaigns. */
export default function AdvertiserStatus({ campaignCount, className = "" }: AdvertiserStatusProps) {
  const tier = getTier(campaignCount);
  const config = TIER_CONFIG[tier];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Award className="w-4 h-4 text-muted-foreground" aria-hidden />
      <span className="text-sm text-muted-foreground">Status:</span>
      <Badge variant="outline" className={`font-display font-semibold gap-1.5 ${config.className}`}>
        {config.label}
      </Badge>
      <span className="text-xs text-muted-foreground hidden sm:inline">({config.desc})</span>
    </div>
  );
}
