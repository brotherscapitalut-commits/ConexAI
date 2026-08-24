import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Server,
  CheckCircle,
  XCircle,
  ListOrdered,
  AlertTriangle,
  Sparkles,
  Wrench,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:3001";

function getAuthHeader(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("local_db_token");
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

interface LogEntry {
  method: string;
  path: string;
  statusCode: number;
  latency: number;
  timestamp: string;
}

interface HealthLogRow {
  id: string;
  service_name: string;
  status: string;
  latency: number | null;
  error_message: string | null;
  page_path: string | null;
  user_id: string | null;
  user_email: string | null;
  timestamp: string;
}

export default function AdminSystemPage() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [detail, setDetail] = useState<string>("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [uptimePct, setUptimePct] = useState<number>(100);
  const [latencySeries, setLatencySeries] = useState<{ time: string; latency: number; status?: string }[]>([]);
  const [healthLogs, setHealthLogs] = useState<HealthLogRow[]>([]);
  const [aiRequestsToday, setAiRequestsToday] = useState<number>(0);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState<boolean>(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [newSignupsLast7Days, setNewSignupsLast7Days] = useState<number>(0);
  const { toast } = useToast();

  const sendHealthSample = useCallback(async (latency: number, ok: boolean) => {
    try {
      await fetch(`${API}/api/admin/health-sample`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ latency, status: ok ? "ok" : "error" }),
      });
    } catch (_e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setStatus("checking");
      const start = Date.now();
      try {
        const res = await fetch(`${API}/api/health`, { method: "GET" });
        const data = await res.json().catch(() => ({}));
        const latency = Date.now() - start;
        const ok = res.ok && data?.ok;
        if (!cancelled) {
          if (ok) {
            setStatus("online");
            setDetail(`Porta ${data.port ?? "3001"} respondendo.`);
          } else {
            setStatus("offline");
            setDetail(res.statusText || "Resposta inválida");
          }
        }
        sendHealthSample(latency, ok);
      } catch (err) {
        const latency = Date.now() - start;
        if (!cancelled) {
          setStatus("offline");
          setDetail(err instanceof Error ? err.message : "Falha ao conectar");
        }
        sendHealthSample(latency, false);
      }
    };
    check();
    const t = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [sendHealthSample]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${API}/api/admin/request-logs`, { headers: getAuthHeader() });
        const json = await res.json();
        if (res.ok && Array.isArray(json.data)) setLogs(json.data);
      } catch (_e) {
        setLogs([]);
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchHealthStats = async () => {
      try {
        const res = await fetch(`${API}/api/admin/health-stats`, { headers: getAuthHeader() });
        const json = await res.json();
        if (res.ok && json.data) {
          setUptimePct(json.data.uptimePct ?? 100);
          setLatencySeries(Array.isArray(json.data.series) ? json.data.series : []);
        }
      } catch (_e) {
        setLatencySeries([]);
      }
    };
    fetchHealthStats();
    const interval = setInterval(fetchHealthStats, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchHealthLogs = async () => {
      try {
        const res = await fetch(`${API}/api/admin/system-health-logs`, { headers: getAuthHeader() });
        const json = await res.json();
        if (res.ok && Array.isArray(json.data)) setHealthLogs(json.data);
      } catch (_e) {
        setHealthLogs([]);
      }
    };
    fetchHealthLogs();
    const interval = setInterval(fetchHealthLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchAiCount = async () => {
      try {
        const res = await fetch(`${API}/api/admin/ai-requests-today`, { headers: getAuthHeader() });
        const json = await res.json();
        if (res.ok && json.data) setAiRequestsToday(json.data.count ?? 0);
      } catch (_e) {
        setAiRequestsToday(0);
      }
    };
    fetchAiCount();
    const interval = setInterval(fetchAiCount, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchMaintenance = async () => {
      try {
        const res = await fetch(`${API}/api/maintenance-mode`);
        const json = await res.json();
        setMaintenanceEnabled(!!json.enabled);
      } catch (_e) {
        setMaintenanceEnabled(false);
      }
    };
    fetchMaintenance();
  }, []);

  useEffect(() => {
    const fetchGrowth = async () => {
      try {
        const res = await fetch(`${API}/api/admin/growth-stats`, { headers: getAuthHeader() });
        const json = await res.json();
        if (res.ok && json.data) setNewSignupsLast7Days(json.data.newSignupsLast7Days ?? 0);
      } catch (_e) {}
    };
    fetchGrowth();
    const interval = setInterval(fetchGrowth, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleMaintenance = async () => {
    setMaintenanceLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/maintenance`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ enabled: !maintenanceEnabled }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setMaintenanceEnabled(!!json.data.enabled);
        toast({
          title: json.data.enabled ? "Manutenção ativada" : "Manutenção desativada",
          description: json.data.enabled
            ? "Usuários comuns verão o aviso 'Sistema em Atualização'."
            : "Sistema voltou ao normal.",
        });
      } else {
        toast({ title: "Erro", description: "Não foi possível alterar o modo manutenção.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha na requisição", variant: "destructive" });
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const chartData = latencySeries.map((s) => ({
    ...s,
    timeLabel: s.time ? new Date(s.time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Painel de Sistema & APIs</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor de saúde, console de erros, uso de IA e modo manutenção (porta 3001).</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className={status === "online" ? "border-green-500/50 bg-green-500/5" : status === "offline" ? "border-destructive/50 bg-destructive/5" : "border-muted"}>
          <CardHeader>
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Server className="w-5 h-5" />
              Saúde do servidor — {API}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 flex-wrap">
              {status === "checking" && (
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-muted-foreground animate-pulse" />
                  Verificando...
                </span>
              )}
              {status === "online" && (
                <span className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold text-lg">
                  <CheckCircle className="w-6 h-6" />
                  Online
                </span>
              )}
              {status === "offline" && (
                <span className="flex items-center gap-2 text-destructive font-semibold text-lg">
                  <XCircle className="w-6 h-6" />
                  Offline
                </span>
              )}
              {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Requisições de IA (Mural) — Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-foreground">{aiRequestsToday}</p>
            <p className="text-xs text-muted-foreground mt-1">Buscas inteligentes no mural nas últimas 24h</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Taxa de Crescimento Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-foreground">{newSignupsLast7Days}</p>
            <p className="text-xs text-muted-foreground mt-1">Novos cadastros nos últimos 7 dias</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-display">Monitor de Saúde — Uptime e Latência</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 mb-4">
            <div>
              <span className="text-2xl font-bold text-foreground">{uptimePct}%</span>
              <span className="text-sm text-muted-foreground ml-2">Uptime (24h)</span>
            </div>
          </div>
          {chartData.length > 0 ? (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="timeLabel" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit=" ms" />
                  <Tooltip
                    formatter={(value: number) => [`${value} ms`, "Latência"]}
                    labelFormatter={(label) => label}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="latency" name="Latência (ms)" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">Aguardando amostras de saúde (verificações a cada 15s).</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Console de Erros (system_health_logs)
          </CardTitle>
          <p className="text-xs text-muted-foreground">Erro, página e usuário registrados.</p>
        </CardHeader>
        <CardContent>
          <div className="max-h-[320px] overflow-y-auto font-mono text-xs rounded-lg border border-border/50">
            {healthLogs.length === 0 ? (
              <p className="text-muted-foreground py-4 px-4">Nenhum registro em system_health_logs.</p>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/90">
                  <tr>
                    <th className="text-left py-2 px-3">Data/Hora</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Erro</th>
                    <th className="text-left py-2 px-3">Página</th>
                    <th className="text-left py-2 px-3">Usuário</th>
                    <th className="text-right py-2 px-3">Latência</th>
                  </tr>
                </thead>
                <tbody>
                  {healthLogs.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-t border-border/50 ${row.status === "error" ? "bg-destructive/10" : ""}`}
                    >
                      <td className="py-1.5 px-3 text-muted-foreground whitespace-nowrap">
                        {new Date(row.timestamp).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-1.5 px-3">
                        <span
                          className={
                            row.status === "error"
                              ? "text-destructive font-medium"
                              : row.status === "degraded"
                                ? "text-amber-600"
                                : "text-muted-foreground"
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 max-w-[200px] truncate" title={row.error_message ?? ""}>
                        {row.error_message ?? "—"}
                      </td>
                      <td className="py-1.5 px-3 max-w-[180px] truncate" title={row.page_path ?? ""}>
                        {row.page_path ?? "—"}
                      </td>
                      <td className="py-1.5 px-3 max-w-[160px] truncate" title={row.user_email ?? ""}>
                        {row.user_email ?? (row.user_id ? `${String(row.user_id).slice(0, 8)}…` : "—")}
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{row.latency != null ? `${row.latency} ms` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-600" />
            Botão de Emergência — Manutenção
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Ao ativar, todos os usuários comuns verão &quot;Sistema em Atualização&quot;. O e-mail brotherscapitalut@gmail.com continua com acesso total.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-foreground">
              Modo manutenção: {maintenanceEnabled ? "Ativado" : "Desativado"}
            </span>
            <Button
              variant={maintenanceEnabled ? "destructive" : "default"}
              onClick={toggleMaintenance}
              disabled={maintenanceLoading}
              className="gap-2"
            >
              <Wrench className="w-4 h-4" />
              {maintenanceEnabled ? "Desativar manutenção" : "Ativar manutenção"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <ListOrdered className="w-5 h-5" />
            Log de requisições (tempo real)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[400px] overflow-y-auto font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-muted-foreground py-4">Nenhuma requisição registrada ou sem permissão.</p>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="text-left py-1.5 px-2">Horário</th>
                    <th className="text-left py-1.5 px-2">Método</th>
                    <th className="text-left py-1.5 px-2">Path</th>
                    <th className="text-left py-1.5 px-2">Status</th>
                    <th className="text-left py-1.5 px-2">Latência</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((entry, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="py-1 px-2 text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString("pt-BR")}</td>
                      <td className="py-1 px-2">{entry.method}</td>
                      <td className="py-1 px-2 truncate max-w-[200px]" title={entry.path}>{entry.path}</td>
                      <td className="py-1 px-2">{entry.statusCode}</td>
                      <td className="py-1 px-2">{entry.latency}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
