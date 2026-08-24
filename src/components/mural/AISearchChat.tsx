import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, X, Loader2, Share2, Linkedin, Copy, UserPlus, Heart, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";

const API = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:3001";

export interface RecommendedInfluencer {
  id: string;
  name: string;
  category?: string;
  profile_url: string;
}

interface AISearchChatProps {
  open: boolean;
  onClose: () => void;
  onResult: (companyIds: string[], influencerIds: string[], rationale: string) => void;
  initialRecommendPartner?: boolean;
  companyId?: string | null;
  /** Nome da empresa para a IA usar na mensagem de vendas e na API. */
  companyName?: string | null;
}

const MURAL_BRAND = "ConeXai";
const INTENT_KEY = "intent_after_login";

export default function AISearchChat({ open, onClose, onResult, initialRecommendPartner, companyId, companyName }: AISearchChatProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastRationale, setLastRationale] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const [lastSalesMessage, setLastSalesMessage] = useState<string | null>(null);
  const [lastInfluencers, setLastInfluencers] = useState<RecommendedInfluencer[]>([]);
  // Contexto do ConeXai (regras de uso) é carregado apenas para uso interno da IA;
  // não exibimos mais esse texto na interface (fica restrito aos Termos de Uso).
  const [knowledgeBase, setKnowledgeBase] = useState<{ summary: string; rules?: string[] } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profileType } = useUserProfile();
  const [companyIdForFavorites, setCompanyIdForFavorites] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`${API}/api/ai/context`)
      .then((r) => r.json())
      .then((json) => { if (json.data) setKnowledgeBase(json.data); })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!user || profileType !== "company") {
      setCompanyIdForFavorites(null);
      return;
    }
    supabase
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .single()
      .then(({ data }) => setCompanyIdForFavorites(data?.id ?? null));
  }, [user, profileType]);

  const handleRecommendPartner = async () => {
    setLoading(true);
    setLastRationale(null);
    setLastSalesMessage(null);
    setLastInfluencers([]);
    try {
      const body: { company_id?: string; company_name?: string } = {};
      if (companyId) body.company_id = companyId;
      if (companyName) body.company_name = companyName;
      const res = await fetch(`${API}/api/ai-recommend-partner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setLastRationale(json?.error?.message ?? "Erro ao recomendar.");
        return;
      }
      const data = json.data ?? {};
      const influencerIds = Array.isArray(data.influencerIds) ? data.influencerIds : [];
      const rationale = data.rationale ?? "3 parceiros recomendados para sua marca.";
      const influencers = Array.isArray(data.influencers)
        ? data.influencers.map((i: { id: string; name: string; category?: string; profile_url?: string }) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            // Quando for interno, usamos a rota oficial de perfil de influenciador.
            profile_url: i.profile_url || `/influencer/${i.id}`,
          }))
        : [];
      setLastRationale(rationale);
      setLastSalesMessage(data.sales_message ?? null);
      setLastInfluencers(influencers);
      setLastQuery("Recomende um parceiro para minha marca");
      onResult([], influencerIds, rationale);
    } catch (e) {
      setLastRationale(e instanceof Error ? e.message : "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  const didInitialRecommend = useRef(false);
  useEffect(() => {
    if (!open) didInitialRecommend.current = false;
    if (open && initialRecommendPartner && !didInitialRecommend.current) {
      didInitialRecommend.current = true;
      handleRecommendPartner();
    }
  }, [open, initialRecommendPartner]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setLastRationale(null);
    setLastSalesMessage(null);
    setLastInfluencers([]);
    try {
      const res = await fetch(`${API}/api/ai-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLastRationale(json?.error?.message ?? "Erro na busca.");
        return;
      }
      const data = json.data ?? {};
      const companyIds = Array.isArray(data.companyIds) ? data.companyIds : [];
      const influencerIds = Array.isArray(data.influencerIds) ? data.influencerIds : [];
      const rationale = data.rationale ?? "";
      const influencers = Array.isArray(data.influencers)
        ? data.influencers.map((i: { id: string; name: string; category?: string; profile_url?: string }) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            profile_url: i.profile_url || `/p/${i.id}`,
          }))
        : [];
      setLastRationale(rationale);
      setLastInfluencers(influencers);
      setLastQuery(q);
      onResult(companyIds, influencerIds, rationale);
    } catch (e) {
      setLastRationale(e instanceof Error ? e.message : "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInfluencer = async (influencerId: string) => {
    if (!user) {
      try {
        sessionStorage.setItem(INTENT_KEY, JSON.stringify({ action: "save_influencer", influencerId }));
        navigate(`/auth?next=action_save_influencer_${influencerId}`);
        onClose();
      } catch (_) {
        toast({ title: "Erro", description: "Não foi possível redirecionar para o login.", variant: "destructive" });
      }
      return;
    }
    if (profileType !== "company" || !companyIdForFavorites) {
      toast({ title: "Faça login como empresa", description: "Salve influenciadores nos favoritos pelo dashboard.", variant: "destructive" });
      return;
    }
    setSavingId(influencerId);
    const { error } = await supabase.from("favorite_influencers").insert({
      company_id: companyIdForFavorites,
      influencer_id: influencerId,
    });
    setSavingId(null);
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Já está nos favoritos." });
      } else {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      }
      return;
    }
    toast({ title: "Adicionado aos favoritos. Ele aparece em Ofertas diretas." });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-[101] w-full max-w-md bg-card border-l border-border shadow-xl flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="font-display font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Mural Assistant
              </span>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            {/* O bloco de explicação do Mural Assistant foi removido da UI
                para não expor regras internas; essas informações ficam
                apenas nos Termos de Uso. */}
            <div className="px-4 pb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
                onClick={handleRecommendPartner}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                IA, recomende um parceiro para minha marca
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 flex gap-2">
              <Input
                placeholder="Descreva o que você busca..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1"
                disabled={loading}
              />
              <Button type="submit" disabled={loading || !query.trim()} size="icon">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
            {lastRationale && (
              <div className="flex-1 overflow-auto px-4 pb-4 space-y-4">
                {lastSalesMessage && (
                  <p className="text-sm font-medium text-foreground rounded-lg bg-primary/10 p-3 border border-primary/30 whitespace-pre-wrap">
                    {lastSalesMessage.replace(/\*\*(.+?)\*\*/g, "$1")}
                  </p>
                )}
                <p className="text-sm text-muted-foreground rounded-lg bg-muted/50 p-3 whitespace-pre-wrap border border-green-500/50">
                  {lastRationale}
                </p>
                {lastInfluencers.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">Links diretos para os perfis:</p>
                    {lastInfluencers.map((inf) => (
                      <div
                        key={inf.id}
                        className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2"
                      >
                        <a
                          href={inf.profile_url.startsWith("http") ? inf.profile_url : `${window.location.origin}${inf.profile_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-0 text-sm text-primary hover:underline truncate"
                        >
                          {inf.name}
                          {inf.category ? ` · ${inf.category}` : ""}
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-8 w-8"
                          onClick={() => handleSaveInfluencer(inf.id)}
                          disabled={savingId === inf.id}
                          title="Salvar nos favoritos (após login será concluído automaticamente)"
                        >
                          {savingId === inf.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4 text-primary" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground rounded-md border border-green-500 bg-green-500/10 px-2 py-1.5 text-green-700 dark:text-green-300">
                  Os 3 perfis recomendados estão com destaque <span className="font-semibold border-green-500">border-green-500</span> no mural.
                </p>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5" />
                    Compartilhe este match no seu LinkedIn/Instagram
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Link automático com a marca {MURAL_BRAND} para divulgar sua busca.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => {
                        const url = `${typeof window !== "undefined" ? window.location.origin : ""}/${lastQuery ? `?match=${encodeURIComponent(lastQuery)}` : ""}`;
                        const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
                        window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=600");
                      }}
                    >
                      <Linkedin className="w-3.5 h-3.5" />
                      LinkedIn
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => {
                        const url = `${typeof window !== "undefined" ? window.location.origin : ""}/${lastQuery ? `?match=${encodeURIComponent(lastQuery)}` : ""}`;
                        const text = `Encontrei os melhores perfis no ${MURAL_BRAND}${lastQuery ? `: "${lastQuery}"` : ""}. Confira: ${url}`;
                        navigator.clipboard.writeText(text);
                        toast({ title: "Copiado", description: "Cole no Instagram (bio, stories ou DM) para compartilhar." });
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copiar para Instagram
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
