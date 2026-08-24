import { useState, useEffect, useRef } from "react";
import { X, Building2, Users, ExternalLink, Link2, MousePointerClick, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { MuralBrand } from "@/lib/mural/types";

interface AnalysisPanelProps {
  brands: MuralBrand[];
  /** Marca recém-solta no painel: dispara animação de slot machine nos cliques */
  lastAddedBrand?: MuralBrand | null;
  onClose: () => void;
  onRemoveBrand: (brand: MuralBrand) => void;
  /** Clique na marca: reabre o modal da marca */
  onSelectBrand?: (brand: MuralBrand) => void;
}

const DURATION_MS = 1400;
const formatClicks = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
};

/** Contador animado tipo slot machine: sobe até o valor real */
function SlotMachineClicks({ target, active }: { target: number; active: boolean }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setDisplay(target);
      return;
    }
    setDisplay(0);
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(elapsed / DURATION_MS, 1);
      const easeOut = 1 - Math.pow(1 - t, 2.5);
      const value = Math.round(easeOut * target);
      setDisplay(value);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, active]);

  return (
    <span className="tabular-nums font-semibold text-primary inline-flex items-center gap-1">
      <MousePointerClick className="w-3.5 h-3.5" />
      {formatClicks(display)}
    </span>
  );
}

interface InfluencerRow {
  id: string;
  name: string;
  category: string;
  niche: string | null;
  followers_count: number | null;
  instagram: string | null;
  moderation_status: string;
}

const AnalysisPanel = ({ brands, lastAddedBrand, onClose, onRemoveBrand, onSelectBrand }: AnalysisPanelProps) => {
  const [influencers, setInfluencers] = useState<InfluencerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingProposal, setSendingProposal] = useState(false);
  const { toast } = useToast();
  const selected = brands[brands.length - 1] ?? null;

  const isUuid = (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const handleSendFixedCampaignProposal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selected) return;
    if (!isUuid(selected.id)) {
      toast({
        title: "Empresa inválida",
        description: "Esta marca é apenas visual. Selecione uma empresa real do banco para registrar proposta.",
        variant: "destructive",
      });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Faça login", description: "É preciso estar logado para enviar propostas.", variant: "destructive" });
      return;
    }
    setSendingProposal(true);
    try {
      const { error } = await supabase
        .from("partnership_proposals")
        .insert({
          to_company_id: selected.id,
          from_user_id: (user as any).id,
          amount: 0,
          status: "pending",
        });
      if (error) throw error;
      toast({
        title: "Proposta registrada",
        description: "Você pode negociar valores em campanha fixa e a plataforma pode cobrar uma taxa única de conexão.",
      });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setSendingProposal(false);
    }
  };

  useEffect(() => {
    if (!selected) {
      setInfluencers([]);
      return;
    }
    setLoading(true);
    supabase
      .from("influencers")
      .select("id, name, category, niche, followers_count, instagram, moderation_status")
      .eq("moderation_status", "approved")
      .limit(20)
      .then(({ data, error }) => {
        if (error) {
          setInfluencers([]);
        } else {
          const arr = Array.isArray(data) ? (data as InfluencerRow[]) : data ? [data as InfluencerRow] : [];
          setInfluencers(arr);
        }
        setLoading(false);
      });
  }, [selected?.id]);

  const formatFollowers = (n: number | null) => {
    if (n == null) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  if (brands.length === 0) return null;

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full max-w-md z-[90] flex flex-col bg-background/95 backdrop-blur-xl border-l border-border shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          Análise
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Marcas arrastadas para análise */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Marcas selecionadas
          </p>
          <div className="space-y-2">
            {brands.map((b) => (
              <div
                key={b.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all group cursor-pointer ${
                  lastAddedBrand?.id === b.id
                    ? "border-primary/60 bg-primary/10 shadow-lg shadow-primary/10"
                    : "border-border bg-muted/20 hover:bg-muted/40"
                }`}
                onClick={() => onSelectBrand?.(b)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onSelectBrand?.(b)}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: b.color, color: "#fff" }}
                >
                  {b.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>{b.category}</span>
                    {lastAddedBrand?.id === b.id ? (
                      <SlotMachineClicks target={b.clicks ?? 0} active />
                    ) : (
                      <span className="tabular-nums text-muted-foreground inline-flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3" />
                        {formatClicks(b.clicks ?? 0)}
                      </span>
                    )}
                  </p>
                </div>
                {b.website && b.website !== "#" && (
                  <a
                    href={b.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-primary/20 text-primary transition-all"
                    aria-label="Abrir site"
                    title="Site oficial"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveBrand(b); }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                  aria-label="Remover"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Detalhes da empresa em foco */}
        {selected && (
          <div
            className="p-4 rounded-2xl border border-border bg-card/50 space-y-3 cursor-pointer hover:bg-card/70 transition-colors"
            onClick={() => onSelectBrand?.(selected)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onSelectBrand?.(selected)}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Detalhes da empresa
            </p>
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-display font-bold shrink-0"
                style={{ backgroundColor: selected.color, color: "#fff" }}
              >
                {selected.logo}
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">{selected.name}</h3>
                <p className="text-sm text-muted-foreground">{selected.category}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selected.blocks.length} blocos
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.website && selected.website !== "#" && (
                <a
                  href={selected.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Site
                </a>
              )}
              {selected.instagram && (
                <a
                  href={`https://instagram.com/${selected.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/80"
                >
                  Instagram
                </a>
              )}
              {selected.tiktok && (
                <a
                  href={`https://tiktok.com/@${selected.tiktok.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/80"
                >
                  TikTok
                </a>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 mt-2 border-primary/40 text-primary hover:bg-primary/10"
              onClick={handleSendFixedCampaignProposal}
              disabled={sendingProposal}
            >
              <Send className="w-3.5 h-3.5" />
              Enviar Proposta de Campanha Fixa
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Parcerias diretas entre empresa e influenciador. A plataforma pode cobrar taxa única de conexão.
            </p>
          </div>
        )}

        {/* Lista de influenciadores */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Influenciadores
          </p>
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : influencers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhum influenciador aprovado no momento. Explore o mural de influenciadores.
            </p>
          ) : (
            <ul className="space-y-2">
              {influencers.map((inf) => (
                <li key={inf.id}>
                  <a
                    href={`/influencer/${inf.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/10 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{inf.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {inf.category}
                        {inf.niche ? ` • ${inf.niche}` : ""}
                        {inf.followers_count != null ? ` • ${formatFollowers(inf.followers_count)} seguidores` : ""}
                      </p>
                    </div>
                    <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;
