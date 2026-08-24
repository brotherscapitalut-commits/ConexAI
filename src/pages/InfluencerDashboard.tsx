import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  LogOut,
  MessageCircle,
  ExternalLink,
  Sparkles,
  Users,
  Wallet,
  TrendingUp,
  BarChart3,
  Heart,
  MousePointerClick,
  Building2,
  LayoutDashboard,
  CreditCard,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getPostLoginRedirect } from "@/lib/userRouting";
import AddInfluencerForm from "@/components/dashboard/AddInfluencerForm";
import InfluencerList from "@/components/dashboard/InfluencerList";
import ConversationsPanel from "@/components/dashboard/ConversationsPanel";
import InfluencerWalletSection from "@/components/dashboard/InfluencerWalletSection";
import InfluencerContractsSection from "@/components/dashboard/InfluencerContractsSection";
import InfluencerDirectOffersInbox from "@/components/dashboard/InfluencerDirectOffersInbox";
import ActiveCampaignsList from "@/components/dashboard/ActiveCampaignsList";
import MuralDeMarcasView from "@/components/dashboard/MuralDeMarcasView";
import AIAssistantWidget from "@/components/mural/AIAssistantWidget";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";
import { useProposalBadge } from "@/hooks/useProposalBadge";
import { useTrackInfluencerOnline } from "@/hooks/useOnlineInfluencerCount";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { cn } from "@/lib/utils";
import { glassBentoMural, glassBentoHoverInteraction } from "@/components/mural/bento/bentoTokens";

const GLASS_CARD = cn(glassBentoMural, glassBentoHoverInteraction, "border-amber-400/12");
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  counter_offer: "Contraproposta",
  accepted: "Aceita",
  under_review: "Em revisão",
  paid: "Paga",
};

interface ProposalItem {
  id: string;
  to_company_id: string;
  company_id?: string;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
  company_name?: string;
  company_logo?: string;
  company_color?: string;
}

type NexusTab = "visao-geral" | "carteira" | "buscar-marcas";

/** Nexus: centro de comando do influenciador — Abas (Visão Geral, Carteira & Ganhos, Buscar Marcas), poeira estelar, Ultra HD. */
const InfluencerDashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NexusTab>("visao-geral");
  const [muralOverlayOpen, setMuralOverlayOpen] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [pendingAmount, setPendingAmount] = useState<number>(0);
  const [withdrawals, setWithdrawals] = useState<{ amount: number; status: string; created_at: string }[]>([]);
  const [monthlyEarnings, setMonthlyEarnings] = useState<{ month: string; value: number }[]>([]);
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [clicksCount, setClicksCount] = useState<number>(0);
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const [influencerIds, setInfluencerIds] = useState<string[]>([]);
  const [proposalFilter, setProposalFilter] = useState<"all" | "pending" | "accepted" | "finalizadas">("all");
  const navigate = useNavigate();
  const location = useLocation();
  const openChatWithInfluencerId =
    (location.state as { openChatWithInfluencerId?: string } | null)?.openChatWithInfluencerId ?? null;
  const proposalBadgeCount = useProposalBadge(user?.id ?? null, { mode: "influencer" });
  useTrackInfluencerOnline(user?.id ?? null, true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigate("/auth");
        return;
      }
      const { type } = await getPostLoginRedirect(u.id);
      if (type === "admin") {
        navigate("/admin");
        return;
      }
      if (type === "company") {
        navigate("/dashboard");
        return;
      }
      setUser(u);
      setLoading(false);
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase.from("profiles").select("withdrawable_balance").eq("user_id", user.id).single();
      setBalance(Number((profile as { withdrawable_balance?: number })?.withdrawable_balance) || 0);
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: infs } = await supabase.from("influencers").select("id").eq("owner_id", user.id);
      const ids = (infs ?? []).map((i) => i.id);
      setInfluencerIds(ids);
      if (ids.length === 0) return;

      const { data: favs } = await supabase.from("favorite_influencers").select("id").in("influencer_id", ids);
      setFavoritesCount(favs?.length ?? 0);

      const { data: contactEvents } = await supabase.from("contact_events").select("id").in("to_influencer_id", ids);
      setClicksCount(contactEvents?.length ?? 0);
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [propRes, withdrawRes] = await Promise.all([
        supabase
          .from("partnership_proposals")
          .select("id, to_company_id, amount, status, created_at")
          .eq("from_user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("withdrawal_requests").select("amount, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      ]);
      const rows = (propRes.data ?? []) as { id: string; to_company_id: string; amount: number; status: string; created_at: string }[];
      const companyIds = [...new Set(rows.map((r) => r.to_company_id))];
      let companyMap: Record<string, { name?: string; logo?: string; color?: string }> = {};
      if (companyIds.length > 0) {
        const { data: comps } = await supabase.from("companies").select("id, name, logo_url, color").in("id", companyIds);
        comps?.forEach((c) => {
          companyMap[c.id] = { name: c.name, logo: (c as { logo_url?: string }).logo_url, color: (c as { color?: string }).color };
        });
      }
      setProposals(
        rows.map((r) => ({
          ...r,
          company_name: companyMap[r.to_company_id]?.name,
          company_logo: companyMap[r.to_company_id]?.logo,
          company_color: companyMap[r.to_company_id]?.color,
        }))
      );

      let pending = 0;
      rows.filter((r) => ["accepted", "under_review"].includes(r.status)).forEach((r) => (pending += r.amount));
      setPendingAmount(pending);

      const paid = rows.filter((r) => r.status === "paid");
      const byMonth: Record<string, number> = {};
      paid.forEach((r) => {
        const key = r.created_at.slice(0, 7);
        byMonth[key] = (byMonth[key] || 0) + r.amount;
      });
      const sorted = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, value]) => ({ month: month.slice(0, 4) + "/" + month.slice(5), value }));
      setMonthlyEarnings(sorted.length ? sorted : [{ month: new Date().toISOString().slice(0, 7).replace("-", "/"), value: 0 }]);

      setWithdrawals((withdrawRes.data ?? []).map((w: { amount: number; status: string; created_at: string }) => ({ amount: w.amount, status: w.status, created_at: w.created_at })));
    })();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] font-body">
        <div className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0A0A0A]/72 backdrop-blur-[15px]">
          <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6">
            <Skeleton className="h-6 w-32 bg-white/10" />
            <Skeleton className="h-8 w-24 bg-white/10" />
          </div>
        </div>
        <div className="relative w-full px-4 py-10 sm:px-6">
          <Skeleton className="mb-8 h-12 w-96 rounded-xl bg-white/10" />
          <Skeleton className="mb-6 h-48 rounded-2xl bg-white/10" />
          <Skeleton className="h-64 rounded-2xl bg-white/10" />
        </div>
      </div>
    );
  }

  const pendingBidsCount = proposals.filter((p) => p.status === "pending" || p.status === "counter_offer").length;

  return (
    <div className="relative min-h-screen bg-[#0A0A0A] font-body">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0A0A0A]/72 backdrop-blur-[15px]">
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-90 transition-opacity">
              <ConeXaiLogo textClassName="font-display font-bold text-base" showText />
            </Link>
            <span className="text-amber-400/90 text-sm font-medium hidden sm:inline">/ Nexus</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground truncate max-w-[180px]">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 w-full px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <h1 className="mb-2 flex items-center gap-2 font-display text-3xl font-bold text-foreground md:text-4xl">
            <Sparkles className="h-8 w-8 text-amber-400" style={{ filter: "drop-shadow(0 0 8px rgba(234,179,8,0.5))" }} />
            Nexus — Painel Bento
          </h1>
          <p className="text-muted-foreground">Tela infinita: ganhos, lances recebidos e campanhas.</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as NexusTab)} className="space-y-6">
          <TabsList className="w-full max-w-md grid grid-cols-3 rounded-xl bg-white/5 backdrop-blur-xl border border-amber-400/20 p-1 h-auto gap-1">
            <TabsTrigger
              value="visao-geral"
              className="rounded-lg data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 data-[state=active]:border data-[state=active]:border-amber-400/30 data-[state=active]:shadow-[0_0_12px_rgba(234,179,8,0.15)] py-2.5 gap-1.5"
            >
              <LayoutDashboard className="w-4 h-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger
              value="carteira"
              className="rounded-lg data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 data-[state=active]:border data-[state=active]:border-amber-400/30 data-[state=active]:shadow-[0_0_12px_rgba(234,179,8,0.15)] py-2.5 gap-1.5"
            >
              <CreditCard className="w-4 h-4" />
              Carteira & Ganhos
            </TabsTrigger>
            <TabsTrigger
              value="buscar-marcas"
              className="rounded-lg data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 data-[state=active]:border data-[state=active]:border-amber-400/30 data-[state=active]:shadow-[0_0_12px_rgba(234,179,8,0.15)] py-2.5 gap-1.5"
            >
              <Search className="w-4 h-4" />
              Buscar Marcas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="mt-0 space-y-10">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Dashboard Financeiro */}
        <section className="mb-0 xl:col-span-8 space-y-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <Wallet className="h-5 w-5 text-amber-400" />
            Saldo e Ganhos
          </h2>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className={`${GLASS_CARD} p-5`}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Total acumulado (disponível)</p>
              <p className="text-2xl font-display font-bold text-amber-400 tabular-nums">
                R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className={`${GLASS_CARD} p-5`}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">A receber (campanhas em andamento)</p>
              <p className="text-2xl font-display font-bold text-amber-300/90 tabular-nums">
                R$ {pendingAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className={`${GLASS_CARD} p-5`}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Últimos saques</p>
              <ul className="space-y-1 mt-1">
                {withdrawals.slice(0, 3).map((w, i) => (
                  <li key={i} className="text-sm flex justify-between">
                    <span className="text-muted-foreground">R$ {w.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    <span className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
                  </li>
                ))}
                {withdrawals.length === 0 && <li className="text-sm text-muted-foreground">Nenhum saque ainda</li>}
              </ul>
            </div>
          </div>
          <div className={`${GLASS_CARD} p-5`} style={{ minHeight: 220 }}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              Crescimento dos ganhos (mensal)
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={monthlyEarnings} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(234,179,8,0.4)" />
                    <stop offset="100%" stopColor="rgba(234,179,8,0)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickFormatter={(v) => `R$${v}`} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid rgba(234,179,8,0.2)", borderRadius: 8 }} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Ganho"]} />
                <Area type="monotone" dataKey="value" stroke="rgba(234,179,8,0.8)" fill="url(#goldGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <aside className="xl:col-span-4 space-y-4">
          <div className={`${GLASS_CARD} p-5`}>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Lances & propostas recebidos</p>
            <p className="font-display text-4xl font-bold tabular-nums text-amber-400">{pendingBidsCount}</p>
            <p className="mt-2 text-xs text-muted-foreground">Pendentes ou contraproposta — responda na lista abaixo.</p>
          </div>
          <div className={`${GLASS_CARD} p-5`}>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Propostas no total</p>
            <p className="font-display text-2xl font-bold tabular-nums text-white/90">{proposals.length}</p>
          </div>
        </aside>
        </div>

        {/* Gestor Financeiro: total em propostas aceitas */}
        {proposals.length > 0 && (
          <section className="mb-6">
            <div className={`${GLASS_CARD} p-5`}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Total em propostas aceitas</p>
              <p className="text-2xl font-display font-bold text-amber-400 tabular-nums">
                R$ {proposals.filter((p) => p.status === "accepted").reduce((s, p) => s + Number(p.amount || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </section>
        )}
        <InfluencerDirectOffersInbox userId={user.id} />

        {/* Campanhas em Negociação (Kanban/Lista) */}
        <section className="mb-10">
          <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            Campanhas em Negociação
            {proposalBadgeCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse">
                {proposalBadgeCount > 99 ? "99+" : proposalBadgeCount}
              </span>
            )}
          </h2>
          <div className={`${GLASS_CARD} overflow-hidden`}>
            {proposals.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma proposta em andamento. Envie propostas a marcas pelo mural.
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 border-amber-400/30 text-amber-200 hover:bg-amber-500/10 mt-3"
                  onClick={() => { setActiveTab("buscar-marcas"); setMuralOverlayOpen(true); }}
                >
                  <ExternalLink className="w-4 h-4" />
                  Buscar marcas no mural
                </Button>
              </div>
            ) : (
              <>
                <Tabs value={proposalFilter} onValueChange={(v) => setProposalFilter(v as typeof proposalFilter)} className="p-4 pb-0">
                  <TabsList className="bg-white/5 border border-white/10">
                    <TabsTrigger value="all">Todas</TabsTrigger>
                    <TabsTrigger value="pending">Pendentes</TabsTrigger>
                    <TabsTrigger value="accepted">Aceitas</TabsTrigger>
                    <TabsTrigger value="finalizadas">Finalizadas</TabsTrigger>
                  </TabsList>
                </Tabs>
                <ul className="divide-y divide-white/10">
                {(() => {
                  const filtered = proposalFilter === "all" ? proposals :
                    proposalFilter === "pending" ? proposals.filter((p) => p.status === "pending" || p.status === "counter_offer") :
                    proposalFilter === "accepted" ? proposals.filter((p) => p.status === "accepted") :
                    proposals.filter((p) => p.status === "under_review" || p.status === "paid");
                  return filtered.slice(0, 10).map((p) => (
                  <li key={p.id} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-display font-bold shrink-0"
                      style={{ backgroundColor: (p.company_color || "#6366f1") + "30", color: p.company_color || "#6366f1" }}
                    >
                      {p.company_logo ? (
                        <img src={p.company_logo} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      ) : (
                        (p.company_name || "E").slice(0, 1)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.company_name || "Empresa"}</p>
                      <p className="text-xs text-amber-400/90 tabular-nums">R$ {p.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                        p.status === "paid" ? "bg-emerald-500/20 text-emerald-400" : p.status === "pending" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                    <a href="#central-contatos" className="shrink-0">
                      <Button size="sm" variant="ghost" className="gap-1.5 text-amber-400 hover:bg-amber-500/10">
                        <MessageCircle className="w-4 h-4" />
                        Chat
                      </Button>
                    </a>
                  </li>
                  ));
                })()}
              </ul>
              </>
            )}
          </div>
        </section>

        {/* Analytics do Bloco */}
        <section className="mb-10">
          <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            Analytics do Bloco
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`${GLASS_CARD} p-5 flex items-center gap-4`}>
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-400/30">
                <MousePointerClick className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-amber-400 tabular-nums">{clicksCount}</p>
                <p className="text-xs text-muted-foreground">Cliques no seu perfil no mural</p>
              </div>
            </div>
            <div className={`${GLASS_CARD} p-5 flex items-center gap-4`}>
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-400/30">
                <Heart className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-amber-400 tabular-nums">{favoritesCount}</p>
                <p className="text-xs text-muted-foreground">Empresas que favoritaram você</p>
              </div>
            </div>
          </div>
        </section>

        {/* Meus perfis */}
        <section className="mb-10">
          <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Meus perfis
          </h2>
          <div className={`${GLASS_CARD} p-6 mb-6`}>
            <div className="flex flex-wrap gap-3">
            <AddInfluencerForm userId={user.id} onAdded={() => {}} />
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-xl border-amber-400/30 bg-white/5 hover:bg-amber-500/10 text-amber-200"
                onClick={() => setActiveTab("buscar-marcas")}
              >
                <ExternalLink className="w-4 h-4" />
                Buscar marcas no mural
              </Button>
            </div>
          </div>
          <InfluencerList userId={user.id} onDataReload={() => {}} />
        </section>

        {/* Central de Contatos e Mensagens (CRM) */}
        <section id="central-contatos" className="scroll-mt-6">
          <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-amber-400" />
            Central de Contatos e Mensagens
          </h2>
          <div className={`${GLASS_CARD} overflow-hidden`}>
            <ConversationsPanel
              userId={user.id}
              influencerIds={influencerIds}
              openConversationWithInfluencerId={openChatWithInfluencerId}
              variant="nexus"
            />
          </div>
        </section>
          </TabsContent>

          <TabsContent value="carteira" className="mt-0 space-y-10">
            <p className="text-muted-foreground text-sm">Saldo disponível, solicitar saque via PIX, meus contratos e campanhas abertas.</p>
            <InfluencerWalletSection userId={user.id} />
            <InfluencerContractsSection userId={user.id} />
            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-2 flex items-center gap-2">Campanhas abertas</h2>
              <p className="text-sm text-muted-foreground mb-4">Marcas que estão buscando influenciadores. Candidatar-se segue o fluxo de garantia (valor congelado → entrega → liberação - 15% taxa plataforma).</p>
              <ActiveCampaignsList userId={user.id} />
            </section>
          </TabsContent>

          <TabsContent value="buscar-marcas" className="mt-0">
            <div className={`${GLASS_CARD} p-8 text-center`}>
              <Search className="w-14 h-14 text-amber-400/80 mx-auto mb-4" style={{ filter: "drop-shadow(0 0 12px rgba(234,179,8,0.3))" }} />
              <h2 className="text-xl font-display font-bold text-foreground mb-2">Mural de Marcas</h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                Explore empresas no mural, envie propostas e gerencie suas campanhas. Tudo sem sair do Nexus.
              </p>
              <Button
                size="lg"
                className="gap-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-200 hover:bg-amber-500/30 shadow-[0_0_24px_rgba(234,179,8,0.15)]"
                onClick={() => setMuralOverlayOpen(true)}
              >
                <ExternalLink className="w-5 h-5" />
                Abrir mural de marcas
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {muralOverlayOpen && user && (
        <MuralDeMarcasView
          userId={user.id}
          onBackToNexus={() => setMuralOverlayOpen(false)}
          onOpenGanhos={() => { setMuralOverlayOpen(false); setActiveTab("carteira"); }}
        />
      )}

      <AIAssistantWidget
        onResult={(_companyIds, _influencerIds) => {}}
        companyId={null}
        companyName={user?.user_metadata?.display_name || user?.email?.split("@")[0] || null}
        className="fixed bottom-6 right-6 z-50"
      />
    </div>
  );
};

export default InfluencerDashboard;
