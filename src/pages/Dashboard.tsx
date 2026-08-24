import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";
import {
  LogOut,
  MousePointerClick,
  TrendingUp,
  Calendar,
  MessageCircle,
  Sparkles,
  MapPin,
  Star,
  Wallet,
  AlertCircle,
  ShieldAlert,
  Link2,
  Copy,
  Blocks,
} from "lucide-react";
import { useProposalBadge } from "@/hooks/useProposalBadge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getPostLoginRedirect } from "@/lib/userRouting";
import DashboardStats from "@/components/dashboard/DashboardStats";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import CompanyList from "@/components/dashboard/CompanyList";
import SubscriptionList from "@/components/dashboard/SubscriptionList";
import PaymentHistory from "@/components/dashboard/PaymentHistory";
import AddCompanyForm from "@/components/dashboard/AddCompanyForm";
import BrandSimulator from "@/components/dashboard/BrandSimulator";
import AddInfluencerForm from "@/components/dashboard/AddInfluencerForm";
import InfluencerList from "@/components/dashboard/InfluencerList";
import ConversationsPanel from "@/components/dashboard/ConversationsPanel";
import ContactEventsLog from "@/components/dashboard/ContactEventsLog";
import EliteSuccessModal from "@/components/dashboard/EliteSuccessModal";
import CampaignsSection from "@/components/dashboard/CampaignsSection";
import ReceivedProposalsSection from "@/components/dashboard/ReceivedProposalsSection";
import PositionBidsSection from "@/components/dashboard/PositionBidsSection";
import DirectOffersSection from "@/components/dashboard/DirectOffersSection";
import ActiveCampaignsSection from "@/components/dashboard/ActiveCampaignsSection";
import AdvertiserStatus from "@/components/dashboard/AdvertiserStatus";
import DashboardNotifications, { type DashboardNotificationItem } from "@/components/dashboard/DashboardNotifications";
import NotificationsCenter from "@/components/dashboard/NotificationsCenter";
import LiveStatusTicker from "@/components/dashboard/LiveStatusTicker";
import DashboardTour from "@/components/dashboard/DashboardTour";
import AIAssistantWidget from "@/components/mural/AIAssistantWidget";
import { LOCAL_API_URL, getLocalAuthHeaders, localApiFetch } from "@/lib/localApi";

type CampaignsTab = "valor-fixo" | "ofertas" | "ativas";

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [campaignsTab, setCampaignsTab] = useState<CampaignsTab>("valor-fixo");
  const [unreadConversationsCount, setUnreadConversationsCount] = useState(0);
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [creditsAmount, setCreditsAmount] = useState("100");
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [eliteModalOpen, setEliteModalOpen] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [clicksData, setClicksData] = useState<any[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [clicksBySource, setClicksBySource] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [remainingBlocks, setRemainingBlocks] = useState(0);
  const [campaignCount, setCampaignCount] = useState(0);
  const [notifications, setNotifications] = useState<DashboardNotificationItem[]>([]);
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const openChatWithInfluencerId = (location.state as { openChatWithInfluencerId?: string } | null)?.openChatWithInfluencerId ?? null;

  const API = LOCAL_API_URL;
  const getAuthHeader = getLocalAuthHeaders;
  const { toast } = useToast();
  const { t } = useI18n();
  const proposalBadgeCount = useProposalBadge(user?.id ?? null, {
    mode: "company",
    companyIds: companies.map((c) => c.id),
  });

  const simulatedOwnerId = typeof window !== "undefined" ? localStorage.getItem("admin_simulate_owner_id") : null;
  const simulatedCompanyName = typeof window !== "undefined" ? localStorage.getItem("admin_simulate_company_name") : null;

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { type } = await getPostLoginRedirect(user.id);
      if (!simulatedOwnerId) {
        if (type === "admin") {
          navigate("/admin");
          return;
        }
        if (type === "influencer") {
          window.location.href = "/dashboard/influencer";
          return;
        }
      }

      setUser(user);
      const effectiveUserId = simulatedOwnerId || user.id;
      await loadData(effectiveUserId);
      setLoading(false);
    };
    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate, simulatedOwnerId]);

  useEffect(() => {
    if (loading || !user) return;
    const payment = searchParams.get("payment");
    if (payment === "canceled" || payment === "failed" || payment === "declined") {
      setSearchParams({}, { replace: true });
      toast({
        title: "Pagamento não concluído",
        description: "O pagamento foi cancelado ou recusado. Você pode tentar novamente quando quiser.",
        variant: "destructive",
      });
      return;
    }
    if (payment === "success") {
      const orderId = searchParams.get("order_id");
      setEliteModalOpen(true);
      setSearchParams({}, { replace: true });
      (async () => {
        try {
          const { playSuccessSound } = await import("@/lib/successSound");
          playSuccessSound();
        } catch (_) {
          /* som opcional */
        }
        try {
          const confetti = (await import("canvas-confetti")).default;
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
          setTimeout(() => {
            confetti({ particleCount: 80, spread: 60, origin: { x: 0.3, y: 0.8 } });
            confetti({ particleCount: 80, spread: 60, origin: { x: 0.7, y: 0.8 } });
          }, 200);
        } catch (_) {
          /* confetti opcional */
        }
      })();
      if (orderId) {
        localApiFetch("/api/checkout/manual-complete", {
          method: "POST",
          body: JSON.stringify({ order_id: orderId }),
        })
          .then((r) => r.json())
          .then((json) => {
            if (json.error) {
              toast({ title: "Aviso", description: json.error?.message ?? "Pedido manual não pôde ser concluído.", variant: "destructive" });
              return;
            }
            toast({ title: "Pedido manual concluído", description: `${json?.data?.inserted ?? 0} bloco(s) publicados no mural.` });
            if (user) loadData(user.id);
          })
          .catch(() => {
            toast({ title: "Erro", description: "Não foi possível concluir o pedido manual.", variant: "destructive" });
          });
        return;
      }

      const raw = sessionStorage.getItem("pendingBlocksPurchase");
      if (raw) {
        try {
          const payload = JSON.parse(raw) as { company_id: string; blocks: { x: number; y: number }[]; region: string; color?: string; logo_url?: string };
          fetch(`${API}/api/blocks/purchase`, {
            method: "POST",
            headers: getAuthHeader(),
            body: JSON.stringify(payload),
          })
            .then((r) => r.json())
            .then((json) => {
              sessionStorage.removeItem("pendingBlocksPurchase");
              if (json.error) {
                toast({ title: "Aviso", description: json.error?.message ?? "Blocos não puderam ser salvos.", variant: "destructive" });
                return;
              }
              toast({ title: "Blocos publicados", description: `${json?.data?.inserted ?? 0} bloco(s) salvos no mural.` });
            })
            .catch(() => {
              sessionStorage.removeItem("pendingBlocksPurchase");
              toast({ title: "Erro", description: "Não foi possível salvar os blocos.", variant: "destructive" });
            });
        } catch {
          sessionStorage.removeItem("pendingBlocksPurchase");
        }
      }
    }
  }, [loading, user, searchParams]);

  useEffect(() => {
    if (!user) return;
    fetch(`${API}/api/auth/referral-link`, { headers: getAuthHeader() })
      .then((r) => r.json())
      .then((json) => {
        const code = json?.data?.code;
        if (code) setReferralLink(`${typeof window !== "undefined" ? window.location.origin : ""}/auth?ref=${encodeURIComponent(code)}`);
      })
      .catch(() => {});
  }, [user]);

  const loadData = async (userId: string) => {
    // Companies: Saldo de Créditos vem de companies.influencer_credits_balance
    const { data: companiesData } = await supabase.from("companies").select("*").eq("owner_id", userId);
    setCompanies(companiesData || []);

    // Calculate remaining blocks
    const { count: occupiedBlocks } = await supabase
      .from("blocks")
      .select("*", { count: "exact", head: true })
      .in(
        "company_id",
        (companiesData || []).map((c) => c.id),
      );

    const totalPurchased = (companiesData || []).reduce((sum, c) => {
      // Count blocks associated with this company
      return sum;
    }, 0);

    if (companiesData && companiesData.length > 0) {
      const companyIds = companiesData.map((c) => c.id);

      // Contagem de campanhas em active_campaigns (para badge Bronze/Prata/Ouro)
      const { count: campaignsCount } = await supabase
        .from("active_campaigns")
        .select("*", { count: "exact", head: true })
        .in("company_id", companyIds);
      setCampaignCount(campaignsCount ?? 0);

      // Get remaining blocks (purchased minus occupied)
      const { data: blocks } = await supabase.from("blocks").select("*").in("company_id", companyIds);
      const { data: allPaidPayments } = await supabase
        .from("payments")
        .select("blocks_count")
        .in("company_id", companyIds)
        .eq("status", "completed");
      const totalBought = (allPaidPayments || []).reduce((sum, p) => sum + p.blocks_count, 0);
      const totalOccupied = (blocks || []).length;
      setRemainingBlocks(Math.max(0, totalBought - totalOccupied));

      const { data: clicks } = await supabase
        .from("clicks")
        .select("*")
        .in("company_id", companyIds)
        .order("created_at", { ascending: false });
      if (clicks) {
        setTotalClicks(clicks.length);
        const byDay: Record<string, number> = {};
        clicks.forEach((c) => {
          const day = new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
          byDay[day] = (byDay[day] || 0) + 1;
        });
        setClicksData(
          Object.entries(byDay)
            .slice(0, 14)
            .reverse()
            .map(([day, count]) => ({ day, cliques: count })),
        );
        const bySource: Record<string, number> = {};
        clicks.forEach((c) => {
          bySource[c.source || "mural"] = (bySource[c.source || "mural"] || 0) + 1;
        });
        setClicksBySource(Object.entries(bySource).map(([source, count]) => ({ source, cliques: count })));
      }

      const { data: paymentsData } = await supabase
        .from("payments")
        .select("*")
        .in("company_id", companyIds)
        .order("created_at", { ascending: false });
      setPayments(paymentsData || []);
    }

    // Load subscriptions from Stripe
    try {
      const { data: subsData } = await supabase.functions.invoke("check-subscription");
      if (subsData?.subscriptions) setSubscriptions(subsData.subscriptions);
    } catch (_) {
      /* check-subscription opcional */
    }
  };

  const handleLoadCredits = async () => {
    const companyId = companies[0]?.id;
    if (!companyId) {
      toast({ title: "Nenhuma empresa vinculada.", variant: "destructive" });
      return;
    }
    const amount = parseFloat(creditsAmount.replace(",", "."));
    if (isNaN(amount) || amount < 1) {
      toast({ title: "Informe um valor válido (mín. R$ 1).", variant: "destructive" });
      return;
    }
    setCreditsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-credits-checkout", {
        body: { company_id: companyId, amount },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      if (data?.ok) {
        toast({
          title: "Créditos adicionados",
          description: `R$ ${Number(data.amount_added ?? amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} adicionados em modo local/manual.`,
        });
        setCreditsModalOpen(false);
        if (user) await loadData(user.id);
        return;
      }
      toast({ title: "Créditos não adicionados", description: "Resposta local não trouxe confirmação.", variant: "destructive" });
    } catch (e: any) {
      toast({ title: "Erro ao carregar créditos", description: e?.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setCreditsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleCampaignCreated = async (campaignTitle: string) => {
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        type: "campaign_created",
        title: "Campanha criada com sucesso",
        description: campaignTitle || "Nova campanha",
        createdAt: new Date(),
      },
      ...prev.slice(0, 19),
    ]);
    setCampaignCount((c) => c + 1);
    try {
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 } });
    } catch (_) {
      /* confetti opcional */
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: { subscription_id: subscriptionId },
      });
      if (error) throw error;
      toast({ title: "Renovação cancelada", description: "Sua assinatura não será renovada automaticamente." });
      if (user) await loadData(user.id);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background/95 via-background/90 to-background/95">
        <div className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
          <div className="container mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="container mx-auto px-6 py-10">
          <Skeleton className="h-10 w-72 mb-8 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const exitSimulation = () => {
    localStorage.removeItem("admin_simulate_owner_id");
    localStorage.removeItem("admin_simulate_company_name");
    navigate("/admin/users");
  };

  return (
    <div className="min-h-screen bg-background">
      {simulatedOwnerId && (
        <div className="relative z-20 bg-amber-500/20 border-b border-amber-500/40 backdrop-blur-sm">
          <div className="container mx-auto px-6 py-2 flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Modo suporte: visualizando como <strong>{simulatedCompanyName || "Empresa"}</strong>
            </span>
            <Button size="sm" variant="outline" className="border-amber-600/50 text-amber-800 dark:text-amber-200 shrink-0" onClick={exitSimulation}>
              Sair da simulação
            </Button>
          </div>
        </div>
      )}
      <div className="border-b border-border/60 bg-background/95 backdrop-blur-md relative z-20">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-90 transition-opacity">
              <ConeXaiLogo textClassName="font-display font-bold" showText />
            </Link>
            <span className="text-muted-foreground text-sm font-medium">/ {t("dash.panel")}</span>
          </div>
          <div className="flex items-center gap-3">
            {(user?.email ?? "").toLowerCase().trim() === "brotherscapitalut@gmail.com" && (
              <Link
                to="/admin-master"
                className="relative z-50 flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm shrink-0 transition-colors bg-amber-500/90 hover:bg-amber-500 text-amber-950 border border-amber-400/60 shadow-md hover:shadow-lg"
                title="Painel Master"
              >
                <ShieldAlert className="w-4 h-4" />
                Painel Master
              </Link>
            )}
            <NotificationsCenter
              companyIds={companies.map((c) => c.id)}
              existingItems={notifications.map((n) => ({
                id: n.id,
                type: n.type === "campaign_created" ? "campaign_created" : "generic",
                title: n.title,
                description: n.description,
                createdAt: n.createdAt,
                read: false,
              }))}
            />
            <a
              href="#propostas-recebidas"
              className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              title="Propostas recebidas"
            >
              <MessageCircle className="w-5 h-5" />
              {proposalBadgeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg animate-pulse">
                  {proposalBadgeCount > 99 ? "99+" : proposalBadgeCount}
                </span>
              )}
            </a>
            <span className="text-sm text-muted-foreground truncate max-w-[200px]">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-2 text-foreground">{t("dash.title")}</h1>
            <p className="text-muted-foreground text-sm">{t("dash.subtitle")}</p>
          </div>
          <AdvertiserStatus campaignCount={campaignCount} />
        </div>

        <div className="mb-6">
          <LiveStatusTicker className="w-full max-w-xl" maxItems={6} rotationIntervalMs={4500} />
        </div>

        <section className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="#simulador" className="rounded-xl border border-border/70 bg-card/80 p-4 hover:border-primary/40 transition-colors">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operação</p>
            <h2 className="mt-1 text-base font-display font-semibold text-foreground">Publicar marca no mural</h2>
            <p className="mt-1 text-sm text-muted-foreground">Escolha blocos livres, revise o visual e publique em modo local.</p>
          </a>
          <button type="button" onClick={() => setCreditsModalOpen(true)} className="text-left rounded-xl border border-border/70 bg-card/80 p-4 hover:border-primary/40 transition-colors">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Carteira</p>
            <h2 className="mt-1 text-base font-display font-semibold text-foreground">Carregar créditos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Adicione saldo manual para ofertas e campanhas locais.</p>
          </button>
          <a href="#campanhas" className="rounded-xl border border-border/70 bg-card/80 p-4 hover:border-primary/40 transition-colors">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campanhas</p>
            <h2 className="mt-1 text-base font-display font-semibold text-foreground">Criar campanha</h2>
            <p className="mt-1 text-sm text-muted-foreground">Publique oportunidades para influenciadores do mural.</p>
          </a>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-10">
          <div className="lg:col-span-3">
            <DashboardStats
              totalClicks={totalClicks}
              remainingBlocks={remainingBlocks}
              clicksToday={clicksData.length > 0 ? clicksData[clicksData.length - 1]?.cliques || 0 : 0}
              trafficSources={clicksBySource.length}
            />
          </div>
          <div className="lg:col-span-1">
            <DashboardNotifications items={notifications} maxItems={5} />
          </div>
        </div>

        {/* Saldo de Créditos para Influencers (Painel de Finanças) */}
        {(() => {
          const creditsBalance = companies.reduce((sum, c) => sum + (Number(c.influencer_credits_balance) || 0), 0);
          return (
            <section className="mb-10" data-tour="financas">
              <Card className="card-premium overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 ring-1 ring-primary/20">
                      <Wallet className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-display font-semibold text-foreground">Saldo de Créditos para Influencers</h2>
                      <p className="text-2xl font-display font-bold text-primary tabular-nums mt-0.5">
                        R$ {creditsBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Use para comissões por clique e campanhas fixas com promotores.
                      </p>
                    </div>
                  </div>
                  {creditsBalance <= 0 && (
                    <div className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        Recarregue para atrair mais promotores.
                      </p>
                    </div>
                  )}
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant="outline" className="border-primary/50 text-primary" onClick={() => setCreditsModalOpen(true)}>
                      Carregar créditos
                    </Button>
                  </div>
                  {creditsModalOpen && (
                    <>
                      <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setCreditsModalOpen(false)} />
                      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-2xl border border-white/20 bg-card p-6 shadow-xl">
                        <h3 className="font-display font-bold text-lg mb-2">Carregar créditos</h3>
                        <p className="text-sm text-muted-foreground mb-4">Modo local/manual: o saldo entra direto na carteira da empresa para testar ofertas e campanhas.</p>
                        <Input type="text" inputMode="decimal" placeholder="Valor (R$)" value={creditsAmount} onChange={(e) => setCreditsAmount(e.target.value)} className="mb-4" />
                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1" onClick={() => setCreditsModalOpen(false)}>Cancelar</Button>
                          <Button className="flex-1" onClick={handleLoadCredits} disabled={creditsLoading}>{creditsLoading ? "Carregando..." : "Adicionar créditos"}</Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </section>
          );
        })()}

        {/* Seu Link de Convite (referral) */}
        <section className="mb-10" id="campanhas">
          <Card className="card-premium overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-muted ring-1 ring-border">
                  <Link2 className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-display font-semibold text-foreground">Seu Link de Convite</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Compartilhe com outros anunciantes. Cada cadastro via seu link usa um código único vinculado ao seu perfil.</p>
                  {referralLink && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <code className="text-xs bg-muted/80 px-2 py-1.5 rounded truncate max-w-full">{referralLink}</code>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1.5"
                        onClick={() => {
                          navigator.clipboard.writeText(referralLink);
                          toast({ title: "Link copiado", description: "Cole e compartilhe com quem quiser convidar." });
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copiar
                      </Button>
                    </div>
                  )}
                  {!referralLink && (
                    <p className="text-sm text-muted-foreground mt-2">Carregando seu link…</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA gamificado: escolher blocos e pagar */}
        <section className="mb-10">
          <Card className="card-premium border-primary/25 overflow-hidden">
            <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-2xl bg-primary/20 ring-2 ring-primary/40">
                  <Blocks className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-display font-bold text-foreground">{t("dash.cta_blocks_title")}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t("dash.cta_blocks_desc")}</p>
                </div>
              </div>
              <Link to="/precos">
                <Button size="lg" className="gap-2 rounded-xl font-display font-semibold shadow-lg">
                  <Blocks className="w-4 h-4" />
                  {t("dash.cta_choose_blocks")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        {/* Campanhas e Ofertas: valor fixo, ofertas diretas e campanhas ativas em uma única seção com abas */}
        <section className="mb-10">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <h2 className="text-lg font-display font-semibold text-foreground">Campanhas e Ofertas</h2>
            <div className="flex gap-1.5 flex-wrap">
              <Button
                variant={campaignsTab === "valor-fixo" ? "default" : "outline"}
                size="sm"
                onClick={() => setCampaignsTab("valor-fixo")}
              >
                Valor fixo e lista
              </Button>
              <Button
                variant={campaignsTab === "ofertas" ? "default" : "outline"}
                size="sm"
                onClick={() => setCampaignsTab("ofertas")}
              >
                Ofertas diretas
              </Button>
              <Button
                variant={campaignsTab === "ativas" ? "default" : "outline"}
                size="sm"
                onClick={() => setCampaignsTab("ativas")}
              >
                Campanhas ativas
              </Button>
            </div>
          </div>
          {campaignsTab === "valor-fixo" && (
            <CampaignsSection
              userId={user.id}
              companyIds={companies.map((c) => c.id)}
              onRefresh={() => user && loadData(user.id)}
              onCampaignCreated={handleCampaignCreated}
            />
          )}
          {campaignsTab === "ofertas" && (
            <DirectOffersSection
              companyIds={companies.map((c) => c.id)}
              onRefresh={() => user && loadData(user.id)}
            />
          )}
          {campaignsTab === "ativas" && (
            <ActiveCampaignsSection
              companyIds={companies.map((c) => c.id)}
              onRefresh={() => user && loadData(user.id)}
            />
          )}
        </section>

        <ReceivedProposalsSection
          userId={user.id}
          companyIds={companies.map((c) => c.id)}
          creditsBalance={companies.reduce((sum, c) => sum + (Number(c.influencer_credits_balance) || 0), 0)}
          onRefresh={() => user && loadData(user.id)}
        />

        <PositionBidsSection
          companyIds={companies.map((c) => c.id)}
          onRefresh={() => user && loadData(user.id)}
        />

        <DashboardCharts clicksData={clicksData} clicksBySource={clicksBySource} />

        <SubscriptionList subscriptions={subscriptions} onCancel={handleCancelSubscription} />

        <section className="mb-10">
          <h2 className="text-lg font-display font-semibold text-foreground mb-4">{t("dash.companies_and_influencers")}</h2>
          <div className="flex flex-wrap gap-3 mb-6">
            <AddCompanyForm userId={user.id} onCompanyAdded={() => user && loadData(user.id)} />
            <AddInfluencerForm userId={user.id} onAdded={() => user && loadData(user.id)} />
          </div>
          <CompanyList companies={companies} user={user} onDataReload={() => user && loadData(user.id)} />
          <InfluencerList userId={user.id} onDataReload={() => user && loadData(user.id)} />
        </section>

        <div id="simulador" data-tour="simulador">
          <BrandSimulator />
        </div>

        {/* Histórico de conversas com influencers + contatos realizados */}
        <section className="mb-10" id="conversas">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-display font-semibold text-foreground">{t("dash.conversations_and_contacts")}</h2>
            {unreadConversationsCount > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {unreadConversationsCount} nova{unreadConversationsCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-4">{t("dash.conversations_hint")}</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
              <ConversationsPanel
                userId={user.id}
                companyId={companies[0]?.id ?? null}
                openConversationWithInfluencerId={openChatWithInfluencerId}
                onUnreadCountChange={setUnreadConversationsCount}
              />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
              <ContactEventsLog userId={user.id} />
            </div>
          </div>
        </section>

        <PaymentHistory payments={payments} />
      </div>

      <DashboardTour />
      <AIAssistantWidget
        onResult={() => {}}
        companyId={companies[0]?.id ?? null}
        companyName={companies[0]?.name ?? null}
        className="fixed bottom-6 right-6 z-40"
      />
      <EliteSuccessModal
        open={eliteModalOpen}
        onClose={() => setEliteModalOpen(false)}
        userName={user?.user_metadata?.display_name || user?.email?.split("@")[0] || ""}
      />
    </div>
  );
};

export default Dashboard;
