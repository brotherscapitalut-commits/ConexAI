import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Zap, 
  Activity, 
  ShieldAlert, 
  Users, 
  ArrowUpRight, 
  Flame,
  LayoutGrid,
  Filter
} from "lucide-react";
import { localDb } from "@/lib/localDbClient";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function AdminNexusPage() {
  const [bids, setBids] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalVolume: 0,
    platformProfit: 0,
    activeBids: 0,
    hotZones: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      // Fetch Bids
      const { data: bidsData } = await localDb.from("position_bids").select("*").order("created_at", { ascending: false });
      setBids(bidsData || []);

      // Calculate Stats
      const total = bidsData?.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0) || 0;
      setStats({
        totalVolume: total,
        platformProfit: total * 0.3,
        activeBids: bidsData?.filter((b: any) => b.status === 'pending').length || 0,
        hotZones: 12 // Placeholder for heatmap logic
      });
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-8 p-8 bg-[#0a0a0a] min-h-screen text-white">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black uppercase tracking-tighter text-white">
          Nexus <span className="text-primary">Control</span>
        </h1>
        <p className="text-white/40 font-mono text-xs uppercase tracking-widest">
          High-Value Real Estate Management System
        </p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Volume Total", value: `$${stats.totalVolume.toLocaleString()}`, icon: Activity, color: "text-blue-400" },
          { label: "Receita ConeXai", value: `$${stats.platformProfit.toLocaleString()}`, icon: Zap, color: "text-primary" },
          { label: "Bids Ativos", value: stats.activeBids, icon: ShieldAlert, color: "text-accent" },
          { label: "Hot Zones", value: stats.hotZones, icon: Flame, color: "text-orange-500" },
        ].map((stat, idx) => (
          <Card key={idx} className="bg-white/5 border-white/10 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/40">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black font-mono">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Transaction Ledger */}
        <Card className="xl:col-span-2 bg-white/5 border-white/10 backdrop-blur-xl overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/[0.02]">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              Transaction Ledger
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-white/[0.01]">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-[10px] font-bold uppercase text-white/30">ID</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-white/30">Valor</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-white/30">Status</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-white/30">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bids.map((bid) => (
                  <TableRow key={bid.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                    <TableCell className="font-mono text-[10px] text-white/50">{bid.id.slice(0, 8)}...</TableCell>
                    <TableCell className="font-bold font-mono text-primary">${bid.amount?.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[9px] uppercase font-black px-2 py-0",
                        bid.status === 'accepted' ? "border-primary text-primary" : 
                        bid.status === 'rejected' ? "border-destructive text-destructive" :
                        "border-accent text-accent animate-pulse"
                      )}>
                        {bid.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button className="p-1 hover:text-primary transition-colors">
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Control Panels */}
        <div className="space-y-8">
          <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Filter className="h-4 w-4 text-accent" />
                Heatmap Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[11px] text-white/40 leading-relaxed">
                As áreas centrais (A1-M50) apresentam <span className="text-primary font-bold">4.2x mais tráfego</span>. Ajustar preços base de reserva em +15%?
              </p>
              <button className="w-full h-10 bg-primary/10 border border-primary/20 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all">
                Otimizar Preços
              </button>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-400" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[11px] font-bold">Moderação de Marcas</span>
                <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/20">Ativo</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[11px] font-bold">Acesso ao Pulse</span>
                <Badge className="bg-primary/20 text-primary hover:bg-primary/20">Restrito</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
