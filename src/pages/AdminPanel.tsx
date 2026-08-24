import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CrmPanel from "@/components/admin/CrmPanel";
import ContactEventsLog from "@/components/dashboard/ContactEventsLog";
import AdminMuralView from "@/components/admin/AdminMuralView";
import { AdminMuralConfig } from "@/components/admin/AdminMuralConfig";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";
import {
  Blocks,
  LogOut,
  ShieldCheck,
  Users,
  UserCircle,
  CheckCircle,
  XCircle,
  Search,
  Clock,
  Mail,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Building2,
  AlertTriangle,
  TrendingUp,
  Eye,
  CalendarDays,
  DollarSign,
  BarChart3,
  Globe,
  Phone,
  Instagram,
  AtSign,
  ExternalLink,
  Ban,
  Timer,
  MessageCircle,
  // Usado na linha ~565. Estava em uso sem import: como o painel admin nunca
  // chegava a renderizar (o redirect o expulsava antes), o ReferenceError
  // nunca aparecia.
  MousePointerClick,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
} from "recharts";

import AdminFinancePage from "./admin/AdminFinancePage";
import AdminUsersPage from "./admin/AdminUsersPage";
import AdminCompaniesPage from "./admin/AdminCompaniesPage";
import AdminInfluencersPage from "./admin/AdminInfluencersPage";
import AdminGrowthCampaignsPage from "./admin/AdminGrowthCampaignsPage";
import AdminTransactionsPage from "./admin/AdminTransactionsPage";
import AdminTeamPage from "./admin/AdminTeamPage";

interface WaitlistUser {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_approved: boolean;
  waitlist_position: number | null;
  created_at: string;
  companies_count?: number;
  account_status?: "active" | "excluded" | "banned" | "expired";
}

interface CompanyInfo {
  id: string;
  name: string;
  website: string;
  category: string;
  owner_id: string;
  moderation_status: string;
  mural_type: string;
  expires_at: string | null;
  created_at: string;
  contact_email: string | null;
  contact_whatsapp: string | null;
  instagram: string | null;
  tiktok: string | null;
  color: string;
  logo_initials: string;
}

interface PaymentInfo {
  id: string;
  amount: number;
  blocks_count: number;
  status: string;
  region: string;
  created_at: string;
  company_id: string;
  stripe_session_id: string | null;
  company_name?: string;
}

const CHART_COLORS = [
  "hsl(45, 92%, 55%)",
  "hsl(38, 80%, 45%)",
  "hsl(50, 95%, 62%)",
  "hsl(142, 72%, 42%)",
  "hsl(210, 70%, 55%)",
  "hsl(0, 72%, 51%)",
];

const AdminPanel = () => {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Waitlist
  const [users, setUsers] = useState<WaitlistUser[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "excluded" | "banned" | "expired">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<WaitlistUser | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Companies
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [companyFilter, setCompanyFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // Payments
  const [payments, setPayments] = useState<PaymentInfo[]>([]);

  // Blocks
  const [blockStats, setBlockStats] = useState({ total: 0, occupied: 0, reserved: 0, free: 0 });

  // Interactions (cliques no mural para Admin)
  const [interactions, setInteractions] = useState<{ id: string; company_id: string; block_x: number | null; block_y: number | null; source: string; created_at: string; company_name?: string }[]>([]);

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingUsers: 0,
    approvedUsers: 0,
    totalCompanies: 0,
    totalRevenue: 0,
    totalBlocks: 0,
    activeSubscriptions: 0,
    expiringCompanies: 0,
  });

  const [sortBy, setSortBy] = useState<"position" | "date">("position");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const navigate = useNavigate();
  const { toast } = useToast();

  /*
    A AUTORIZAÇÃO desta página é responsabilidade do <AdminMasterGuard> que
    envolve a rota /admin em App.tsx. Aqui só carregamos dados.

    Antes esta página fazia a própria verificação, por um caminho DIFERENTE do
    guard: consultava `supabase.auth.getUser()` e a tabela `user_roles`. Como o
    `useUserProfile` opera em modo bypass (sem sessão real do Supabase), essa
    checagem falhava e redirecionava para /dashboard — era por isso que clicar
    em "Admin" caía no painel da empresa, mesmo com o guard liberando o acesso.

    Duas fontes de verdade para a mesma pergunta sempre acabam divergindo. A
    regra passa a existir num lugar só: o guard.
  */
  useEffect(() => {
    const load = async () => {
      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser();
      if (sessionUser) setUser(sessionUser);

      setIsAdmin(true);
      await loadAllData();
      setLoading(false);
    };
    load();
  }, []);

  const loadAllData = async () => {
    await Promise.all([loadUsers(), loadCompanies(), loadPayments(), loadBlocks(), loadInteractions()]);
  };

  const loadInteractions = async () => {
    const { data } = await supabase.from("interactions").select("id, company_id, block_x, block_y, source, created_at").order("created_at", { ascending: false }).limit(200);
    if (!data) return;
    const companyIds = [...new Set(data.map((i) => i.company_id))];
    const { data: companiesData } = await supabase.from("companies").select("id, name").in("id", companyIds);
    const nameMap: Record<string, string> = {};
    companiesData?.forEach((c) => { nameMap[c.id] = c.name; });
    setInteractions(data.map((i) => ({ ...i, company_name: nameMap[i.company_id] || "—" })));
  };

  const loadUsers = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("waitlist_position", { ascending: true, nullsFirst: false });

    if (!profiles) return;

    const userIds = profiles.map((p) => p.user_id);
    const { data: companiesData } = await supabase.from("companies").select("owner_id").in("owner_id", userIds);

    const companyCounts: Record<string, number> = {};
    companiesData?.forEach((c) => {
      companyCounts[c.owner_id] = (companyCounts[c.owner_id] || 0) + 1;
    });

    const mapped: WaitlistUser[] = profiles.map((p) => ({
      ...p,
      companies_count: companyCounts[p.user_id] || 0,
    }));

    setUsers(mapped);
    setStats((prev) => ({
      ...prev,
      totalUsers: mapped.length,
      pendingUsers: mapped.filter((u) => !u.is_approved).length,
      approvedUsers: mapped.filter((u) => u.is_approved).length,
    }));
  };

  const loadCompanies = async () => {
    const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });

    if (data) {
      setCompanies(data);
      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      setStats((prev) => ({
        ...prev,
        totalCompanies: data.length,
        expiringCompanies: data.filter(
          (c) => c.expires_at && new Date(c.expires_at) <= thirtyDays && new Date(c.expires_at) > now,
        ).length,
      }));
    }
  };

  const loadPayments = async () => {
    const { data } = await supabase.from("payments").select("*").order("created_at", { ascending: false });

    if (data) {
      // Get company names
      const companyIds = [...new Set(data.map((p) => p.company_id))];
      const { data: companiesData } = await supabase.from("companies").select("id, name").in("id", companyIds);

      const nameMap: Record<string, string> = {};
      companiesData?.forEach((c) => {
        nameMap[c.id] = c.name;
      });

      const enriched = data.map((p) => ({ ...p, company_name: nameMap[p.company_id] || "—" }));
      setPayments(enriched);

      const totalRevenue = data.filter((p) => p.status === "completed").reduce((sum, p) => sum + p.amount, 0);
      const totalBlocks = data.filter((p) => p.status === "completed").reduce((sum, p) => sum + p.blocks_count, 0);

      setStats((prev) => ({
        ...prev,
        totalRevenue: totalRevenue / 100,
        totalBlocks,
      }));
    }
  };

  const loadBlocks = async () => {
    const { data } = await supabase.from("blocks").select("status");
    if (data) {
      setBlockStats({
        total: data.length,
        occupied: data.filter((b) => b.status === "occupied").length,
        reserved: data.filter((b) => b.status === "reserved").length,
        free: data.filter((b) => b.status === "free").length,
      });
    }
  };

  const handleApprove = async (profile: WaitlistUser) => {
    setActionLoading(profile.id);
    try {
      const { error } = await supabase.from("profiles").update({ is_approved: true }).eq("id", profile.id);

      if (error) throw error;

      await supabase.functions.invoke("send-approval-email", {
        body: { user_id: profile.user_id, action: "approved" },
      });

      toast({ title: "Usuário aprovado!", description: `${profile.display_name || "Usuário"} foi aprovado.` });
      await loadUsers();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedUser) return;
    setActionLoading(selectedUser.id);
    try {
      const { error } = await supabase.from("profiles").update({ is_approved: false }).eq("id", selectedUser.id);

      if (error) throw error;

      await supabase.functions.invoke("send-approval-email", {
        body: { user_id: selectedUser.user_id, action: "rejected", reason: rejectReason },
      });

      toast({ title: "Usuário rejeitado", description: `${selectedUser.display_name || "Usuário"} foi notificado.` });
      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedUser(null);
      await loadUsers();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleModeration = async (companyId: string, status: "approved" | "rejected") => {
    setActionLoading(companyId);
    try {
      const { error } = await supabase.from("companies").update({ moderation_status: status }).eq("id", companyId);

      if (error) throw error;
      toast({ title: `Empresa ${status === "approved" ? "aprovada" : "rejeitada"}` });
      await loadCompanies();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // Filtered data
  const filteredUsers = users
    .filter((u) => {
      if (filter === "pending") return !u.is_approved;
      if (filter === "approved") return u.is_approved;
      if (filter === "excluded") return (u.account_status ?? "active") === "excluded";
      if (filter === "banned") return (u.account_status ?? "active") === "banned";
      if (filter === "expired") return (u.account_status ?? "active") === "expired";
      return true;
    })
    .filter((u) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return u.display_name?.toLowerCase().includes(q) || u.user_id.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "position") {
        const ap = a.waitlist_position ?? 9999;
        const bp = b.waitlist_position ?? 9999;
        return sortDir === "asc" ? ap - bp : bp - ap;
      }
      return sortDir === "asc"
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const filteredCompanies = companies.filter((c) => {
    if (companyFilter === "all") return true;
    return c.moderation_status === companyFilter;
  });

  const toggleSort = (col: "position" | "date") => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: "position" | "date" }) =>
    sortBy === col ? (
      sortDir === "asc" ? (
        <ChevronUp className="w-3 h-3 inline" />
      ) : (
        <ChevronDown className="w-3 h-3 inline" />
      )
    ) : null;

  const getDaysRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // Chart data
  const paymentsByRegion = ["borda", "intermediaria", "centro_premium"].map((r) => ({
    region: r === "borda" ? "Borda" : r === "intermediaria" ? "Intermediária" : "Centro Premium",
    total: payments.filter((p) => p.region === r && p.status === "completed").reduce((s, p) => s + p.amount / 100, 0),
    count: payments.filter((p) => p.region === r && p.status === "completed").length,
  }));

  const blocksPieData = [
    { name: "Ocupados", value: blockStats.occupied },
    { name: "Reservados", value: blockStats.reserved },
    { name: "Livres", value: blockStats.free },
  ].filter((d) => d.value > 0);

  const paymentsByStatus = [
    { name: "Concluídos", value: payments.filter((p) => p.status === "completed").length },
    { name: "Pendentes", value: payments.filter((p) => p.status === "pending").length },
    { name: "Falhos", value: payments.filter((p) => !["completed", "pending"].includes(p.status)).length },
  ].filter((d) => d.value > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card/50 backdrop-blur-xl">
          <div className="container mx-auto px-6 h-16 flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
        <div className="container mx-auto px-6 py-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <Skeleton className="h-9 w-64 mb-2 rounded-lg" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
          <Skeleton className="h-11 w-full max-w-2xl mb-8 rounded-lg" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/50 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-90 transition-opacity">
              <ConeXaiLogo textClassName="font-display font-bold text-lg" showText />
            </Link>
            <span className="text-muted-foreground">/</span>
            <Badge className="bg-primary/10 text-primary border-primary/30 font-display font-medium">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Admin
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="outline" size="sm" className="border-border/50 text-muted-foreground hover:text-foreground">
                Dashboard
              </Button>
            </Link>
            <span className="text-sm text-muted-foreground truncate max-w-[180px]">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Painel Administrativo</h1>
            <p className="text-muted-foreground mt-2 font-medium">Gestão de usuários, empresas e pagamentos</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAllData} className="border-border/50">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar tudo
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card/60 border border-border/50 mb-8 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger
              value="waitlist"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Users className="w-4 h-4 mr-1" />
              Lista de Espera
              {stats.pendingUsers > 0 && (
                <Badge className="ml-1 bg-destructive/20 text-destructive text-xs px-1.5">{stats.pendingUsers}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="companies"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Building2 className="w-4 h-4 mr-1" />
              Empresas
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <CreditCard className="w-4 h-4 mr-1" />
              Pagamentos
            </TabsTrigger>
            <TabsTrigger
              value="alerts"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              Alertas
              {stats.expiringCompanies > 0 && (
                <Badge className="ml-1 bg-destructive/20 text-destructive text-xs px-1.5">
                  {stats.expiringCompanies}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="crm"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Users className="w-4 h-4 mr-1" />
              CRM
            </TabsTrigger>
            <TabsTrigger
              value="mural"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Blocks className="w-4 h-4 mr-1" />
              Mural
            </TabsTrigger>
            <TabsTrigger
              value="contacts"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <MessageCircle className="w-4 h-4 mr-1" />
              Contatos
            </TabsTrigger>
            <TabsTrigger
              value="comunicacoes"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <MousePointerClick className="w-4 h-4 mr-1" />
              Comunicações
              {interactions.length > 0 && (
                <Badge className="ml-1 bg-primary/20 text-primary text-xs px-1.5">{interactions.length}</Badge>
              )}
            </TabsTrigger>
            
            {/* Novas Abas Importadas */}
            <TabsTrigger value="admin_finance" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <DollarSign className="w-4 h-4 mr-1" />
              Finanças Hub
            </TabsTrigger>
            <TabsTrigger value="admin_users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="w-4 h-4 mr-1" />
              Usuários Hub
            </TabsTrigger>
            <TabsTrigger value="admin_companies" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Building2 className="w-4 h-4 mr-1" />
              Dossiê Empresas
            </TabsTrigger>
            <TabsTrigger value="admin_influencers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <UserCircle className="w-4 h-4 mr-1" />
              Influencers
            </TabsTrigger>
            <TabsTrigger value="admin_growth" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <TrendingUp className="w-4 h-4 mr-1" />
              Growth
            </TabsTrigger>
            <TabsTrigger value="admin_transactions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Globe className="w-4 h-4 mr-1" />
              Mercado & Bids
            </TabsTrigger>
            <TabsTrigger value="admin_team" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ShieldCheck className="w-4 h-4 mr-1" />
              Equipe
            </TabsTrigger>
          </TabsList>

          {/* ==================== OVERVIEW TAB ==================== */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                {
                  icon: Users,
                  label: "Usuários",
                  value: stats.totalUsers,
                  sub: `${stats.pendingUsers} pendentes`,
                  color: "text-primary",
                },
                {
                  icon: Building2,
                  label: "Empresas",
                  value: stats.totalCompanies,
                  sub: `${stats.expiringCompanies} expirando`,
                  color: "text-primary",
                },
                {
                  icon: DollarSign,
                  label: "Receita Total",
                  value: `$${stats.totalRevenue.toLocaleString()}`,
                  sub: `${payments.filter((p) => p.status === "completed").length} pagamentos`,
                  color: "text-success",
                },
                {
                  icon: Blocks,
                  label: "Blocos Vendidos",
                  value: stats.totalBlocks,
                  sub: `${blockStats.occupied} ocupados`,
                  color: "text-primary",
                },
              ].map((stat, i) => (
                <Card key={i} className="glass-card">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-2xl font-display font-bold mt-1">{stat.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                      </div>
                      <stat.icon className={`w-10 h-10 ${stat.color} opacity-60`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-display">Receita por Região</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={paymentsByRegion}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 20%)" />
                      <XAxis dataKey="region" tick={{ fill: "hsl(40, 12%, 55%)", fontSize: 12 }} />
                      <YAxis tick={{ fill: "hsl(40, 12%, 55%)", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(43, 30%, 14%)",
                          border: "1px solid hsl(40, 20%, 20%)",
                          borderRadius: "8px",
                          color: "hsl(45, 20%, 92%)",
                        }}
                      />
                      <Bar dataKey="total" fill="hsl(45, 92%, 55%)" radius={[4, 4, 0, 0]} name="USD" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-display">Status dos Blocos</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  {blocksPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={blocksPieData}
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {blocksPieData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "hsl(43, 30%, 14%)",
                            border: "1px solid hsl(40, 20%, 20%)",
                            borderRadius: "8px",
                            color: "hsl(45, 20%, 92%)",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-sm py-12">Nenhum bloco registrado</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ==================== WAITLIST TAB ==================== */}
          <TabsContent value="waitlist">
            <Card className="glass-card mb-6">
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-background/50"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["pending", "approved", "excluded", "banned", "expired", "all"] as const).map((f) => (
                    <Button
                      key={f}
                      variant={filter === f ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilter(f)}
                    >
                      {f === "pending" ? `Pendentes (${stats.pendingUsers})` : f === "approved" ? "Aprovados" : f === "excluded" ? "Excluídos" : f === "banned" ? "Banidos" : f === "expired" ? "Não renovaram" : "Todos"}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <Users className="w-5 h-5 text-primary" />
                  Lista de Espera ({filteredUsers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("position")}>
                          # <SortIcon col="position" />
                        </TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("date")}>
                          Cadastro <SortIcon col="date" />
                        </TableHead>
                        <TableHead>Empresas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                            Nenhum usuário encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((u) => (
                          <TableRow key={u.id} className="border-border/30">
                            <TableCell className="font-mono text-sm text-primary">
                              {u.waitlist_position ?? "—"}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{u.display_name || "Sem nome"}</p>
                              <p className="text-xs text-muted-foreground font-mono">{u.user_id.slice(0, 8)}...</p>
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(u.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell>{u.companies_count}</TableCell>
                            <TableCell>
                              {u.is_approved ? (
                                <Badge className="bg-success/10 text-success border-success/30">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Aprovado
                                </Badge>
                              ) : (
                                <Badge className="bg-warning/10 text-warning border-warning/30">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pendente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                {!u.is_approved && (
                                  <Button
                                    size="sm"
                                    disabled={actionLoading === u.id}
                                    onClick={() => handleApprove(u)}
                                    className="bg-success hover:bg-success/90 text-success-foreground"
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    {actionLoading === u.id ? "..." : "Aprovar"}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={actionLoading === u.id}
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setRejectDialogOpen(true);
                                  }}
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Rejeitar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== COMPANIES TAB ==================== */}
          <TabsContent value="companies">
            <div className="flex gap-2 mb-6">
              {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                <Button
                  key={f}
                  variant={companyFilter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCompanyFilter(f)}
                >
                  {f === "all"
                    ? "Todas"
                    : f === "pending"
                      ? "Pendentes"
                      : f === "approved"
                        ? "Aprovadas"
                        : "Rejeitadas"}
                  {f === "all" && ` (${companies.length})`}
                </Button>
              ))}
            </div>

            <div className="grid gap-4">
              {filteredCompanies.length === 0 ? (
                <Card className="glass-card">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Nenhuma empresa encontrada
                  </CardContent>
                </Card>
              ) : (
                filteredCompanies.map((c) => {
                  const days = getDaysRemaining(c.expires_at);
                  return (
                    <Card key={c.id} className="glass-card">
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          {/* Logo */}
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                            style={{
                              backgroundColor: c.color + "20",
                              color: c.color,
                              border: `1px solid ${c.color}40`,
                            }}
                          >
                            {c.logo_initials}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-display font-bold">{c.name}</h3>
                              <Badge variant="outline" className="text-xs">
                                {c.category}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {c.mural_type}
                              </Badge>
                              {c.moderation_status === "pending" && (
                                <Badge className="bg-warning/10 text-warning border-warning/30 text-xs">Pendente</Badge>
                              )}
                              {c.moderation_status === "approved" && (
                                <Badge className="bg-success/10 text-success border-success/30 text-xs">Aprovada</Badge>
                              )}
                              {c.moderation_status === "rejected" && (
                                <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                                  Rejeitada
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                              <a
                                href={c.website}
                                target="_blank"
                                rel="noopener"
                                className="flex items-center gap-1 hover:text-primary"
                              >
                                <Globe className="w-3 h-3" />
                                {c.website}
                              </a>
                              {c.contact_email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {c.contact_email}
                                </span>
                              )}
                              {c.contact_whatsapp && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {c.contact_whatsapp}
                                </span>
                              )}
                              {c.instagram && (
                                <span className="flex items-center gap-1">
                                  <Instagram className="w-3 h-3" />@{c.instagram}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Expiration */}
                          <div className="flex items-center gap-4 shrink-0">
                            {days !== null && (
                              <div className="text-right">
                                <p
                                  className={`text-sm font-bold ${days <= 30 ? "text-destructive" : days <= 90 ? "text-warning" : "text-success"}`}
                                >
                                  {days} dias restantes
                                </p>
                                <Progress value={Math.min(100, (days / 365) * 100)} className="w-24 h-1.5 mt-1" />
                              </div>
                            )}

                            {c.moderation_status === "pending" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={actionLoading === c.id}
                                  onClick={() => handleModeration(c.id, "approved")}
                                  className="bg-success hover:bg-success/90 text-success-foreground"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={actionLoading === c.id}
                                  onClick={() => handleModeration(c.id, "rejected")}
                                >
                                  <Ban className="w-3 h-3 mr-1" />
                                  Rejeitar
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* ==================== PAYMENTS TAB ==================== */}
          <TabsContent value="payments">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="glass-card">
                <CardContent className="p-6 flex items-center gap-4">
                  <DollarSign className="w-8 h-8 text-success opacity-60" />
                  <div>
                    <p className="text-2xl font-display font-bold">${stats.totalRevenue.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Receita total</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-6 flex items-center gap-4">
                  <CheckCircle className="w-8 h-8 text-success opacity-60" />
                  <div>
                    <p className="text-2xl font-display font-bold">
                      {payments.filter((p) => p.status === "completed").length}
                    </p>
                    <p className="text-sm text-muted-foreground">Pagamentos concluídos</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardContent className="p-6 flex items-center gap-4">
                  <Clock className="w-8 h-8 text-warning opacity-60" />
                  <div>
                    <p className="text-2xl font-display font-bold">
                      {payments.filter((p) => p.status === "pending").length}
                    </p>
                    <p className="text-sm text-muted-foreground">Pagamentos pendentes</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Histórico de Pagamentos ({payments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead>Data</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Região</TableHead>
                        <TableHead>Blocos</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                            Nenhum pagamento
                          </TableCell>
                        </TableRow>
                      ) : (
                        payments.slice(0, 50).map((p) => (
                          <TableRow key={p.id} className="border-border/30">
                            <TableCell className="text-sm">
                              {new Date(p.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="font-medium">{p.company_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {p.region}
                              </Badge>
                            </TableCell>
                            <TableCell>{p.blocks_count}</TableCell>
                            <TableCell className="font-mono">${(p.amount / 100).toFixed(2)}</TableCell>
                            <TableCell>
                              {p.status === "completed" ? (
                                <Badge className="bg-success/10 text-success border-success/30 text-xs">
                                  Concluído
                                </Badge>
                              ) : p.status === "pending" ? (
                                <Badge className="bg-warning/10 text-warning border-warning/30 text-xs">Pendente</Badge>
                              ) : (
                                <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                                  {p.status}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== ALERTS TAB ==================== */}
          <TabsContent value="alerts">
            <div className="space-y-4">
              {/* Expiring companies */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Timer className="w-5 h-5 text-warning" />
                    Empresas Expirando (próximos 30 dias)
                  </CardTitle>
                  <CardDescription>Assinaturas que precisam de atenção</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const now = new Date();
                    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                    const expiring = companies.filter(
                      (c) => c.expires_at && new Date(c.expires_at) <= thirtyDays && new Date(c.expires_at) > now,
                    );

                    if (expiring.length === 0) {
                      return (
                        <p className="text-muted-foreground text-sm py-8 text-center">
                          Nenhuma empresa expirando nos próximos 30 dias 🎉
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {expiring.map((c) => {
                          const days = getDaysRemaining(c.expires_at)!;
                          return (
                            <div
                              key={c.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/30"
                            >
                              <div className="flex items-center gap-3">
                                <AlertTriangle
                                  className={`w-5 h-5 ${days <= 7 ? "text-destructive" : "text-warning"}`}
                                />
                                <div>
                                  <p className="font-medium">{c.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {c.contact_email || c.contact_whatsapp || "Sem contato"}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-bold ${days <= 7 ? "text-destructive" : "text-warning"}`}>
                                  {days} dias
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Expira em {new Date(c.expires_at!).toLocaleDateString("pt-BR")}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Pending moderations */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Eye className="w-5 h-5 text-info" />
                    Moderação Pendente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const pending = companies.filter((c) => c.moderation_status === "pending");
                    if (pending.length === 0) {
                      return (
                        <p className="text-muted-foreground text-sm py-8 text-center">
                          Nenhuma empresa aguardando moderação
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-3">
                        {pending.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/30"
                          >
                            <div>
                              <p className="font-medium">{c.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {c.category} · {c.mural_type}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleModeration(c.id, "approved")}
                                className="bg-success hover:bg-success/90 text-success-foreground"
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleModeration(c.id, "rejected")}
                              >
                                <Ban className="w-3 h-3 mr-1" />
                                Rejeitar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Users without companies */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    Usuários aprovados sem empresas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const noCompany = users.filter((u) => u.is_approved && (u.companies_count || 0) === 0);
                    if (noCompany.length === 0) {
                      return (
                        <p className="text-muted-foreground text-sm py-8 text-center">
                          Todos os aprovados têm pelo menos uma empresa
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {noCompany.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/30"
                          >
                            <div>
                              <p className="font-medium">{u.display_name || "Sem nome"}</p>
                              <p className="text-xs text-muted-foreground">
                                Aprovado em {new Date(u.created_at).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              Sem empresa
                            </Badge>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ==================== CRM TAB ==================== */}
          <TabsContent value="crm">
            <CrmPanel userId={user?.id} />
          </TabsContent>

          {/* ==================== MURAL TAB ==================== */}
          <TabsContent value="mural" className="space-y-6">
            <AdminMuralConfig />
            <AdminMuralView />
          </TabsContent>

          {/* ==================== CONTACTS TAB ==================== */}
          <TabsContent value="contacts">
            <div className="max-w-4xl">
              <h3 className="text-xl font-display font-bold mb-4">Registro de Contatos</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Todos os contatos realizados entre empresas e influenciadores na plataforma.
              </p>
              <ContactEventsLog userId={user?.id} isAdmin={true} />
            </div>
          </TabsContent>

          {/* ==================== NOVAS ABAS IMPORTADAS ==================== */}
          <TabsContent value="admin_finance" className="p-0 border-none">
            <AdminFinancePage />
          </TabsContent>
          <TabsContent value="admin_users" className="p-0 border-none">
            <AdminUsersPage />
          </TabsContent>
          <TabsContent value="admin_companies" className="p-0 border-none">
            <AdminCompaniesPage />
          </TabsContent>
          <TabsContent value="admin_influencers" className="p-0 border-none">
            <AdminInfluencersPage />
          </TabsContent>
          <TabsContent value="admin_growth" className="p-0 border-none">
            <AdminGrowthCampaignsPage />
          </TabsContent>
          <TabsContent value="admin_transactions" className="p-0 border-none">
            <AdminTransactionsPage />
          </TabsContent>
          <TabsContent value="admin_team" className="p-0 border-none">
            <AdminTeamPage />
          </TabsContent>
        </Tabs>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="glass-card-strong">
          <DialogHeader>
            <DialogTitle className="font-display">Rejeitar usuário</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enviar notificação de rejeição para <strong>{selectedUser?.display_name || "este usuário"}</strong>?
          </p>
          <Textarea
            placeholder="Motivo da rejeição (opcional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="bg-background/50"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading === selectedUser?.id}>
              {actionLoading === selectedUser?.id ? "Enviando..." : "Rejeitar e notificar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
