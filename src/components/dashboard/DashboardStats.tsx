import { Card, CardContent } from "@/components/ui/card";
import { MousePointerClick, Blocks, TrendingUp, BarChart3, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface DashboardStatsProps {
  totalClicks: number;
  remainingBlocks: number;
  clicksToday: number;
  trafficSources: number;
}

const statStyles = [
  { icon: MousePointerClick, gradient: "from-emerald-500/20 to-emerald-600/5", ring: "ring-emerald-500/30", iconBg: "bg-emerald-500/15", iconColor: "text-emerald-500" },
  { icon: Blocks, gradient: "from-amber-500/20 to-amber-600/5", ring: "ring-amber-500/30", iconBg: "bg-amber-500/15", iconColor: "text-amber-500" },
  { icon: TrendingUp, gradient: "from-blue-500/20 to-blue-600/5", ring: "ring-blue-500/30", iconBg: "bg-blue-500/15", iconColor: "text-blue-500" },
  { icon: BarChart3, gradient: "from-violet-500/20 to-violet-600/5", ring: "ring-violet-500/30", iconBg: "bg-violet-500/15", iconColor: "text-violet-500" },
];

const DashboardStats = ({ totalClicks, remainingBlocks, clicksToday, trafficSources }: DashboardStatsProps) => {
  const { t } = useI18n();
  const values = [totalClicks, remainingBlocks, clicksToday, trafficSources];
  const labels = [
    t("dash.stat_total_clicks"),
    t("dash.stat_remaining_blocks"),
    t("dash.stat_clicks_today"),
    t("dash.stat_traffic_sources"),
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
      {statStyles.map((style, i) => {
        const Icon = style.icon;
        return (
          <Card
            key={labels[i]}
            className={`rounded-2xl overflow-hidden border-0 bg-gradient-to-br ${style.gradient} backdrop-blur-md shadow-lg ring-1 ${style.ring} transition-all hover:scale-[1.02] hover:shadow-xl`}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className={`p-3 rounded-xl ${style.iconBg} ring-1 ${style.ring}`}>
                  <Icon className={`w-6 h-6 ${style.iconColor}`} />
                </div>
                <Sparkles className={`w-4 h-4 ${style.iconColor} opacity-50`} aria-hidden />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-display font-bold text-foreground tabular-nums tracking-tight">
                  {values[i]}
                </div>
                <div className="text-sm text-muted-foreground font-medium mt-0.5">{labels[i]}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default DashboardStats;
