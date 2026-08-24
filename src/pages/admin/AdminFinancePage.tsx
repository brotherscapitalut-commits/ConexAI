import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DollarSign, Building2, TrendingUp, Wallet, FileText, CheckCircle, XCircle, ArrowDownCircle, ArrowUpCircle, PieChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:3001";

function getAuthHeader(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("local_db_token");
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

interface PlatformFinanceRow {
  id: string;
  transaction_type: string;
  amount: number;
  fee_collected: number;
  status: string;
  created_at: string;
}

interface WithdrawalRow {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  created_at: string;
  denial_reason?: string;
}

export default function AdminFinancePage() {
  const [passivoCirculante, setPassivoCirculante] = useState<number | null>(null);
  const [companiesCount, setCompaniesCount] = useState<number>(0);
  const [profitTotal, setProfitTotal] = useState<number>(0);
  const [revenueData, setRevenueData] = useState<{ date: string; receita: number }[]>([]);
  const [transactions, setTransactions] = useState<PlatformFinanceRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [monthlyReport, setMonthlyReport] = useState<{ month: string; fee: number; profit: number }[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [denyModal, setDenyModal] = useState<{ id: string; amount: number } | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [actioningId, setActioningId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/finance-stats`, { headers: getAuthHeader() });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("[AdminFinance] finance-stats falhou:", res.status, json?.error?.message ?? res.statusText);
        throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      }

      const data = json.data ?? {};
      setPassivoCirculante(Number(data.passivoCirculante ?? 0));
      setCompaniesCount(Number(data.companiesCount ?? 0));
      setProfitTotal(Number(data.profitTotal ?? 0));
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
      setWithdrawals(Array.isArray(data.withdrawals) ? data.withdrawals : []);

      const rawRevenue = Array.isArray(data.revenueData) ? data.revenueData : [];
      setRevenueData(
        rawRevenue.map((r: { date: string; receita: number }) => ({
          date: formatDate(r.date),
          receita: Number(r.receita ?? 0),
        }))
      );
    } catch (e) {
      console.error("[AdminFinance] Erro ao carregar dados:", e);
      setPassivoCirculante(0);
      setProfitTotal(0);
      setTransactions([]);
      setWithdrawals([]);
      setRevenueData([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fetchMonthlyReport = async () => {
    try {
      const res = await fetch(`${API}/api/admin/monthly-report`, { headers: getAuthHeader() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[AdminFinance] monthly-report falhou:", res.status, json?.error?.message);
        toast({ title: "Erro ao gerar relatório", variant: "destructive" });
        return;
      }
      setMonthlyReport(Array.isArray(json.data) ? json.data : []);
      setReportOpen(true);
    } catch (e) {
      console.error("[AdminFinance] fetchMonthlyReport:", e);
      toast({ title: "Erro ao gerar relatório", variant: "destructive" });
    }
  };

  const handleApprove = async (id: string) => {
    setActioningId(id);
    try {
      const res = await fetch(`${API}/api/admin/withdrawal/approve`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[AdminFinance] withdrawal/approve falhou:", res.status, json?.error?.message);
        toast({ title: "Erro", description: json?.error?.message ?? "Falha ao aprovar", variant: "destructive" });
        return;
      }
      toast({ title: "Saque aprovado", description: "Pagamento disparado." });
      await load();
    } catch (e) {
      console.error("[AdminFinance] handleApprove:", e);
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha na requisição", variant: "destructive" });
    } finally {
      setActioningId(null);
    }
  };

  const handleDeny = async () => {
    if (!denyModal) return;
    setActioningId(denyModal.id);
    try {
      const res = await fetch(`${API}/api/admin/withdrawal/deny`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ id: denyModal.id, reason: denyReason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[AdminFinance] withdrawal/deny falhou:", res.status, json?.error?.message);
        toast({ title: "Erro", description: json?.error?.message ?? "Falha ao negar", variant: "destructive" });
        return;
      }
      toast({ title: "Saque negado", description: "Motivo registrado." });
      setDenyModal(null);
      setDenyReason("");
      await load();
    } catch (e) {
      console.error("[AdminFinance] handleDeny:", e);
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha na requisição", variant: "destructive" });
    } finally {
      setActioningId(null);
    }
  };

  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending");
  const totalReceitas = transactions
    .filter((t) => t.transaction_type !== "withdrawal")
    .reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const totalSaidas = transactions
    .filter((t) => t.transaction_type === "withdrawal")
    .reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const totalSaquesAprovados = withdrawals
    .filter((w) => w.status === "approved" || w.status === "paid")
    .reduce((s, w) => s + Number(w.amount ?? 0), 0);
  const receitasLiquidas = totalReceitas - totalSaidas - totalSaquesAprovados;
  const entradasRecentes = [...transactions]
    .filter((t) => t.transaction_type !== "withdrawal")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 15);
  const saidasRecentes = [
    ...withdrawals.filter((w) => w.status !== "pending").map((w) => ({ ...w, transaction_type: "saque", created_at: w.created_at, amount: w.amount })),
    ...transactions.filter((t) => t.transaction_type === "withdrawal"),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 15);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Sistema Financeiro — Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">DRE, entradas e saídas ao vivo, relatórios e gestão de saques.</p>
      </div>

      {loading ? (
        <div className="text-muted-foreground py-8">Carregando...</div>
      ) : (
        <>
        <Tabs defaultValue="resumo" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 gap-1 bg-muted/50 p-1">
            <TabsTrigger value="resumo" className="gap-1.5">Resumo</TabsTrigger>
            <TabsTrigger value="dre" className="gap-1.5"><PieChart className="w-4 h-4" /> DRE</TabsTrigger>
            <TabsTrigger value="fluxo" className="gap-1.5">Entradas / Saídas</TabsTrigger>
            <TabsTrigger value="relatorios" className="gap-1.5"><FileText className="w-4 h-4" /> Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Passivo Circulante
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-display font-bold text-foreground tabular-nums">
                  R$ {(passivoCirculante ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card className={profitTotal > 0 ? "border-green-500/40 bg-green-500/5" : ""}>
              <CardHeader>
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  Profit Total (lucro plataforma)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-display font-bold tabular-nums ${profitTotal > 0 ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
                  R$ {profitTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  Empresas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-display font-bold text-foreground tabular-nums">{companiesCount}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Receita Líquida (taxas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {revenueData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6">Nenhum dado de receita ainda.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `R$${v}`} />
                      <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Receita"]} labelFormatter={(l) => l} />
                      <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-display">Tabela de Fluxo de Caixa (platform_finances)</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhuma transação registrada.</p>
              ) : (
                <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/80">
                      <tr>
                        <th className="text-left py-2 px-2">Data</th>
                        <th className="text-left py-2 px-2">Tipo</th>
                        <th className="text-right py-2 px-2">Valor</th>
                        <th className="text-right py-2 px-2">Taxa</th>
                        <th className="text-left py-2 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr key={t.id} className="border-t border-border/50">
                          <td className="py-1.5 px-2 text-muted-foreground">{formatDate(t.created_at)}</td>
                          <td className="py-1.5 px-2">{t.transaction_type}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">R$ {Number(t.amount).toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">R$ {Number(t.fee_collected).toFixed(2)}</td>
                          <td className="py-1.5 px-2">{t.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={pendingWithdrawals.length > 0 ? "border-destructive/30 bg-destructive/5" : ""}>
            <CardHeader>
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Wallet className={`w-5 h-5 ${pendingWithdrawals.length > 0 ? "text-destructive" : "text-amber-500"}`} />
                Solicitações de Saque
              </CardTitle>
            </CardHeader>
            <CardContent>
              {withdrawals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhuma solicitação.</p>
              ) : (
                <ul className="space-y-2 max-h-[320px] overflow-y-auto">
                  {withdrawals.map((w) => (
                    <li
                      key={w.id}
                      className={`flex items-center justify-between gap-4 py-2 px-3 rounded-lg border ${
                        w.status === "pending" ? "border-destructive/50 bg-destructive/5" : "border-border/50 bg-muted/20"
                      }`}
                    >
                      <div>
                        <span className="text-xs text-muted-foreground font-mono">{w.id.slice(0, 8)}…</span>
                        <p className="text-sm font-medium tabular-nums">R$ {Number(w.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(w.created_at)} · {w.status}</p>
                        {w.denial_reason && <p className="text-xs text-destructive mt-0.5">Motivo: {w.denial_reason}</p>}
                      </div>
                      {w.status === "pending" && (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            disabled={actioningId === w.id}
                            onClick={() => handleApprove(w.id)}
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/50"
                            disabled={actioningId === w.id}
                            onClick={() => setDenyModal({ id: w.id, amount: w.amount })}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Negar
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div>
            <Button onClick={fetchMonthlyReport} variant="outline" className="gap-2">
              <FileText className="w-4 h-4" />
              Gerar resumo do faturamento mensal
            </Button>
          </div>
          </TabsContent>

          <TabsContent value="dre" className="space-y-6 mt-0">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-primary" />
                  Demonstrativo de Resultados (DRE)
                </CardTitle>
                <p className="text-sm text-muted-foreground">Visão consolidada receitas vs despesas.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-foreground font-medium">Receitas (taxas + blocos)</span>
                  <span className="tabular-nums text-green-600 dark:text-green-400 font-semibold">
                    R$ {totalReceitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-foreground font-medium">Saídas (saques aprovados + outros)</span>
                  <span className="tabular-nums text-destructive font-semibold">
                    − R$ {(totalSaidas + totalSaquesAprovados).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 bg-muted/30 rounded-lg px-4">
                  <span className="text-foreground font-semibold">Resultado líquido (Lucro)</span>
                  <span className={`tabular-nums font-bold ${receitasLiquidas >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                    R$ {receitasLiquidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fluxo" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-green-500/20 bg-green-500/5">
                <CardHeader>
                  <CardTitle className="text-sm font-display flex items-center gap-2 text-green-700 dark:text-green-400">
                    <ArrowUpCircle className="w-5 h-5" />
                    Entradas (ao vivo)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {entradasRecentes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Nenhuma entrada recente.</p>
                  ) : (
                    <ul className="space-y-2 max-h-[320px] overflow-y-auto">
                      {entradasRecentes.map((t) => (
                        <li key={t.id} className="flex justify-between py-2 px-2 rounded border border-border/30 bg-background/50">
                          <span className="text-xs text-muted-foreground">{formatDate(t.created_at)} · {t.transaction_type}</span>
                          <span className="tabular-nums text-green-600 dark:text-green-400 font-medium">+ R$ {Number(t.amount).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-sm font-display flex items-center gap-2 text-destructive">
                    <ArrowDownCircle className="w-5 h-5" />
                    Saídas (ao vivo)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {saidasRecentes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Nenhuma saída recente.</p>
                  ) : (
                    <ul className="space-y-2 max-h-[320px] overflow-y-auto">
                      {saidasRecentes.map((s, i) => (
                        <li key={(s as any).id || i} className="flex justify-between py-2 px-2 rounded border border-border/30 bg-background/50">
                          <span className="text-xs text-muted-foreground">{formatDate(s.created_at)} · {(s as any).transaction_type || "saque"}</span>
                          <span className="tabular-nums text-destructive font-medium">− R$ {Number(s.amount).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="relatorios" className="space-y-6 mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Relatórios
                </CardTitle>
                <p className="text-sm text-muted-foreground">Resumo mensal e exportação.</p>
              </CardHeader>
              <CardContent>
                <Button onClick={fetchMonthlyReport} variant="outline" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Gerar resumo do faturamento mensal
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Faturamento mensal</DialogTitle>
              </DialogHeader>
              <div className="max-h-80 overflow-y-auto">
                {monthlyReport.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum dado disponível.</p>
                ) : (
                  <ul className="space-y-2">
                    {monthlyReport.map((r) => (
                      <li key={r.month} className="flex justify-between py-2 border-b border-border/50">
                        <span className="font-medium">{r.month}</span>
                        <span className="tabular-nums text-green-600 dark:text-green-400">
                          R$ {(r.fee + r.profit).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </DialogContent>
          </Dialog>

        <Dialog open={!!denyModal} onOpenChange={(open) => !open && setDenyModal(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Negar saque</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Solicitação: R$ {denyModal ? Number(denyModal.amount).toFixed(2) : "0,00"}</p>
              <Input
                placeholder="Motivo da negação"
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                className="mt-2"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setDenyModal(null)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleDeny} disabled={!denyReason.trim()}>Negar</Button>
              </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
      )}
    </div>
  );
}
