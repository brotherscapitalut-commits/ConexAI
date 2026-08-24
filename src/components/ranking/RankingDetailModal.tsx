import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Brand } from "@/data/mockData";
import {
  ExternalLink, X, MousePointerClick, Grid3X3, Globe, Tag, Users,
  Building2, Sparkles, Instagram, Youtube, Music2, Heart,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/hooks/useUserProfile";

/** Id é UUID real (do banco); id mock é tipo "influencer-0". */
const isRealInfluencerId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

interface RankingDetailModalProps {
  brand: Brand | null;
  onClose: () => void;
  type: "empresas" | "influencers";
}

const INTENT_KEY = "intent_after_login";

const RankingDetailModal = ({ brand, onClose, type }: RankingDetailModalProps) => {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profileType, user, canUseBrandMessaging } = useUserProfile();

  const isInfluencer = type === "influencers";
  const isCompany = profileType === "company";
  const canActAsCompany = isCompany || canUseBrandMessaging;
  const influencerId = brand && isRealInfluencerId(brand.id) ? brand.id : null;
  const canSave = isInfluencer && canActAsCompany && companyId && influencerId;

  useEffect(() => {
    if (!canActAsCompany || !brand || !user) return;
    (async () => {
      const { data: comp } = await supabase.from("companies").select("id").eq("owner_id", user.id).limit(1).single();
      setCompanyId(comp?.id ?? null);
      if (!isRealInfluencerId(brand.id) || !comp?.id) return;
      const { data: fav } = await supabase.from("favorite_influencers").select("id").eq("company_id", comp.id).eq("influencer_id", brand.id).maybeSingle();
      setSaved(Boolean(fav));
    })();
  }, [canActAsCompany, user, brand?.id]);

  const handleToggleFavorite = async () => {
    if (!user && isInfluencer && influencerId) {
      try {
        sessionStorage.setItem(INTENT_KEY, JSON.stringify({ action: "save_influencer", influencerId }));
        navigate(`/auth?next=action_save_influencer_${influencerId}`);
        onClose();
      } catch (_) {
        toast({ title: "Erro", description: "Não foi possível redirecionar para o login.", variant: "destructive" });
      }
      return;
    }
    if (!canActAsCompany) {
      toast({ title: "Faça login como empresa", description: "Salve influenciadores nos favoritos para usar em Ofertas diretas no dashboard.", variant: "destructive" });
      return;
    }
    if (!companyId || !influencerId) {
      toast({ title: "Use a lista à esquerda", description: "Clique no coração ao lado do nome do influenciador para salvar nos favoritos.", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (saved) {
      const { error } = await supabase.from("favorite_influencers").delete().eq("company_id", companyId).eq("influencer_id", influencerId);
      setSaving(false);
      if (error) {
        toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
        return;
      }
      setSaved(false);
      toast({ title: "Removido dos favoritos." });
    } else {
      const { error } = await supabase.from("favorite_influencers").insert({ company_id: companyId, influencer_id: influencerId });
      setSaving(false);
      if (error) {
        if (error.code === "23505") {
          setSaved(true);
          toast({ title: "Já está nos favoritos." });
        } else toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        return;
      }
      setSaved(true);
      toast({ title: "Adicionado aos favoritos. Ele aparece em Ofertas diretas." });
    }
  };

  if (!brand) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative w-[92vw] max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border border-border bg-popover shadow-2xl"
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header gradient */}
          <div
            className="relative h-28 rounded-t-3xl overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${brand.color}60, ${brand.color}20, transparent)`,
            }}
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-background/60 backdrop-blur-sm hover:bg-background/80 transition-colors"
            >
              <X className="w-4 h-4 text-foreground" />
            </button>
          </div>

          {/* Logo */}
          <div className="flex justify-center -mt-10 relative z-10">
            <div
              className={`w-20 h-20 ${isInfluencer ? "rounded-full" : "rounded-2xl"} flex items-center justify-center text-2xl font-display font-bold shadow-xl border-4 border-popover`}
              style={{ backgroundColor: brand.color, color: "#fff" }}
            >
              {brand.logo}
            </div>
          </div>

          <div className="px-6 pb-6 pt-3">
            {/* Name & category */}
            <div className="text-center mb-4">
              <h2 className="font-display font-bold text-xl text-foreground">{brand.name}</h2>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <Tag className="w-3 h-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{brand.category}</p>
              </div>
            </div>

            {/* Badges */}
            {brand.badges.length > 0 && (
              <div className="flex gap-1.5 flex-wrap justify-center mb-4">
                {brand.badges.map((badge) => (
                  <span
                    key={badge}
                    className="text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary font-medium flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    {badge}
                  </span>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="flex gap-4 justify-center text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50">
                <MousePointerClick className="w-4 h-4 text-primary" />
                <span className="font-medium">{brand.clicks.toLocaleString()}</span>
                <span className="text-xs">cliques</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50">
                <Grid3X3 className="w-4 h-4 text-primary" />
                <span className="font-medium">{brand.blocks.length}</span>
                <span className="text-xs">blocos</span>
              </div>
            </div>

            {/* Favoritar: sempre visível para influencer; ativo só para empresa */}
            {isInfluencer && (
              <div className="mb-5">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  disabled={saving || (canActAsCompany && !canSave)}
                  title={canSave ? (saved ? "Remover dos favoritos" : "Marcar como favorito") : !canActAsCompany ? "Faça login como empresa para salvar" : "Use a lista à esquerda para salvar influenciadores cadastrados"}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors w-full ${canSave
                    ? saved
                      ? "border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                    : "border-muted bg-muted/30 text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  <Heart className={`w-4 h-4 ${saved && canSave ? "fill-current" : ""}`} />
                  {saved && canSave ? "Favorito" : "Favoritar"}
                </button>
                {!canSave && !canActAsCompany && (
                  <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                    Faça login como empresa para salvar nos favoritos.
                  </p>
                )}
                {!canSave && canActAsCompany && (
                  <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                    Use a lista à esquerda para salvar influenciadores cadastrados nos favoritos.
                  </p>
                )}
              </div>
            )}

            {/* Description */}
            <div className="space-y-3 mb-5">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {isInfluencer ? "Sobre o influenciador" : "Sobre a empresa"}
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {isInfluencer
                    ? `${brand.name} é um criador de conteúdo na área de ${brand.category.toLowerCase()}, com engajamento autêntico e presença digital consolidada. Membro do mural desde ${new Date(brand.joinedAt).toLocaleDateString("pt-BR")}.`
                    : `${brand.name} é uma empresa líder no setor de ${brand.category.toLowerCase()}, oferecendo soluções inovadoras para seus clientes. Com presença no mural desde ${new Date(brand.joinedAt).toLocaleDateString("pt-BR")}.`
                  }
                </p>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/50">
                {isInfluencer ? <Users className="w-4 h-4 text-primary mt-0.5 shrink-0" /> : <Building2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {isInfluencer ? "Nicho" : "Setor"}
                  </p>
                  <p className="text-sm text-foreground">{brand.category}</p>
                </div>
              </div>

              {/* Social links for influencers */}
              {isInfluencer && (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={brand.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                  >
                    <Instagram className="w-3.5 h-3.5" />
                    Instagram
                  </a>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-xs font-medium text-foreground">
                    <Youtube className="w-3.5 h-3.5" />
                    YouTube
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-xs font-medium text-foreground">
                    <Music2 className="w-3.5 h-3.5" />
                    TikTok
                  </span>
                </div>
              )}
            </div>

            {/* CTA */}
            <a
              href={brand.website}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-display font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              <Globe className="w-4 h-4" />
              {isInfluencer ? "Ver perfil" : "Visitar site oficial"}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <p className="text-[10px] text-muted-foreground text-center mt-4">
              Membro desde {new Date(brand.joinedAt).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RankingDetailModal;
