import { useState, useCallback, useEffect } from "react";
import MuralNavbar from "@/components/MuralNavbar";
import BentoMuralInfluencers from "@/components/mural/bento/BentoMuralInfluencers";
import InfluencerModal from "@/components/mural/InfluencerModal";
import { MOCK_INFLUENCERS, INFLUENCER_CATEGORIES } from "@/data/influencerMockData";
import { CategoriesBar } from "@/components/CategoriesBar";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Send, X, Loader2, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import InfluencerBrandPanel from "@/components/mural/InfluencerBrandPanel";
import ConversationsPanel from "@/components/dashboard/ConversationsPanel";
import { useMuralCache } from "@/context/MuralCacheContext";
import { MuralShell } from "@/components/mural/MuralShell";
import { MuralSeo } from "@/components/seo/MuralSeo";


interface InfluencerOption {
  id: string;
  user_id: string;
  display_name: string;
  name: string;
}

/** Uma única barra de busca no topo (MuralNavbar); categorias abaixo — sem buscador duplicado no rodapé. */
const InfluencersPage = () => {
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [focusBrand, setFocusBrand] = useState<string | null>(null);
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([]);
  const [offerModal, setOfferModal] = useState<{ toUserId: string; toName: string } | null>(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [panelInfluencer, setPanelInfluencer] = useState<InfluencerOption | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("Todos");
  const [muralChatInfluencerId, setMuralChatInfluencerId] = useState<string | null>(null);
  const [viewerInfluencerIds, setViewerInfluencerIds] = useState<string[]>([]);
  const [selectedInfluencerModal, setSelectedInfluencerModal] = useState<(typeof MOCK_INFLUENCERS)[0] | null>(null);
  const { profileType, user, canUseBrandMessaging } = useUserProfile();
  const { brands: muralBrands } = useMuralCache();

  const { toast } = useToast();

  const isCompany = profileType === "company";
  const showCompanyMuralTools = isCompany || canUseBrandMessaging;

  useEffect(() => {
    if (!user) {
      setCompanyId(null);
      return;
    }
    supabase.from("companies").select("id").eq("owner_id", user.id).maybeSingle().then(({ data }) => setCompanyId(data?.id ?? null));
  }, [user]);

  useEffect(() => {
    if (!user) {
      setViewerInfluencerIds([]);
      return;
    }
    supabase
      .from("influencers")
      .select("id")
      .eq("owner_id", user.id)
      .then(({ data }) => setViewerInfluencerIds((data ?? []).map((r) => r.id)));
  }, [user]);

  useEffect(() => {
    if (!showCompanyMuralTools || !user) return;
    supabase.from("influencers").select("id, name, owner_id").not("owner_id", "is", null).then(({ data: infs }) => {
      if (!infs?.length) {
        setInfluencers([]);
        return;
      }
      const userIds = [...new Set(infs.map((i) => i.owner_id))] as string[];
      supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds)
        .then(({ data: profs }) => {
          const names = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.display_name || ""]));
          setInfluencers(infs.map((i) => ({ id: i.id, user_id: i.owner_id, display_name: names[i.owner_id] || "", name: i.name })));
        });
    });
  }, [showCompanyMuralTools, user]);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("favorite_influencers").select("influencer_id").eq("company_id", companyId).then(({ data }) => {
      setSavedIds(new Set((data ?? []).map((r) => r.influencer_id)));
    });
  }, [companyId]);

  useEffect(() => {
    if (!focusBrand?.trim()) return;
    const found = MOCK_INFLUENCERS.find((i) => i.name.toLowerCase() === focusBrand.toLowerCase());
    if (found) setSelectedInfluencerModal(found);
    setFocusBrand(null);
  }, [focusBrand]);

  const handleToggleFavorite = async (influencerId: string) => {
    if (!companyId || !user) {
      toast({ title: "Faça login para participar da economia do mural.", variant: "destructive" });
      return;
    }
    const isSaved = savedIds.has(influencerId);
    setSavingId(influencerId);
    if (isSaved) {
      const { error } = await supabase.from("favorite_influencers").delete().eq("company_id", companyId).eq("influencer_id", influencerId);
      setSavingId(null);
      if (error) {
        toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
        return;
      }
      setSavedIds((prev) => {
        const n = new Set(prev);
        n.delete(influencerId);
        return n;
      });
      toast({ title: "Removido dos favoritos." });
    } else {
      const { error } = await supabase.from("favorite_influencers").insert({ company_id: companyId, influencer_id: influencerId });
      setSavingId(null);
      if (error) {
        if (error.code === "23505") {
          setSavedIds((prev) => new Set(prev).add(influencerId));
          toast({ title: "Já está nos favoritos." });
        } else toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        return;
      }
      setSavedIds((prev) => new Set(prev).add(influencerId));
      toast({ title: "Adicionado aos favoritos. Ele aparece em Ofertas diretas." });
    }
  };

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query || null);
  }, []);

  const handleFocusBrand = useCallback((brandName: string) => {
    setFocusBrand(brandName);
    setSearchQuery(brandName);
  }, []);

  const handleSendDirectOffer = async () => {
    if (!offerModal || !companyId) return;
    if (!user) {
      toast({ title: "Faça login para participar da economia do mural.", variant: "destructive" });
      return;
    }
    const amt = parseFloat(offerAmount.replace(",", "."));
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Informe um valor válido.", variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await (supabase.from("direct_offers" as any) as any).insert({
      company_id: companyId,
      to_user_id: offerModal.toUserId,
      amount: amt,
      description: offerDescription.trim() || null,
      status: "pending",
    });
    setSending(false);
    if (error) {
      toast({ title: "Erro ao enviar oferta", description: (error as Error).message, variant: "destructive" });
      return;
    }
    toast({ title: "Oferta direta enviada! O influenciador verá no Inbox de Convites." });
    setOfferModal(null);
    setOfferAmount("");
    setOfferDescription("");
  };

  const brandsForSidebar = muralBrands ?? [];

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-stage-void">
      <MuralSeo
        kind="influencers"
        entities={MOCK_INFLUENCERS}
        path="/influencers"
        title="Mural de Criadores | MuralDigital — influenciadores para campanhas"
        description="Descubra criadores de conteúdo por nicho, alcance e engajamento. Cada perfil traz métricas atualizadas e canal direto para propostas de campanha."
      />

      <MuralNavbar
        muralType="influencers"
        onSearch={handleSearch}
        onFocusBrand={handleFocusBrand}
        glassMode
        secondaryBar={
          <CategoriesBar
            categories={["Todos", ...INFLUENCER_CATEGORIES]}
            value={categoryFilter}
            onChange={setCategoryFilter}
            variant="inline"
          />
        }
      />

      {/*
        `pt-16` reserva exatamente a altura da navbar fixa (h-16). As
        categorias voltaram para dentro dessa mesma linha, então não há mais
        segunda faixa a compensar.
        O container NÃO rola: quem rola é o grid lá dentro, e só quando os
        cards não couberem no menor tamanho. Isso garante uma única barra de
        rolagem na tela — antes existiam duas (a do documento e a deste
        container), uma dentro da outra.
      */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-16 w-full !max-w-none">
        <MuralShell active="influencers">
          <div className="relative z-0 min-h-0 w-full !max-w-none flex-1 overflow-hidden bg-stage-void">
            <BentoMuralInfluencers
              influencers={MOCK_INFLUENCERS}
              searchHighlight={searchQuery}
              categoryFilter={categoryFilter}
              onSelect={(inf) => setSelectedInfluencerModal(inf)}
            />
          </div>
        </MuralShell>
      </div>

      <InfluencerModal
        influencer={selectedInfluencerModal}
        onClose={() => setSelectedInfluencerModal(null)}
        onOpenChat={(id) => {
          setMuralChatInfluencerId(id);
          setSelectedInfluencerModal(null);
        }}
      />

      {showCompanyMuralTools && influencers.length > 0 && (
        <div className="fixed left-4 top-24 z-[80] w-72 max-h-[50vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]/85 shadow-2xl backdrop-blur-[15px] animate-in fade-in slide-in-from-left-4 duration-500 sm:left-6 xl:left-6">
          <div className="border-b border-white/10 bg-gradient-to-r from-fuchsia-600/15 to-purple-600/10 p-3">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-white">
              <div className="h-2 w-2 animate-pulse rounded-full bg-fuchsia-500" />
              Talentos disponíveis
            </h3>
            <p className="mt-0.5 text-[10px] text-white/45">Parcerias rápidas (mesmo login empresa).</p>
          </div>
          <ul className="custom-scrollbar max-h-[40vh] space-y-1 overflow-y-auto p-2">
            {influencers.map((i) => (
              <li
                key={i.id}
                className="group flex items-center justify-between gap-2 rounded-xl border border-transparent p-2 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
              >
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2" onClick={() => setPanelInfluencer(i)}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 text-[10px] font-bold text-white shadow-lg">
                    {i.display_name?.substring(0, 1) || "I"}
                  </div>
                  <div className="min-w-0 text-left">
                    <span className="block truncate text-xs font-medium text-zinc-100 group-hover:text-fuchsia-300">{i.display_name || i.name}</span>
                    <span className="text-[9px] uppercase tracking-tight text-zinc-500">{i.name}</span>
                  </div>
                </button>
                <div className="flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(i.id)}
                    disabled={savingId === i.id}
                    className={`rounded-full p-1.5 transition-all ${savedIds.has(i.id) ? "bg-rose-500/10 text-rose-500" : "text-zinc-400 hover:text-rose-400"}`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${savedIds.has(i.id) ? "fill-current" : ""}`} />
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 rounded-full bg-white/5 p-0 hover:bg-fuchsia-500 hover:text-white"
                    onClick={() => {
                      if (!user) {
                        toast({ title: "Faça login para participar da economia do mural.", variant: "destructive" });
                        return;
                      }
                      setOfferModal({ toUserId: i.user_id, toName: i.display_name || i.name || "Influenciador" });
                    }}
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {panelInfluencer && showCompanyMuralTools && (
        <InfluencerBrandPanel
          brand={
            muralBrands?.find((b) => b.id === panelInfluencer.id) || {
              id: panelInfluencer.id,
              name: panelInfluencer.display_name || panelInfluencer.name || "Influenciador",
              category: "Influencer",
              website: "",
              logo: "👤",
              color: "#D946EF",
              blocks: [],
              clicks: 0,
              joinedAt: new Date().toISOString(),
              badges: [],
            }
          }
          onClose={() => setPanelInfluencer(null)}
          influencerId={panelInfluencer.id}
          influencerName={panelInfluencer.display_name || panelInfluencer.name || "Influenciador"}
        />
      )}

      <AnimatePresence>
        {offerModal && (
          <>
            <div className="fixed inset-0 z-[100] bg-black/60" onClick={() => setOfferModal(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 z-[101] w-full max-w-sm min-w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-[#0A0A0A]/95 p-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Oferta direta — {offerModal.toName}</h3>
                <button type="button" onClick={() => setOfferModal(null)} className="rounded p-1 hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mb-3 text-xs text-white/50">
                O valor aparece no Inbox de Convites do influenciador. Ao aceitar, o valor é congelado; após entrega, você confirma e liberamos (15% taxa plataforma).
              </p>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Valor (R$)"
                className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
              />
              <input
                type="text"
                placeholder="O que você quer (ex.: 3 stories)"
                className="mb-4 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
                value={offerDescription}
                onChange={(e) => setOfferDescription(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-white/15" onClick={() => setOfferModal(null)}>
                  Cancelar
                </Button>
                <Button className="flex-1 gap-2" onClick={handleSendDirectOffer} disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {user && muralChatInfluencerId && canUseBrandMessaging && (
        <ConversationsPanel
          floating
          userId={user.id}
          companyId={companyId}
          muralViewerInfluencerIds={viewerInfluencerIds.length > 0 ? viewerInfluencerIds : undefined}
          openConversationWithInfluencerId={muralChatInfluencerId}
          onClose={() => setMuralChatInfluencerId(null)}
        />
      )}
    </div>
  );
};

export default InfluencersPage;
