import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Mail, Lock, Sparkles, Building2, Users, TrendingUp, Star, Zap } from "lucide-react";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getPostLoginRedirect } from "@/lib/userRouting";
import { logger } from "@/lib/logger";
import { motion, AnimatePresence } from "framer-motion";

type ProfileTypeChoice = "company" | "influencer" | "";

const STATS = [
  { value: "12K+", label: "Marcas cadastradas", icon: Building2, color: "text-amber-400" },
  { value: "38K+", label: "Influenciadores ativos", icon: Users, color: "text-fuchsia-400" },
  { value: "R$4M+", label: "Em parcerias geradas", icon: TrendingUp, color: "text-emerald-400" },
];

const TESTIMONIALS = [
  { name: "Mariana L.", role: "Influenciadora — Moda", text: "Em 3 dias recebi 5 propostas de marcas. Plataforma incrível!", avatar: "ML", color: "#D946EF" },
  { name: "TechBrand Co.", role: "Empresa — Tecnologia", text: "Encontramos 12 influenciadores perfeitos em um dia.", avatar: "TB", color: "#F59E0B" },
  { name: "Fit & Go Store", role: "Empresa — Esportes", text: "ROI de 340% na primeira campanha. Recomendo demais!", avatar: "FG", color: "#10B981" },
];

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileType, setProfileType] = useState<ProfileTypeChoice>("");
  const [loginAs, setLoginAs] = useState<"company" | "influencer">("company");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => setTestimonialIdx((i) => (i + 1) % TESTIMONIALS.length), 4000);
    return () => clearInterval(timer);
  }, []);

  const redirectAfterLogin = async (userId: string, preferred?: "company" | "influencer") => {
    try {
      const nextParam = new URLSearchParams(window.location.search).get("next") || "";
      const saveInfluencerMatch = nextParam.match(/^action_save_influencer_(.+)$/);
      if (saveInfluencerMatch) {
        window.location.href = `/ranking?save_influencer=${encodeURIComponent(saveInfluencerMatch[1])}`;
        return;
      }
      const sendProposalMatch = nextParam.match(/^action_send_proposal_(.+)$/);
      if (sendProposalMatch) {
        window.location.href = `/dashboard/influencer?proposal=${encodeURIComponent(sendProposalMatch[1])}`;
        return;
      }
      if (preferred) {
        window.location.href = preferred === "influencer" ? "/dashboard/influencer" : "/dashboard";
        return;
      }
      const { type, path } = await getPostLoginRedirect(userId);
      const target = type === "influencer" ? "/dashboard/influencer" : type === "admin" ? "/admin" : type === "company" ? "/dashboard" : path;
      window.location.href = target || "/dashboard";
    } catch (err: any) {
      if (err?.message) logger.error("Auth", err.message, err);
      window.location.href = "/dashboard";
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setTimeout(() => redirectAfterLogin(session.user.id), 100);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
          scopes: "openid email profile",
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (error: any) {
      const msg = error?.message ?? "Erro";
      toast({ title: t("auth.error"), description: msg, variant: "destructive" });
      logger.error("Auth", msg, error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { data: loginData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const msg = error.message?.toLowerCase() ?? "";
          if (msg.includes("email") && (msg.includes("confirm") || msg.includes("verified"))) {
            toast({ title: t("auth.email_not_confirmed"), description: "Use «Continuar com Google» para entrar agora ou reenvie o e-mail de confirmação.", variant: "default" });
            handleResendConfirmation();
          } else throw error;
          setLoading(false);
          return;
        }
        toast({ title: t("auth.success") });
        if (loginData?.user) setTimeout(() => redirectAfterLogin(loginData.user.id, loginAs), 300);
      } else {
        if (!profileType) {
          toast({ title: t("auth.select_profile_err"), variant: "destructive" });
          setLoading(false);
          return;
        }
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { display_name: displayName, profile_type: profileType },
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });
        if (error) throw error;
        if (signUpData?.user) {
          setTimeout(async () => {
            try {
              await supabase.from("profiles").update({ profile_type: profileType, display_name: displayName || undefined }).eq("user_id", signUpData!.user!.id);
            } catch (_) {}
          }, 500);
        }
        toast({ title: t("auth.created"), description: t("auth.created_desc") });
      }
    } catch (error: any) {
      const msg = error?.message ?? "Erro desconhecido";
      toast({ title: t("auth.error"), description: msg, variant: "destructive" });
      logger.error("Auth", msg, error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) return;
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      toast({ title: t("auth.resend_sent") });
    } catch (err: any) {
      const msg = err?.message ?? "Erro";
      toast({ title: t("auth.error"), description: msg, variant: "destructive" });
      logger.error("Auth", msg, err);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── LEFT PANEL: Brand Story ── */}
      <div className="hidden lg:flex lg:w-[52%] auth-brand-panel flex-col justify-between p-12 xl:p-16">
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2 mb-16 group">
            <ConeXaiLogo textClassName="font-display font-bold text-xl group-hover:opacity-90 transition-opacity" showText />
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <h1 className="font-display font-bold text-4xl xl:text-5xl text-white leading-[1.15] mb-6">
              A rede social que{" "}
              <span className="text-gradient">conecta marcas</span>{" "}
              a influenciadores reais.
            </h1>
            <p className="text-white/50 text-lg leading-relaxed max-w-md">
              Negocie parcerias, gerencie campanhas e acompanhe resultados — tudo em um único painel.
            </p>
          </motion.div>

          {/* Stats row */}
          <motion.div
            className="flex gap-8 mt-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            {STATS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-4 h-4 ${s.color}`} />
                    <span className={`font-display font-bold text-2xl ${s.color}`}>{s.value}</span>
                  </div>
                  <span className="text-white/35 text-xs">{s.label}</span>
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* Testimonial carousel */}
        <div className="relative z-10">
          <div className="flex gap-1.5 mb-4">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setTestimonialIdx(i)}
                className={`h-1 rounded-full transition-all duration-500 ${i === testimonialIdx ? "w-8 bg-white/70" : "w-3 bg-white/20"}`}
              />
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={testimonialIdx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="bg-white/[0.04] border border-white/10 rounded-2xl p-5"
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: TESTIMONIALS[testimonialIdx].color + "40", border: `1px solid ${TESTIMONIALS[testimonialIdx].color}60` }}
                >
                  {TESTIMONIALS[testimonialIdx].avatar}
                </div>
                <div>
                  <div className="flex gap-0.5 mb-2">
                    {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed italic">"{TESTIMONIALS[testimonialIdx].text}"</p>
                  <p className="text-white/40 text-xs mt-2">— {TESTIMONIALS[testimonialIdx].name} · {TESTIMONIALS[testimonialIdx].role}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── RIGHT PANEL: Auth Form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative overflow-hidden bg-background">
        {/* Subtle bg effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,hsl(var(--primary)/0.06),transparent_60%)]" />
        <div className="absolute inset-0 hero-grid-bg opacity-[0.025]" />

        <div className="relative w-full max-w-[400px]">
          {/* Top bar: back + language on mobile */}
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              {t("auth.back")}
            </Link>
            <div className="flex items-center gap-2">
              <div className="lg:hidden">
                <ConeXaiLogo textClassName="font-display font-bold hidden" showText={false} />
              </div>
              <LanguageSwitcher />
            </div>
          </div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-7"
          >
            <h2 className="text-2xl font-display font-bold text-foreground mb-1.5">
              {isLogin ? t("auth.welcome_title") : "Criar conta gratuita"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isLogin ? t("auth.welcome_subtitle") : "Comece a conectar marcas e influenciadores hoje."}
            </p>
          </motion.div>

          {/* Company / Influencer toggle */}
          <div className="flex rounded-xl border border-border/60 p-1 mb-6 bg-muted/30 gap-1">
            <button
              type="button"
              onClick={() => setLoginAs("company")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${loginAs === "company" ? "bg-background text-primary shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Building2 className="w-3.5 h-3.5" />
              {t("auth.i_am_company")}
            </button>
            <button
              type="button"
              onClick={() => setLoginAs("influencer")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${loginAs === "influencer" ? "bg-background text-primary shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Zap className="w-3.5 h-3.5" />
              {t("auth.i_am_influencer")}
            </button>
          </div>

          {/* Google CTA */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full h-12 mb-5 gap-3 font-medium text-base rounded-xl border-2 border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 btn-shimmer"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {t("auth.google")}
          </Button>

          {/* Divider */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground font-medium">{t("auth.or")}</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t("auth.register_as")}</label>
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border/60 py-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/10 transition-colors">
                        <input type="radio" name="profile_type" value="company" checked={profileType === "company"} onChange={() => setProfileType("company")} className="sr-only" />
                        <Building2 className="w-4 h-4" />
                        <span className="text-sm font-medium">{t("auth.company")}</span>
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border/60 py-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/10 transition-colors">
                        <input type="radio" name="profile_type" value="influencer" checked={profileType === "influencer"} onChange={() => setProfileType("influencer")} className="sr-only" />
                        <Sparkles className="w-4 h-4" />
                        <span className="text-sm font-medium">{t("auth.influencer")}</span>
                      </label>
                    </div>
                  </div>
                  <div className="relative">
                    <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-10 h-11 rounded-xl"
                      placeholder={t("auth.company_name")}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                className="pl-10 h-11 rounded-xl"
                placeholder={t("auth.email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                className="pl-10 h-11 rounded-xl"
                placeholder={t("auth.password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-12 font-display font-semibold rounded-xl transition-all duration-200 btn-shimmer"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {t("auth.loading")}
                </>
              ) : isLogin ? t("auth.login") : t("auth.signup")}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              {isLogin ? t("auth.no_account") : t("auth.has_account")}
            </button>
          </div>

          {/* Trust indicators */}
          <div className="mt-8 pt-6 border-t border-border/30 flex items-center justify-center gap-6 text-xs text-muted-foreground/50">
            <span className="flex items-center gap-1">🔒 SSL seguro</span>
            <span className="flex items-center gap-1">✅ LGPD</span>
            <span className="flex items-center gap-1">⚡ Grátis para começar</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
