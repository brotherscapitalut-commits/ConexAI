import { useState, useEffect } from "react";
import { localDb } from "@/lib/localDbClient";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, DollarSign, Activity } from "lucide-react";

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalVolume: 0,
    totalCommission: 0,
    activeBids: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data: bids } = await localDb.from("position_bids")
        .select("*, from_company:companies!from_company_id(name), to_company:companies!to_brand_id(name)")
        .order("created_at", { ascending: false });
      
      if (bids) {
        setTransactions(bids);
        
        const total = bids.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
        const commission = bids.filter((b: any) => b.status === 'accepted')
                               .reduce((acc: number, curr: any) => acc + Number(curr.amount) * 0.3, 0);
        const active = bids.filter((b: any) => b.status === 'pending').length;
        
        setStats({
          totalVolume: total,
          totalCommission: commission,
          activeBids: active
        });
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-white">Transações e Bids</h1>
        <p className="text-muted-foreground">Monitore o mercado de Digital Real Estate em tempo real.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Volume Total de Bids</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${stats.totalVolume.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+12% em relação ao mês anterior</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Comissões Acumuladas</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${stats.totalCommission.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">30% de taxa sobre biddings aceitos</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bids Ativos</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.activeBids}</div>
            <p className="text-xs text-muted-foreground">Aguardando resposta do proprietário</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Log de Transações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="border-white/5">
                <TableHead className="text-white/40">Data</TableHead>
                <TableHead className="text-white/40">De (Comprador)</TableHead>
                <TableHead className="text-white/40">Para (Dono)</TableHead>
                <TableHead className="text-white/40 text-right">Valor Total</TableHead>
                <TableHead className="text-white/40 text-right">Comissão (30%)</TableHead>
                <TableHead className="text-white/40">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="text-xs text-white/60">
                    {new Date(t.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-bold text-white">
                    {t.from_company?.name || "Desconhecido"}
                  </TableCell>
                  <TableCell className="font-bold text-white">
                    {t.to_company?.name || "Desconhecido"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-white">
                    ${Number(t.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-emerald-400">
                    ${(Number(t.amount) * 0.3).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      className={
                        t.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 
                        t.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' : 
                        'bg-red-500/20 text-red-400 border-red-500/20'
                      }
                    >
                      {t.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-white/30">
                    Nenhuma transação encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
