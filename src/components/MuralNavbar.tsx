import { useState, useEffect, useRef } from "react";
import { Search, X, LogIn, MousePointerClick, ChevronDown, LogOut, LayoutDashboard, Shield, Sparkles, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MOCK_BRANDS, CATEGORIES } from "@/data/mockData";
import { MOCK_INFLUENCERS, INFLUENCER_CATEGORIES } from "@/data/influencerMockData";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { loadBrands } from "@/lib/mural/MuralDataLoader";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";
import { MuralSubNav } from "@/components/mural/MuralSubNav";
import type { MuralBrand } from "@/lib/mural/types";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import NotificationsCenter from "./dashboard/NotificationsCenter";

function accountInitials(displayName: string | null | undefined, email: string | undefined): string {
  const raw = (displayName || email || "?").trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (raw.includes("@")) return raw.slice(0, 2).toUpperCase();
  return raw.slice(0, 2).toUpperCase() || "?";
}

const DURATION_MS = 1200;
const formatClicks = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
};

function SlotMachineClicks({ target, active }: { target: number; active: boolean }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!active) { setDisplay(target); return; }
    setDisplay(0);
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(elapsed / DURATION_MS, 1);
      const easeOut = 1 - Math.pow(1 - t, 2.5);
      setDisplay(Math.round(easeOut * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, active]);
  return (
    <span className="tabular-nums font-semibold text-primary text-xs inline-flex items-center gap-0.5">
      <MousePointerClick className="w-3 h-3" />
      {formatClicks(display)}
    </span>
  );
}

interface MuralNavbarProps {
  onSearch: (query: string) => void;
  onFocusBrand: (brandName: string) => void;
  /** Qual mural está ativo na rota atual (empresas = `/`, influenciadores = `/influencers`). */
  muralType?: "empresas" | "influencers";
  onOpenDirectory?: () => void;
  /** Estilo glass: transparente com backdrop-blur sobre o mural (recomendado para mural) */
  glassMode?: boolean;
  /** Se o diretório está aberto: clique no botão Diretório fecha e volta ao mural */
  isDirectoryOpen?: boolean;
  onCloseDirectory?: () => void;
  /**
   * Conteúdo opcional renderizado numa segunda linha DENTRO da barra preta.
   * Usado pelo filtro de categorias do mural de criadores, que antes flutuava
   * sobre o conteúdo e cobria os cards.
   */
  secondaryBar?: React.ReactNode;
}

const MuralNavbar = ({ onSearch, onFocusBrand, muralType = "empresas", onOpenDirectory, onCloseDirectory, isDirectoryOpen = false, glassMode = false, secondaryBar }: MuralNavbarProps) => {
  const isInfluencer = muralType === "influencers";
  const navigate = useNavigate();
  const { user, profileType, isSuperAdmin, displayName } = useUserProfile();
  const portalHref =
    profileType === "admin" ? "/admin" : profileType === "influencer" ? "/dashboard/influencer" : "/dashboard";
  const portalLabel =
    profileType === "admin"
      ? "Painel Admin"
      : profileType === "influencer"
        ? "Portal Influenciador"
        : profileType === "company"
          ? "Portal Empresa"
          : "Minha conta";
  /* Portal único por contexto: influenciadores => Portal Influenciador; marcas/empresas => Portal Empresa */
  const brandsStatic = isInfluencer ? MOCK_INFLUENCERS : MOCK_BRANDS;
  const categories = isInfluencer ? INFLUENCER_CATEGORIES : CATEGORIES;
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [brandsFromSupabase, setBrandsFromSupabase] = useState<MuralBrand[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [userCompanyIds, setUserCompanyIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setUserCompanyIds([]);
      return;
    }
    supabase
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .then(({ data }) => {
        setUserCompanyIds((data ?? []).map((c) => c.id));
      });
  }, [user]);

  useEffect(() => {
    if (isInfluencer) return;
    setSearchLoading(true);
    loadBrands()
      .then((data) => setBrandsFromSupabase(data ?? []))
      .finally(() => setSearchLoading(false));
  }, [isInfluencer]);

  const searchSource = !isInfluencer && query.length >= 1 ? brandsFromSupabase : brandsStatic;
  const results =
    query.length >= 1
      ? [...searchSource
          .filter(
            (b: { name: string; category?: string }) =>
              (b.name || "").toLowerCase().includes(query.toLowerCase()) ||
              (b.category || "").toLowerCase().includes(query.toLowerCase()),
          )]
          .sort((a: MuralBrand & { completed_deals?: number }, b: MuralBrand & { completed_deals?: number }) => (b.completed_deals ?? 0) - (a.completed_deals ?? 0))
          .slice(0, 8)
      : [];

  const handleChange = (value: string) => {
    setQuery(value);
    setShowResults(value.length >= 1);
    onSearch(value);
  };

  const clear = () => {
    setQuery("");
    setShowResults(false);
    onSearch("");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100]">
      <div className="bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex h-16 items-center gap-4 px-5">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <ConeXaiLogo textClassName="font-display font-black text-xl tracking-tighter" />
          </Link>

          {/*
            Alternador de murais ancorado no header. Antes flutuava sobre a
            grade (`absolute top-4`, z-80) e invadia a área dos blocos.
          */}
          <MuralSubNav active={isInfluencer ? "influencers" : "empresas"} className="hidden sm:flex" />

          <div className="relative group min-w-0 flex-1 max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
            <Input
              className="pl-12 pr-10 h-11 text-sm rounded-2xl bg-white/5 border-white/5 focus:border-primary/50 focus:bg-white/[0.08] placeholder:text-white/20 text-white transition-all shadow-inner"
              placeholder={isInfluencer ? "Buscar no Nexus Index..." : "Buscar no Nexus Marketplace..."}
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={() => query.length >= 1 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
            />
            {query && (
              <button
                onClick={clear}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <AnimatePresence>
              {showResults && query.length >= 1 && (
                <motion.div
                  className="absolute z-[100] top-full mt-2 w-full rounded-2xl border border-white/10 bg-[#0a0a0a]/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden min-h-[120px]"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  {searchLoading && !isInfluencer ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 animate-pulse">
                          <div className="w-10 h-10 rounded-xl bg-white/5 shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-3/4 rounded bg-white/5" />
                            <div className="h-2 w-1/2 rounded bg-white/5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : results.length > 0 ? (
                    results.map((brand, idx) => {
                      const b = brand as MuralBrand & { id?: string };
                      return (
                        <button
                          key={b.id ?? `${b.name}-${idx}`}
                          className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-white/5 transition-all text-left group/item"
                          onClick={() => {
                            onFocusBrand(b.name);
                            setQuery(b.name);
                            setShowResults(false);
                          }}
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 shadow-lg"
                            style={{ backgroundColor: b.color ?? "#6366f1", color: "#fff" }}
                          >
                            {b.logo ?? b.name.slice(0, 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-white/90 group-hover/item:text-primary transition-colors truncate">
                              {b.name}
                            </div>
                            <div className="text-[10px] uppercase font-black tracking-widest text-white/30">{b.category ?? "General"}</div>
                          </div>
                          <span className="shrink-0 text-primary opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <ArrowUpRight className="w-4 h-4" />
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-10 text-center text-sm text-white/30">
                      Nenhum ativo encontrado para &quot;{query}&quot;
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <Link to="/ranking" className="text-[11px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">
              Ranking
            </Link>
            <Link to="/precos" className="text-[11px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">
              Preços
            </Link>
            
            <div className="flex items-center gap-3">
              {user && userCompanyIds.length > 0 && (
                <NotificationsCenter companyIds={userCompanyIds} />
              )}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 group outline-none">
                      <Avatar className="h-9 w-9 border border-white/10 group-hover:border-primary/50 transition-colors">
                        <AvatarFallback className="text-[10px] font-black bg-white/5 text-white/80">
                          {accountInitials(displayName, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="w-3 h-3 text-white/20 group-hover:text-white transition-colors" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 z-[200] rounded-2xl bg-[#0a0a0a] border-white/10 p-2 shadow-2xl">
                    <DropdownMenuLabel className="px-3 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-black text-white">{displayName || "Operador"}</span>
                        <span className="text-[10px] font-mono text-white/30 truncate uppercase tracking-tighter">{user.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/10 focus:text-primary transition-all p-3">
                      <Link to={portalHref} className="cursor-pointer gap-3 font-bold text-xs">
                        <LayoutDashboard className="w-4 h-4" />
                        {portalLabel}
                      </Link>
                    </DropdownMenuItem>
                    {isSuperAdmin && (
                      <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/10 focus:text-primary transition-all p-3">
                        <Link to="/admin" className="cursor-pointer gap-3 font-bold text-xs">
                          <Shield className="w-4 h-4" />
                          Nexus Admin
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem
                      className="rounded-xl focus:bg-destructive/10 focus:text-destructive transition-all p-3 gap-3 font-bold text-xs"
                      onSelect={() => {
                        void supabase.auth.signOut().then(() => navigate("/"));
                      }}
                    >
                      <LogOut className="w-4 h-4" />
                      Encerrar Sessão
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link to="/auth">
                  <Button className="h-10 px-6 rounded-xl bg-primary text-black font-black uppercase tracking-widest text-[11px] shadow-[0_10px_25px_rgba(34,197,94,0.3)] hover:scale-105 active:scale-95 transition-all">
                    Acessar Nexus
                  </Button>
                </Link>
              )}
            </div>

            {/*
              Filtro de categorias na MESMA linha do header, logo após o grupo
              da direita. Antes era um dock flutuante sobre a grade (cobria os
              cards) e depois uma segunda linha do header (roubava altura útil
              da tela). Aqui ele divide a linha já existente: `min-w-0` permite
              encolher, e a própria barra rola no eixo X quando não couber.
            */}
            {secondaryBar && (
              <div className="hidden min-w-0 shrink lg:block">{secondaryBar}</div>
            )}
          </div>
        </div>

      </div>
    </nav>
  );
};

export default MuralNavbar;
