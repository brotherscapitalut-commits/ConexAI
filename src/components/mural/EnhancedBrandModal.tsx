import { MuralBrand } from "@/lib/mural/types";
import { gridToCoordinate } from "@/lib/mural/MuralEngine";
import {
  ExternalLink, X, MousePointerClick, Grid3X3, Globe, Tag, Users,
  DollarSign, MapPin, Mail, Phone, Instagram, Building2, Sparkles, Youtube,
  FileText, UserPlus, Gavel,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { computeCost, blockPriceFor } from "@/lib/stripe";
import { MuralBiddingService, minimumBidFor } from "@/lib/mural/MuralBidding";
import type { BlockRegion } from "@/lib/stripe";
import { isUuidV4Like } from "@/lib/uuid";
import { MuralBiddingModal } from "@/lib/mural/MuralBiddingModal";

interface EnhancedBrandModalProps {
  brand: MuralBrand | null;
  onClose: () => void;
  /** Abre o fluxo de lance (modal de valor) assim que o modal da marca abre — ex.: botão Bid no card. */
  initialBidOpen?: boolean;
}

interface CompanyDetails {
  description?: string | null;
  product_service?: string | null;
  target_audience?: string | null;
  avg_budget?: string | null;
  region?: string | null;
  contact_email?: string | null;
  contact_whatsapp?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  logo_url?: string | null;
}

const EnhancedBrandModal = ({ brand, onClose, initialBidOpen = false }: EnhancedBrandModalProps) => {
  const [details, setDetails] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [bidModalOpen, setBidModalOpen] = useState(false);
  /** Bid+ — intenção de ampliar lotes (checkout real em evolução) */
  const [lotBidModalOpen, setLotBidModalOpen] = useState(false);
  const [extraLots, setExtraLots] = useState(1);
  const { user } = useUserProfile();
  const [myCompanyId, setMyCompanyId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      setMyCompanyId(null);
      return;
    }
    supabase.from("companies").select("id").eq("owner_id", user.id).limit(1).maybeSingle().then(({ data }) => {
      setMyCompanyId((data as { id?: string } | null)?.id ?? null);
    });
  }, [user]);

  useEffect(() => {
    if (!brand) {
      setBidModalOpen(false);
      return;
    }
    const isRealCompany = isUuidV4Like(brand.id);
    const canBid =
      (brand.blocks?.length ?? 0) > 0 &&
      isRealCompany &&
      myCompanyId != null &&
      brand.id !== myCompanyId;
    if (initialBidOpen && canBid) {
      setBidModalOpen(true);
    } else if (!initialBidOpen) {
      setBidModalOpen(false);
    }
    // myCompanyId omitido de deps: evita fechar o fluxo Bid aberto pelo utilizador quando o ID da empresa carrega.
  }, [brand?.id, initialBidOpen]);

  useEffect(() => {
    if (!brand || !myCompanyId) return;
    if (brand.id === myCompanyId) {
      setBidModalOpen(false);
    }
  }, [brand?.id, myCompanyId]);


  // Fetch full company details from DB
  useEffect(() => {
    if (!brand) {
      setDetails(null);
      return;
    }

    if (!isUuidV4Like(brand.id)) {
      setDetails(null);
      return;
    }

    setLoading(true);
    supabase
      .from("companies")
      .select("description, product_service, target_audience, avg_budget, region, contact_email, contact_whatsapp, instagram, tiktok, youtube, logo_url")
      .eq("id", brand.id)
      .single()
      .then(({ data }) => {
        setDetails(data || null);
        setLoading(false);
      });
  }, [brand]);

  if (!brand) return null;

  const isRealCompany = isUuidV4Like(brand.id);
  const isOwnerOfThisBrand = Boolean(isRealCompany && myCompanyId && brand.id === myCompanyId);

  const blockCount = brand.blocks?.length ?? 0;
  const regionKey = ((): BlockRegion => {
    const r = (details?.region ?? "").toString().toLowerCase().replace(/\s+/g, "_");
    if (r === "centro_premium" || r === "centro" || r.includes("centro")) return "centro_premium";
    if (r === "intermediaria" || r === "intermediária" || r.includes("intermediar")) return "intermediaria";
    if (r === "borda" || r.includes("borda")) return "borda";
    return "centro_premium";
  })();
  // Custo mensal total da posição: assinatura base do plano da zona mais a
  // taxa por bloco. O add-on Premium Plus foi absorvido pelo plano Premium.
  const unitPrice = blockPriceFor(regionKey);
  const costUsd = computeCost(regionKey, blockCount).monthly;
  const positionValue = (typeof brand.position_value === "number" && brand.position_value > 0) ? brand.position_value : costUsd;
  // Piso e presets vêm do serviço de leilão, para que este modal não mantenha
  // uma segunda cópia das regras (era 3x/6x/10x aqui contra 5x/10x/20x lá).
  const bidStats = MuralBiddingService.calculateBidStats(positionValue);
  const minBid = Math.max(1, minimumBidFor(positionValue));
  const preset1 = bidStats.options[0]?.value ?? minBid;
  const preset2 = bidStats.options[1]?.value ?? minBid * 2;
  const preset3 = bidStats.options[2]?.value ?? minBid * 4;
  const customMin = minBid;

  const territoryRange =
    brand.blocks && brand.blocks.length > 0
      ? (() => {
          let minX = brand.blocks[0].x;
          let maxX = brand.blocks[0].x;
          let minY = brand.blocks[0].y;
          let maxY = brand.blocks[0].y;
          for (const b of brand.blocks) {
            minX = Math.min(minX, b.x);
            maxX = Math.max(maxX, b.x);
            minY = Math.min(minY, b.y);
            maxY = Math.max(maxY, b.y);
          }
          const start = gridToCoordinate(minX, minY);
          const end = gridToCoordinate(maxX, maxY);
          return start === end ? start : `${start} – ${end}`;
        })()
      : null;

  const seoTitle = `${brand.name} | ConeXai - ${brand.category}`;
  const seoDescription = `${brand.name} atua em ${brand.category}. Conheça a empresa no ConeXai e descubra parcerias com influenciadores.`;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        aria-label="Fechar"
      >
        <motion.div
          className="relative w-[92vw] max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-3xl border border-primary/20 bg-card/80 shadow-[0_0_40px_hsl(var(--primary)/20%)] backdrop-blur-3xl min-w-0"
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          style={{ overflowX: "hidden" }}
        >
          {/* Header with gradient */}
          <div
            className="relative h-28 rounded-t-3xl overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${brand.color}50, ${brand.color}15, transparent)`,
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
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
            >
              <X className="w-4 h-4 text-foreground" />
            </button>
          </div>

          {/* Logo overlapping header */}
          <div className="flex justify-center -mt-10 relative z-10">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-display font-bold shadow-xl border-4 border-white/30 bg-white/10 backdrop-blur-sm"
              style={{ backgroundColor: brand.color, color: "#fff" }}
            >
              {brand.logo}
            </div>
          </div>

          <div className="px-6 pb-6 pt-3 min-w-0 overflow-x-hidden">
            {/* Name & category */}
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <h2 className="font-display font-bold text-xl text-foreground">{brand.name}</h2>
                {brand.isPerpetual && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 text-xs font-bold shadow-sm">
                    Premium Plus
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <Tag className="w-3 h-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{brand.category}</p>
              </div>
              {brand.isPerpetual && (
                <p className="text-xs text-amber-600/90 dark:text-amber-400/90 mt-1.5">Destaque máximo no mural · Brilho constante</p>
              )}
            </div>

            {/* SEO dinâmico */}
            <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                SEO
              </p>
              <p className="text-xs font-medium text-foreground mb-0.5 line-clamp-1" title={seoTitle}>
                {seoTitle}
              </p>
              <p className="text-[11px] text-muted-foreground line-clamp-2" title={seoDescription}>
                {seoDescription}
              </p>
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

            {/* Stats + Localização */}
            <div className="flex flex-wrap gap-3 justify-center text-sm text-muted-foreground mb-5">
              {territoryRange && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium tabular-nums">Território: {territoryRange}</span>
                </div>
              )}
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

            {/* Detailed info section (from DB) */}
            {loading && (
              <div className="flex justify-center py-4">
                <motion.div
                  className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </div>
            )}

            {details && (
              <div className="space-y-3 mb-5">
                {details.description && (
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Sobre a empresa
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{details.description}</p>
                  </div>
                )}

                {details.product_service && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/50">
                    <Building2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produto / Serviço</p>
                      <p className="text-sm text-foreground">{details.product_service}</p>
                    </div>
                  </div>
                )}

                {details.target_audience && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/50">
                    <Users className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Público-alvo</p>
                      <p className="text-sm text-foreground">{details.target_audience}</p>
                    </div>
                  </div>
                )}

                {details.avg_budget && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/50">
                    <DollarSign className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Orçamento médio</p>
                      <p className="text-sm text-foreground">{details.avg_budget}</p>
                    </div>
                  </div>
                )}

                {details.region && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/50">
                    <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Região</p>
                      <p className="text-sm text-foreground">{details.region}</p>
                    </div>
                  </div>
                )}

                {/* Social / Contact */}
                <div className="flex flex-wrap gap-2">
                  {details.instagram && (
                    <a
                      href={`https://instagram.com/${details.instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                    >
                      <Instagram className="w-3.5 h-3.5" />
                      Instagram
                    </a>
                  )}
                  {details.tiktok && (
                    <a
                      href={`https://tiktok.com/@${details.tiktok.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                    >
                      TikTok
                    </a>
                  )}
                  {details.youtube && (
                    <a
                      href={details.youtube.startsWith("http") ? details.youtube : `https://youtube.com/${details.youtube.startsWith("@") ? details.youtube : `@${details.youtube}`}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                    >
                      <Youtube className="w-3.5 h-3.5" />
                      YouTube
                    </a>
                  )}
                  {details.contact_email && (
                    <a
                      href={`mailto:${details.contact_email}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      E-mail
                    </a>
                  )}
                  {details.contact_whatsapp && (
                    <a
                      href={`https://wa.me/${details.contact_whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* If not a real company, show placeholder description */}
            {!isRealCompany && (
              <div className="p-3 rounded-xl bg-muted/30 border border-border/50 mb-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Sobre a empresa
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {brand.name} é uma empresa líder no setor de {brand.category.toLowerCase()}, 
                  oferecendo soluções inovadoras para seus clientes. 
                  Com presença no mural desde {new Date(brand.joinedAt).toLocaleDateString("pt-BR")}.
                </p>
              </div>
            )}

            {/* Links sociais */}
            <div className="flex flex-wrap gap-2 mb-4">
              {brand.website && brand.website !== "#" && (
                <a
                  href={brand.website.startsWith("http") ? brand.website : `https://${brand.website.replace(/^\/*/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/20 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  {brand.website.includes("instagram.com") ? "Instagram" : brand.website.includes("tiktok.com") ? "TikTok" : brand.website.includes("youtube.com") ? "YouTube" : "Site"}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {(details?.instagram ?? brand.instagram) && (
                <a href={`https://instagram.com/${(details?.instagram ?? brand.instagram)!.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/20">
                  <Instagram className="w-4 h-4" /> Instagram
                </a>
              )}
              {(details?.tiktok ?? brand.tiktok) && (
                <a href={`https://tiktok.com/@${(details?.tiktok ?? brand.tiktok)!.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/20">
                  TikTok
                </a>
              )}
              {(details?.youtube ?? brand.youtube) && (() => {
                const yt = (details?.youtube ?? brand.youtube) as string;
                const ytHref = yt.startsWith("http") ? yt : `https://youtube.com/${yt.startsWith("@") ? yt : `@${yt}`}`;
                return (
                  <a href={ytHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-medium hover:bg-white/20">
                    <Youtube className="w-4 h-4" /> YouTube
                  </a>
                );
              })()}
            </div>

            {/* Só o dono da empresa vê o atalho para o mural de influenciadores */}
            {isOwnerOfThisBrand && (
              <Link
                to="/influencers"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-display font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 mb-3"
                onClick={onClose}
              >
                <UserPlus className="w-4 h-4" />
                Fazer parceria com influenciador
              </Link>
            )}

            {/* NÃO REMOVER: Bid — oferta por posição; aparece para visitantes se a marca habilitou open_for_bids */}
            {(brand.blocks?.length ?? 0) > 0 && brand.open_for_bids && isRealCompany && (myCompanyId == null || brand.id !== myCompanyId) && (
              <>
                <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full flex-1 gap-2 rounded-xl border-primary/40 text-primary hover:bg-primary/10"
                    onClick={() => {
                      if (!user) {
                        toast({ title: "Faça login para participar da economia do mural.", variant: "destructive" });
                        return;
                      }
                      setBidModalOpen(true);
                    }}
                  >
                    <Gavel className="h-4 w-4" />
                    Bid — Oferta por posição
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full flex-1 gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                    onClick={() => {
                      if (!user) {
                        toast({ title: "Faça login para participar da economia do mural.", variant: "destructive" });
                        return;
                      }
                      setExtraLots(1);
                      setLotBidModalOpen(true);
                    }}
                  >
                    <Gavel className="h-4 w-4" />
                    Bid+ Lotes
                  </Button>
                </div>
                <AnimatePresence>
                  {lotBidModalOpen && (
                    <>
                      <div className="fixed inset-0 z-[110] bg-black/60" onClick={() => setLotBidModalOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="fixed left-1/2 top-1/2 z-[111] w-full max-w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#0A0A0A]/95 p-5 shadow-2xl backdrop-blur-xl"
                      >
                        <h3 className="mb-1 font-display text-lg font-bold text-foreground">Ampliar lotes</h3>
                        <p className="mb-4 text-xs text-muted-foreground">
                          Defina quantos lotes adicionais deseja negociar. O checkout de blocos será confirmado na próxima etapa.
                        </p>
                        <div className="mb-4 flex items-center justify-center gap-4">
                          <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => setExtraLots((n) => Math.max(1, n - 1))}>
                            −
                          </Button>
                          <span className="min-w-[3rem] text-center font-display text-2xl font-bold tabular-nums text-amber-400">{extraLots}</span>
                          <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => setExtraLots((n) => Math.min(99, n + 1))}>
                            +
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" className="flex-1" onClick={() => setLotBidModalOpen(false)}>
                            Cancelar
                          </Button>
                          <Button
                            className="flex-1"
                            onClick={() => {
                              toast({
                                title: "Lotes reservados no fluxo",
                                description: `${extraLots} lote(s) adicionais — continue em Preços / checkout para concluir.`,
                              });
                              setLotBidModalOpen(false);
                            }}
                          >
                            Continuar
                          </Button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {bidModalOpen && (
                    <MuralBiddingModal
                      brand={brand}
                      fromCompanyId={myCompanyId}
                      onClose={() => setBidModalOpen(false)}
                      onSuccess={() => setBidModalOpen(false)}
                    />
                  )}
                </AnimatePresence>
              </>
            )}

            {isRealCompany && (
              <Link
                to={`/empresa/${brand.id}`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-display font-semibold hover:bg-white/10 transition-all"
                onClick={onClose}
              >
                <Building2 className="w-4 h-4" />
                Ver perfil completo
              </Link>
            )}

            {/* Member since */}
            <p className="text-[10px] text-muted-foreground text-center mt-4">
              Membro desde {new Date(brand.joinedAt).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EnhancedBrandModal;
