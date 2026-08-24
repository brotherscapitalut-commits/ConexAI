import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useI18n } from "@/lib/i18n";

interface DashboardChartsProps {
  clicksData: any[];
  clicksBySource: any[];
}

const DashboardCharts = ({ clicksData, clicksBySource }: DashboardChartsProps) => {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
      <Card className="border-white/10 rounded-2xl shadow-xl bg-white/5 backdrop-blur-md">
        <CardHeader className="pb-2"><CardTitle className="text-lg font-display font-semibold flex items-center gap-2 text-foreground"><Calendar className="w-4 h-4 text-primary" />{t("dash.chart_clicks_per_day")}</CardTitle></CardHeader>
        <CardContent>
          {clicksData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={clicksData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Line type="monotone" dataKey="cliques" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">{t("dash.chart_no_data")}</div>
          )}
        </CardContent>
      </Card>
      <Card className="border-white/10 rounded-2xl shadow-xl bg-white/5 backdrop-blur-md">
        <CardHeader className="pb-2"><CardTitle className="text-lg font-display font-semibold flex items-center gap-2 text-foreground"><TrendingUp className="w-4 h-4 text-primary" />{t("dash.chart_clicks_by_source")}</CardTitle></CardHeader>
        <CardContent>
          {clicksBySource.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={clicksBySource}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="source" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Bar dataKey="cliques" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">{t("dash.chart_no_data")}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardCharts;
