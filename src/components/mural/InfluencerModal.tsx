import { useState, useEffect } from "react";
import { X, Tag, Users, ExternalLink, UserPlus, Loader2, Send, Copy, QrCode, MapPin, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useToast } from "@/hooks/use-toast";
import type { MuralInfluencer } from "@/data/influencerMockData";

interface InfluencerModalProps {
  influencer: MuralInfluencer | null;
  onClose: () => void;
  /** Posição do bloco no mural (ex: A12) */
  blockCoord?: string | null;
  /** User ID do influenciador (owner_id) quando disponível, para enviar oferta direta */
  toUserId?: string | null;
  /** Se definido, abre o chat no mural em vez de ir ao dashboard (apenas marcas). */
  onOpenChat?: (influencerId: string) => void;
}

const InfluencerModal = ({ influencer, onClose, blockCoord, toUserId: toUserIdProp, onOpenChat }: InfluencerModalProps) => {
  const [sending, setSending] = useState(false);
  const [proposalFormOpen, setProposalFormOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [resolvedToUserId, setResolvedToUserId] = useState<string | null>(toUserIdProp ?? null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [attachmentLink, setAttachmentLink] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, profileType, canUseBrandMessaging, loading: profileLoading } = useUserProfile();

  const profileUrl = influencer ? `${typeof window !== "undefined" ? window.location.origin : ""}/influencer/${influencer.id}` : "";
  const qrCodeUrl = profileUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(profileUrl)}` : "";

  useEffect(() => {
    if (toUserIdProp) {
      setResolvedToUserId(toUserIdProp);
      return;
    }
    if (!influencer || influencer.id.startsWith("influencer-")) return;
    supabase.from("influencers").select("owner_id").eq("id", influencer.id).maybeSingle().then(({ data }) => {
      const row = data as { owner_id?: string } | null;
      setResolvedToUserId(row?.owner_id ?? null);
    });
  }, [influencer?.id, toUserIdProp]);

  useEffect(() => {
    if (!proposalFormOpen) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("companies").select("id").eq("owner_id", user.id).maybeSingle();
      setCompanyId((data as { id?: string } | null)?.id ?? null);
    })();
  }, [proposalFormOpen]);

  const handleOpenProposalForm = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Faça login", description: "Entre como empresa para enviar proposta.", variant: "destructive" });
      return;
    }
    if (!resolvedToUserId) {
      toast({ title: "Perfil de demonstração", description: "Este perfil é apenas ilustrativo. Escolha um influenciador real no mural.", variant: "destructive" });
      return;
    }
    setProposalFormOpen(true);
  };

  const handleProporParceria = async () => {
    if (!influencer || !companyId || !resolvedToUserId) return;
    const amt = parseFloat(amount.replace(",", "."));
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Informe um valor válido (R$).", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      let fullDescription = description.trim() || "";
      if (paymentTerms.trim()) fullDescription += (fullDescription ? "\n\n" : "") + "Quando paga: " + paymentTerms.trim();
      if (attachmentLink.trim()) fullDescription += (fullDescription ? "\n\n" : "") + "Anexo: " + attachmentLink.trim();

      const { error } = await supabase.from("direct_offers").insert({
        company_id: companyId,
        to_user_id: resolvedToUserId,
        amount: amt,
        description: fullDescription || null,
        status: "pending",
      });
      if (error) throw error;
      toast({
        title: "Proposta enviada!",
        description: "O influenciador verá no Dashboard e poderá aceitar, recusar ou contrapor. O admin acompanha todas as ofertas.",
      });
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        setTimeout(() => confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0 } }), 150);
        setTimeout(() => confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1 } }), 300);
      } catch {}
      setProposalFormOpen(false);
      setAmount("");
      setDescription("");
      setPaymentTerms("");
      setAttachmentLink("");
    } catch (e: any) {
      toast({ title: "Erro ao enviar proposta", description: e?.message ?? "Tente novamente.", variant: "destructive" });
    }
    setSending(false);
  };

  if (!influencer) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative w-[92vw] max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-2xl"
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="relative h-28 rounded-t-3xl overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${influencer.color}50, ${influencer.color}15, transparent)`,
            }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
            >
              <X className="w-4 h-4 text-foreground" />
            </button>
          </div>
          <div className="flex justify-center -mt-10 relative z-10">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-display font-bold shadow-xl border-4 border-white/30"
              style={{ backgroundColor: influencer.color, color: "#fff" }}
            >
              {influencer.logo}
            </div>
          </div>
          <div className="px-6 pb-6 pt-3">
            <div className="text-center mb-4">
              <h2 className="font-display font-bold text-xl text-foreground">{influencer.name}</h2>
              <div className="flex items-center justify-center gap-1.5 mt-1 flex-wrap">
                <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">{influencer.category}</p>
                {blockCoord && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary/90 bg-primary/10 px-2 py-0.5 rounded-full">
                    <MapPin className="w-3 h-3" /> Bloco {blockCoord}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-4 justify-center text-sm text-muted-foreground mb-5">
              <div className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10">
                <span className="font-medium">{(influencer as MuralInfluencer).followers_count?.toLocaleString() ?? "—"}</span>
                <span className="text-xs ml-1">seguidores</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10">
                <span className="font-medium">{influencer.clicks.toLocaleString()}</span>
                <span className="text-xs ml-1">cliques</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Categorias de interesse
              </p>
              <p className="text-sm text-foreground">
                {(influencer as MuralInfluencer).interest_categories?.join(", ") ?? influencer.category}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 mb-5">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5" /> Divulgar meu perfil
              </p>
              <p className="text-[11px] text-muted-foreground mb-2">Link e QR Code para compartilhar seu espaço no mural.</p>
              <div className="flex gap-3 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={profileUrl}
                      className="flex-1 min-w-0 rounded-lg border border-white/20 bg-white/5 px-2.5 py-2 text-xs text-foreground truncate"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(profileUrl).then(() => toast({ title: "Link copiado!", description: "Cole onde quiser para divulgar." }));
                      }}
                      className="shrink-0 p-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary"
                      title="Copiar link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {qrCodeUrl && (
                  <a href={qrCodeUrl} download="perfil-conexai-qr.png" target="_blank" rel="noopener noreferrer" className="shrink-0 block rounded-lg overflow-hidden border border-white/20 bg-white/5">
                    <img src={qrCodeUrl} alt="QR Code do perfil" className="w-16 h-16 object-contain" />
                  </a>
                )}
              </div>
            </div>
            <div className="space-y-2.5">
              <a
                href={influencer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm font-medium hover:bg-white/20"
              >
                <ExternalLink className="w-4 h-4" /> Ver perfil
              </a>
              {!profileLoading && !user && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate("/auth", { state: { from: "/influencers" } });
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-4 py-3 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30"
                >
                  <MessageCircle className="w-4 h-4" /> Entrar para enviar mensagem
                </button>
              )}
              {!profileLoading && user && canUseBrandMessaging && (
                <button
                  type="button"
                  onClick={() => {
                    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (!uuidRe.test(influencer.id)) {
                      toast({
                        title: "Perfil de demonstração",
                        description: "Este card é ilustrativo. Inicie conversa com um influenciador cadastrado no sistema (dados reais no mural).",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (onOpenChat) {
                      onClose();
                      onOpenChat(influencer.id);
                      return;
                    }
                    onClose();
                    if (profileType === "influencer") {
                      navigate("/dashboard/influencer", { state: { openChatWithInfluencerId: influencer.id } });
                    } else {
                      navigate("/dashboard", { state: { openChatWithInfluencerId: influencer.id } });
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-4 py-3 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30"
                >
                  <MessageCircle className="w-4 h-4" /> Enviar mensagem
                </button>
              )}
              {!profileLoading && user && !canUseBrandMessaging && (
                <p className="text-[10px] text-muted-foreground text-center rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                  Faça login como empresa ou influenciador para conversar no mural.
                </p>
              )}
              <p className="text-[10px] text-muted-foreground text-center">
                {canUseBrandMessaging
                  ? "Marca fala como empresa; influenciador pode falar com outros influenciadores (DM) ou usar o mural de marcas para empresas."
                  : "Entre com uma conta empresa ou influenciador."}
              </p>
              {!proposalFormOpen ? (
                <>
                  <button
                    type="button"
                    onClick={handleOpenProposalForm}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-display font-semibold text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  >
                    <UserPlus className="w-4 h-4" /> Propor Parceria
                  </button>
                  <p className="text-[10px] text-muted-foreground text-center">
                    Preencha valor, o que você quer e condições. O influenciador pode aceitar, recusar ou contrapor. O admin acompanha todas as ofertas.
                  </p>
                </>
              ) : (
                <div className="rounded-xl border border-white/20 bg-white/5 p-4 space-y-3">
                  <p className="text-xs font-semibold text-foreground">Enviar proposta direta</p>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Valor (R$)"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <textarea
                    placeholder="O que você quer (ex.: 3 stories, 1 reel)"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Quando paga (opcional)"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                  />
                  <input
                    type="url"
                    placeholder="Link do anexo (opcional)"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={attachmentLink}
                    onChange={(e) => setAttachmentLink(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setProposalFormOpen(false); setAmount(""); setDescription(""); setPaymentTerms(""); setAttachmentLink(""); }}
                      className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-sm font-medium hover:bg-white/10"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleProporParceria}
                      disabled={sending}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {sending ? "Enviando..." : "Enviar proposta"}
                    </button>
                  </div>
                </div>
              )}
              <Link
                to="/dashboard/influencer"
                className="block text-center text-xs text-primary hover:underline"
                onClick={onClose}
              >
                Sou influenciador → Acessar meu Dashboard
              </Link>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InfluencerModal;
