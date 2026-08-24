import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Blocks,
  LogOut,
  UserPlus,
  MessageCircle,
  ExternalLink,
  Sparkles,
  Users,
  BarChart3,
  Tag,
  Bell,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPostLoginRedirect } from "@/lib/userRouting";
import AddInfluencerForm from "@/components/dashboard/AddInfluencerForm";
import InfluencerList from "@/components/dashboard/InfluencerList";
import ConversationsPanel from "@/components/dashboard/ConversationsPanel";
import InfluencerContractsSection from "@/components/dashboard/InfluencerContractsSection";
import InfluencerWalletSection from "@/components/dashboard/InfluencerWalletSection";
import { INFLUENCER_CATEGORIES } from "@/data/influencerMockData";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";

const NEON_CARD_CLASS =
  "rounded-2xl border bg-white/5 backdrop-blur-xl shadow-xl overflow-hidden " +
  "border-fuchsia-400/30 shadow-[0_0_20px_rgba(217,70,239,0.15)] hover:shadow-[0_0_28px_rgba(217,70,239,0.25)] hover:border-fuchsia-400/50 transition-all duration-300";

/** Portal de Influencers: mesma sofisticação do portal de empresas — poeira estelar, vidro fosco, cards neon, Solicitações de Match (IA). */
const InfluencerPortalPage = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<{ id: string; from_user_id: string; created_at: string }[]>([]);
  const [matchRequests, setMatchRequests] = useState<{ company_name: string; category: string; fit: string }[]>([]);
  const [metrics, setMetrics] = useState<{ reach: number; campaigns: number }>({ reach: 0, campaigns: 0 });
  const navigate = useNavigate();

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
    const loadProposals = async () => {
      const { data: myInfluencers } = await supabase.from("influencers").select("id").eq("owner_id", user.id);
      const ids = (myInfluencers ?? []).map((i) => i.id);
      if (ids.length === 0) {
        setProposals([]);
        return;
      }
      const { data } = await supabase
        .from("contact_events")
        .select("id, from_user_id, created_at")
        .in("to_influencer_id", ids)
        .eq("contact_type", "partnership_proposal")
        .order("created_at", { ascending: false })
        .limit(50);
      setProposals(data ?? []);
    };
    loadProposals();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const loadMetricsAndMatches = async () => {
      try {
        const { data: infs } = await supabase.from("influencers").select("id, followers_count").eq("owner_id", user.id);
        const ids = (infs ?? []).map((i) => i.id);
        const totalReach = (infs ?? []).reduce((s, i) => s + (Number(i.followers_count) || 0), 0);
        let campaigns = 0;
        if (ids.length > 0) {
          const { count } = await supabase
            .from("partnership_proposals")
            .select("id", { count: "exact", head: true })
            .in("influencer_id", ids);
          campaigns = count ?? 0;
        }
        setMetrics({ reach: totalReach, campaigns });
        const infId = infs?.[0]?.id;
        if (infId) {
          try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/ai/match-requests?influencer_id=${infId}`);
            if (res.ok) {
              const data = await res.json();
              setMatchRequests(data.requests ?? []);
            }
          } catch {
            setMatchRequests([]);
          }
        }
      } catch {
        setMetrics({ reach: 0, campaigns: 0 });
        setMatchRequests([]);
      }
    };
    loadMetricsAndMatches();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0612]">
        <div className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(88, 28, 135, 0.2) 0%, transparent 50%), radial-gradient(ellipse 60% 80% at 80% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 45%)",
          }}
        />
        <div className="relative border-b border-white/10 bg-white/5 backdrop-blur-xl">
          <div className="container mx-auto px-6 h-16 flex items-center justify-between">
            <Skeleton className="h-6 w-32 bg-white/10" />
            <Skeleton className="h-8 w-24 bg-white/10" />
          </div>
        </div>
        <div className="relative container mx-auto px-6 py-10">
          <Skeleton className="h-10 w-64 mb-6 rounded-xl bg-white/10" />
          <Skeleton className="h-48 rounded-2xl mb-6 bg-white/10" />
          <Skeleton className="h-64 rounded-2xl bg-white/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0612] relative">
      {/* Poeira estelar (fundo roxo cósmico) */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(88, 28, 135, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse 60% 80% at 80% 80%, rgba(88, 28, 135, 0.08) 0%, transparent 45%),
            radial-gradient(ellipse 50% 60% at 20% 60%, rgba(139, 92, 246, 0.06) 0%, transparent 40%),
            radial-gradient(circle at 30% 30%, rgba(217, 70, 239, 0.05) 0%, transparent 25%)
          `,
        }}
      />

      {/* Header: vidro fosco */}
      <div className="relative z-10 border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-90 transition-opacity">
              <ConeXaiLogo textClassName="font-display font-bold text-base" showText />
            </Link>
            <span className="text-muted-foreground text-sm font-medium hidden sm:inline">/ Portal Influenciador</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground truncate max-w-[180px]">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2 text-foreground flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-fuchsia-400" />
            Portal de Influencers
          </h1>
          <p className="text-muted-foreground">Dashboard em Ultra HD. Métricas, campanhas e matches com marcas pela IA ConeXai.</p>
        </div>

        {/* Cards neon: Métricas de Alcance + Campanhas Ativas */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className={NEON_CARD_CLASS}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 flex items-center justify-center border border-fuchsia-400/30">
                  <BarChart3 className="w-5 h-5 text-fuchsia-400" />
                </div>
                <h2 className="text-lg font-display font-semibold text-foreground">Métricas de Alcance</h2>
              </div>
              <p className="text-3xl font-display font-bold text-fuchsia-300 tabular-nums">
                {metrics.reach >= 1e6 ? `${(metrics.reach / 1e6).toFixed(1)}M` : metrics.reach >= 1e3 ? `${(metrics.reach / 1e3).toFixed(1)}K` : metrics.reach}
              </p>
              <p className="text-sm text-muted-foreground mt-1">seguidores totais nos perfis cadastrados</p>
            </div>
          </div>
          <div className={NEON_CARD_CLASS}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 flex items-center justify-center border border-fuchsia-400/30">
                  <Zap className="w-5 h-5 text-fuchsia-400" />
                </div>
                <h2 className="text-lg font-display font-semibold text-foreground">Campanhas Ativas</h2>
              </div>
              <p className="text-3xl font-display font-bold text-fuchsia-300 tabular-nums">{metrics.campaigns}</p>
              <p className="text-sm text-muted-foreground mt-1">propostas de parceria recebidas</p>
            </div>
          </div>
        </section>

        {/* Solicitações de Match (IA) */}
        <section className="mb-10">
          <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-fuchsia-400" />
            Solicitações de Match
            <span className="text-xs font-normal text-muted-foreground">(sugestões da IA)</span>
          </h2>
          <div className={`${NEON_CARD_CLASS} p-6`}>
            <p className="text-sm text-muted-foreground mb-4">
              Marcas que combinam com seu perfil, sugeridas pela IA da ConeXai. Acesse o mural para ver todas e enviar propostas.
            </p>
            {matchRequests.length > 0 ? (
              <ul className="space-y-2">
                {matchRequests.slice(0, 5).map((m, i) => (
                  <li key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 border border-white/10">
                    <span className="font-medium text-sm">{m.company_name}</span>
                    <span className="text-xs text-fuchsia-400">{m.category}</span>
                    <span className="text-xs text-muted-foreground">Fit: {m.fit}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Sparkles className="w-10 h-10 text-fuchsia-400/50 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma sugestão de match no momento. Complete seu perfil e apareça no mural para receber indicações.</p>
                <Link to="/" className="mt-4">
                  <Button variant="outline" size="sm" className="gap-2 border-fuchsia-400/30 text-fuchsia-300 hover:bg-fuchsia-500/20">
                    <ExternalLink className="w-4 h-4" />
                    Explorar mural
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Alertas de parceria */}
        {proposals.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-fuchsia-400" />
              Propostas de parceria
              <span className="text-sm font-normal text-muted-foreground">({proposals.length})</span>
            </h2>
            <div className={`${NEON_CARD_CLASS} overflow-hidden`}>
              <ul className="divide-y divide-white/10">
                {proposals.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-fuchsia-500/20 flex items-center justify-center border border-fuchsia-400/20">
                        <UserPlus className="w-5 h-5 text-fuchsia-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Nova proposta de parceria</p>
                        <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Meus perfis */}
        <section className="mb-10">
          <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-fuchsia-400" />
            Meus perfis
          </h2>
          <div className={`${NEON_CARD_CLASS} p-6 mb-6`}>
            <p className="text-sm text-muted-foreground mb-4">Cadastre ou edite seu perfil: métricas, redes e categorias para aparecer no mural e receber matches.</p>
            <div className="flex flex-wrap gap-3">
              <AddInfluencerForm userId={user.id} onAdded={() => {}} />
              <Link to="/">
                <Button variant="outline" size="sm" className="gap-2 rounded-xl border-fuchsia-400/30 bg-white/5 hover:bg-fuchsia-500/10 text-fuchsia-200">
                  <ExternalLink className="w-4 h-4" />
                  Ver mural
                </Button>
              </Link>
            </div>
          </div>
          <InfluencerList userId={user.id} onDataReload={() => {}} />
        </section>

        {/* Categorias de interesse */}
        <section className="mb-10">
          <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5 text-fuchsia-400" />
            Categorias de interesse
          </h2>
          <div className={`${NEON_CARD_CLASS} p-6`}>
            <p className="text-sm text-muted-foreground mb-4">Sua categoria e nicho definem o match com marcas no mural.</p>
            <div className="flex flex-wrap gap-2">
              {INFLUENCER_CATEGORIES.slice(0, 12).map((cat) => (
                <span key={cat} className="px-3 py-1.5 rounded-full text-xs font-medium bg-fuchsia-500/10 border border-fuchsia-400/20 text-fuchsia-200">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </section>

        <InfluencerWalletSection userId={user.id} />
        <InfluencerContractsSection userId={user.id} />

        <section className="mt-10">
          <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-fuchsia-400" />
            Conversas e propostas
          </h2>
          <div className={`${NEON_CARD_CLASS} overflow-hidden`}>
            <ConversationsPanel userId={user.id} />
          </div>
        </section>
      </div>
    </div>
  );
};

export default InfluencerPortalPage;
