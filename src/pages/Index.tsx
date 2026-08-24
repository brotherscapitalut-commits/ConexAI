import { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import MuralNavbar from "@/components/MuralNavbar";
import BrandDirectory from "@/components/mural/BrandDirectory";
import EnhancedBrandModal from "@/components/mural/EnhancedBrandModal";
import { useMuralCache } from "@/context/MuralCacheContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { MuralBrand } from "@/lib/mural/types";
import { MuralShell } from "@/components/mural/MuralShell";
import MuralCanvas from "@/components/mural/MuralCanvas";

import { recordClick } from "@/lib/mural/MuralDataLoader";
import { isUuidV4Like } from "@/lib/uuid";

import { BidNotificationAlert } from "@/components/mural/BidNotificationAlert";
import { MuralSeo } from "@/components/seo/MuralSeo";

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [focusBrand, setFocusBrand] = useState<string | null>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const { brands: cachedBrands, loadBrands, invalidate } = useMuralCache();
  const brands = cachedBrands ?? [];
  const [muralKey, setMuralKey] = useState(0);
  const [showZoomLayer, setShowZoomLayer] = useState(false);
  const [showSparkleLayer, setShowSparkleLayer] = useState(false);
  const [ownerCompanyId, setOwnerCompanyId] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<MuralBrand | null>(null);
  const [openBidFlow, setOpenBidFlow] = useState(false);
  const { user } = useUserProfile();
  const { toast } = useToast();
  const [activeBid, setActiveBid] = useState<any>(null);

  const locationState = (location.state ?? {}) as { justPaid?: boolean };
  const justPaid = locationState.justPaid === true;

  // Busca de empresa removida para evitar bloqueio de renderização
  // O bypass já fornece as permissões necessárias

  useEffect(() => {
    loadBrands({ sortByBids: false });
  }, [loadBrands]);

  useEffect(() => {
    if (justPaid) {
      setShowZoomLayer(true);
      setShowSparkleLayer(true);
      navigate(location.pathname, { replace: true, state: {} });
      const t = setTimeout(() => setShowSparkleLayer(false), 10000);
      return () => clearTimeout(t);
    }
  }, [justPaid, navigate, location.pathname]);

  useEffect(() => {
    if (!focusBrand?.trim()) return;
    const found = brands.find((b) => b.name.toLowerCase() === focusBrand.toLowerCase());
    if (found) setSelectedBrand(found);
    setFocusBrand(null);
  }, [focusBrand, brands]);

  const handleSearch = useCallback((query: string) => {
    const q = (query || "").trim();
    setSearchQuery(q || null);
  }, []);

  const handleFocusBrand = useCallback((brandName: string) => {
    setFocusBrand(brandName);
    setSearchQuery(brandName);
    setDirectoryOpen(false);
    setShowZoomLayer(true);
    setTimeout(() => setShowZoomLayer(false), 1800);
  }, []);

  /** Recarrega o mural após uma transferência de posição (aceite de lance). */
  const handleRecarregarMural = useCallback(() => {
    invalidate();
    loadBrands({ sortByBids: false }).then(() => setMuralKey((k) => k + 1));
  }, [invalidate, loadBrands]);

  const handleBidRequest = useCallback(
    (brand: MuralBrand) => {
      recordClick(brand);
      const isReal = isUuidV4Like(brand.id);
      if (!isReal) {
        toast({
          title: "Demonstração",
          description: "Ofertas por posição são válidas apenas para marcas reais cadastradas no mural.",
        });
        setOpenBidFlow(false);
        setSelectedBrand(brand);
        return;
      }
      if (ownerCompanyId && brand.id === ownerCompanyId) {
        toast({ title: "Sua marca", description: "Você não pode dar lance na própria posição." });
        setOpenBidFlow(false);
        setSelectedBrand(brand);
        return;
      }
      if ((brand.blocks?.length ?? 0) === 0) {
        toast({
          title: "Sem blocos no mural",
          description: "Esta empresa ainda não tem posição no grid para negociar.",
        });
        setOpenBidFlow(false);
        setSelectedBrand(brand);
        return;
      }
      if (!user) {
        toast({ title: "Faça login", description: "Entre como empresa para enviar ofertas por posição.", variant: "destructive" });
        setOpenBidFlow(false);
        setSelectedBrand(brand);
        return;
      }
      if (!ownerCompanyId) {
        toast({
          title: "Empresa necessária",
          description: "Associe uma empresa à sua conta no Painel ou em Preços para enviar lances (RLS exige empresa de origem).",
          variant: "destructive",
        });
        setOpenBidFlow(false);
        setSelectedBrand(brand);
        return;
      }
      setOpenBidFlow(true);
      setSelectedBrand(brand);
    },
    [ownerCompanyId, toast, user],
  );

  const closeBrandModal = useCallback(() => {
    setSelectedBrand(null);
    setOpenBidFlow(false);
  }, []);

  useEffect(() => {
    if (!ownerCompanyId) return;

    const channel = supabase
      .channel("bids_nexus_owner")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "position_bids", filter: `to_brand_id=eq.${ownerCompanyId}` },
        (payload) => {
          setActiveBid(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ownerCompanyId]);

  const handleAcceptBid = async (bidId: string) => {
    const { data, error } = await supabase.rpc("accept_position_bid", { bid_id: bidId });
    if (error || (data as any)?.ok === false) {
      toast({ title: "Erro", description: (data as any)?.error || "Falha ao aceitar oferta.", variant: "destructive" });
    } else {
      toast({ title: "Sucesso!", description: "Posição transferida e pagamento recebido." });
      setActiveBid(null);
      handleRecarregarMural();
    }
  };

  const handleRejectBid = async (bidId: string) => {
    await supabase.from("position_bids").update({ status: "rejected" }).eq("id", bidId);
    setActiveBid(null);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-stage-void text-foreground">
      {/*
        Sem esta camada a home é invisível para busca: o mural é um <canvas>,
        e um crawler não lê pixels. Ela injeta H1/H2 semânticos, âncoras reais
        para cada marca e o JSON-LD da coleção — tudo em `sr-only`.
      */}
      <MuralSeo
        kind="empresas"
        entities={brands}
        path="/mural"
        title="Mural de Marcas | ConeXai — anuncie sua marca em blocos de pixels"
        description="Explore as marcas que ocupam o mural digital. Cada bloco é um território permanente de uma empresa anunciante, com logo, link e métricas de alcance em tempo real."
      />

      <AnimatePresence>
        {activeBid && (
          <BidNotificationAlert 
            bid={activeBid} 
            onAccept={handleAcceptBid} 
            onReject={handleRejectBid} 
          />
        )}
      </AnimatePresence>
      <MuralNavbar
        muralType="empresas"
        onSearch={handleSearch}
        onFocusBrand={handleFocusBrand}
        onOpenDirectory={() => setDirectoryOpen(true)}
        onCloseDirectory={() => setDirectoryOpen(false)}
        isDirectoryOpen={directoryOpen}
        glassMode
      />

      <div className="flex min-h-0 flex-1 flex-col pt-0">
        {/*
          A tela principal é só o mural. Todo HUD flutuante (hero, filtros de
          categoria, ranking, recarregar, assistente) foi retirado daqui: os
          blocos das marcas são o produto e qualquer painel sobreposto disputa
          atenção com eles — e, no caso do hero, chegava a cobrir o alternador
          de murais, escondendo o Influencer Index.
          Permanecem apenas navbar, alternador de murais, minimapa e os
          readouts de zoom/coordenada dentro do MuralCanvas.
        */}
        <MuralShell active="empresas" showPulse={false}>
          <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-stage-void">
            <MuralCanvas
              key={muralKey}
              searchHighlight={searchQuery}
              categoryHighlight={null}
              focusBrand={focusBrand}
              onFocusComplete={() => setFocusBrand(null)}
            />
          </div>
        </MuralShell>
      </div>

      <BrandDirectory brands={brands} open={directoryOpen} onClose={() => setDirectoryOpen(false)} onFocusBrand={handleFocusBrand} />

      <EnhancedBrandModal brand={selectedBrand} onClose={closeBrandModal} initialBidOpen={openBidFlow} />

      <AnimatePresence>
        {showZoomLayer && (
          <motion.div
            className="fixed inset-0 z-[150] pointer-events-none"
            initial={{ scale: 1.5, opacity: 1 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            onAnimationComplete={() => setShowZoomLayer(false)}
            style={{ background: "#050505" }}
          />
        )}
        {showSparkleLayer && (
          <motion.div
            className="fixed inset-0 z-[149] pointer-events-none new-brand-pulse"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              background: "radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.35) 0%, rgba(251, 191, 36, 0.1) 35%, transparent 65%)",
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
