import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Copy, Send, ExternalLink, MessageCircle, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MuralBrand } from "@/lib/mural/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/hooks/useUserProfile";

function formatWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 10) return `55${digits}`;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

const INTENT_KEY = "intent_after_login";

interface InfluencerBrandPanelProps {
  brand: MuralBrand;
  onClose: () => void;
  influencerId?: string;
  influencerName?: string;
  /** Abrir o modal de proposta ao montar (ex.: retorno de login com intenção) */
  initialOpenProposal?: boolean;
}

export default function InfluencerBrandPanel({
  brand,
  onClose,
  influencerId,
  influencerName,
  initialOpenProposal,
}: InfluencerBrandPanelProps) {
  const navigate = useNavigate();
  const [proposalModalOpen, setProposalModalOpen] = useState(Boolean(initialOpenProposal));
  const [proposalAmount, setProposalAmount] = useState("");
  const [proposalDescription, setProposalDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [invitationLink, setInvitationLink] = useState<string>("");
  const { toast } = useToast();
  const { profileType, canUseBrandMessaging } = useUserProfile();
  const isCompany = profileType === "company";
  const displayName = influencerName ?? brand.name;
  const showSaveButton = Boolean((isCompany || canUseBrandMessaging) && influencerId && companyId);

  // Carregar link de convite
  useEffect(() => {
    if (!invitationLink && typeof window !== "undefined") {
      (async () => {
        try {
          const res = await fetch(
            `http://${window.location.hostname}:3001/api/auth/referral-link`,
            { headers: { Authorization: `Bearer ${localStorage.getItem("local_db_token") || ""}` } }
          );
          const json = await res.json().catch(() => ({}));
          const code = json?.data?.code;
          if (code) {
            setInvitationLink(`https://conexai.com.br/invitation?ref=${encodeURIComponent(code)}`);
          } else {
            const { data: { user } } = await supabase.auth.getUser();
            const uid = (user as { id?: string })?.id;
            setInvitationLink(uid ? `https://conexai.com.br/invitation?ref=${encodeURIComponent(uid)}` : "");
          }
        } catch {
          const { data: { user } } = await supabase.auth.getUser();
          const uid = (user as { id?: string })?.id;
          setInvitationLink(uid ? `https://conexai.com.br/invitation?ref=${encodeURIComponent(uid)}` : "");
        }
      })();
    }
  }, []);

  // Carregar status de favorito
  useEffect(() => {
    if ((!isCompany && !canUseBrandMessaging) || !influencerId) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: compRow } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      const compId = (compRow as { id?: string } | null)?.id ?? null;
      setCompanyId(compId);
      if (!compId) return;
      const { data: favData } = await (supabase.from("favorite_influencers" as any) as any)
        .select("id")
        .eq("company_id", compId)
        .eq("influencer_id", influencerId)
        .maybeSingle();
      setSaved(Boolean(favData));
    })();
  }, [isCompany, canUseBrandMessaging, influencerId]);

  const hasWhatsApp = Boolean(brand.contact_whatsapp?.trim());
  const hasEmail = Boolean(brand.contact_email?.trim());

  const handleOpenChat = () => {
    if (hasWhatsApp) {
      const num = formatWhatsAppNumber(brand.contact_whatsapp!);
      const text = encodeURIComponent(`Olá! Tenho interesse em parceria com ${brand.name}.`);
      window.open(`https://wa.me/${num}?text=${text}`, "_blank");
      return;
    }
    if (hasEmail) {
      const subj = encodeURIComponent(`Proposta de parceria - ${brand.name}`);
      const body = encodeURIComponent(`Olá,\n\nGostaria de propor uma parceria.\n\nAtenciosamente.`);
      window.open(`mailto:${brand.contact_email}?subject=${subj}&body=${body}`, "_blank");
      return;
    }
    if (brand.website && brand.website !== "#") {
      window.open(brand.website, "_blank");
      return;
    }
    toast({ title: "Contato não disponível", description: "Esta marca ainda não cadastrou WhatsApp ou e-mail." });
  };

  const handleToggleFavorite = async () => {
    if (!companyId || !influencerId) return;
    setSaving(true);
    if (saved) {
      const { error } = await supabase
        .from("favorite_influencers")
        .delete()
        .eq("company_id", companyId)
        .eq("influencer_id", influencerId);
      setSaving(false);
      if (error) {
        toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
        return;
      }
      setSaved(false);
      toast({ title: "Removido dos favoritos." });
    } else {
      const { error } = await (supabase.from("favorite_influencers" as any) as any).insert({
        company_id: companyId,
        influencer_id: influencerId,
      });
      setSaving(false);
      if (error) {
        if (error.code === "23505") {
          setSaved(true);
          toast({ title: "Já está nos favoritos." });
        } else {
          toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        }
        return;
      }
      setSaved(true);
      toast({ title: "Adicionado aos favoritos. Ele aparece em Ofertas diretas." });
    }
  };

  const handleCopyLink = async () => {
    const url = invitationLink || `https://conexai.com.br/invitation?ref=`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link de convite copiado!", description: "Use este link para atrair marcas para o seu perfil." });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const isUuid = (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const handleSendProposal = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      try {
        sessionStorage.setItem(INTENT_KEY, JSON.stringify({ action: "send_proposal", brandId: brand.id }));
        navigate(`/auth?next=action_send_proposal_${brand.id}`);
        onClose();
      } catch {
        toast({ title: "Faça login para participar da economia do mural.", variant: "destructive" });
      }
      return;
    }
    const isTestCompany = brand.name === "Empresa Teste ConexAi";
    if (!isTestCompany && !isUuid(brand.id)) {
      toast({
        title: "Empresa inválida",
        description: "Selecione uma empresa real do mural para enviar proposta.",
        variant: "destructive",
      });
      return;
    }
    const amount = parseFloat(proposalAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Informe o valor da parceria.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data: infRow } = await supabase
      .from("influencers")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    const infId = (infRow as { id?: string } | null)?.id ?? null;
    const { error } = await (supabase.from("partnership_proposals" as any) as any).insert({
      from_user_id: user.id,
      influencer_id: infId,
      to_company_id: brand.id,
      amount,
      description: proposalDescription.trim() || null,
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro ao enviar proposta", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Proposta enviada!",
      description: "A marca verá seu valor e descrição no painel de propostas recebidas.",
    });
    setProposalModalOpen(false);
    setProposalAmount("");
    setProposalDescription("");
  };

  // ── Formatar audiência ────────────────────────────────────
  const formatAudience = (n?: number) => {
    if (!n) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return String(n);
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full max-w-md z-[150] flex flex-col bg-[#0a0a0c]/90 backdrop-blur-3xl border-l border-white/10 shadow-[-20px_0_60px_rgba(0,0,0,0.7)] animate-in slide-in-from-right duration-500">
      
      {/* ── Header Imersivo ─────────────────────────────────── */}
      <div className="relative h-56 w-full shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-50 blur-3xl scale-150 animate-pulse"
          style={{ backgroundColor: brand.color }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/30 to-transparent" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white/70 hover:text-white transition-all border border-white/10"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Avatar + Nome */}
        <div className="absolute bottom-5 left-6 flex items-end gap-4 z-20">
          <div
            className="relative w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-bold shadow-2xl border-2 border-white/20 overflow-hidden shrink-0"
            style={{ backgroundColor: brand.color, color: "#fff" }}
          >
            {brand.logo_url ? (
              <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-cover" />
            ) : (
              <span className="drop-shadow-lg">{brand.logo || brand.name.substring(0, 2)}</span>
            )}
            {/* Online indicator */}
            <div className="absolute bottom-1.5 right-1.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0a0a0c] shadow" />
          </div>

          <div className="flex flex-col gap-1 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-bold text-2xl text-white tracking-tight leading-none">
                {displayName}
              </h2>
              {brand.badges && brand.badges.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-fuchsia-500 text-[10px] font-bold text-white uppercase tracking-wide">
                  {brand.badges[0]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-white/40 font-medium uppercase tracking-widest">
                {brand.category || "Influenciador"}
              </span>
              <span className="text-white/20">•</span>
              <span className="text-fuchsia-400 font-bold uppercase tracking-wider">✦ Verificado</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Corpo Scrollável ──────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">

        {proposalModalOpen ? (
          /* ── FORM DE PROPOSTA ELITE ── */
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start justify-between pb-4 border-b border-white/8">
              <div>
                <h3 className="font-display font-bold text-xl text-white">Nova Proposta</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Para {displayName}</p>
              </div>
              <button
                type="button"
                onClick={() => setProposalModalOpen(false)}
                className="p-2 rounded-xl hover:bg-white/5 transition-colors text-zinc-500 hover:text-white mt-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Valor da parceria</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-bold">R$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={proposalAmount}
                  onChange={(e) => setProposalAmount(e.target.value)}
                  className="bg-zinc-900/80 border-white/8 h-14 pl-12 text-xl font-display text-white placeholder:text-zinc-700 focus-visible:ring-fuchsia-500/40 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Entregáveis</label>
              <textarea
                placeholder="Ex: 3 stories + 1 reel com link na bio por 24h..."
                value={proposalDescription}
                onChange={(e) => setProposalDescription(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-white/8 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                variant="ghost"
                className="flex-1 h-12 rounded-xl border border-white/8 hover:bg-white/5 text-zinc-500"
                onClick={() => setProposalModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 shadow-lg shadow-fuchsia-500/20 font-bold hover:opacity-90 active:scale-[0.98] transition-all"
                onClick={handleSendProposal}
                disabled={submitting}
              >
                {submitting ? "Enviando…" : "Enviar Proposta"}
              </Button>
            </div>
          </div>
        ) : (
          /* ── PERFIL ELITE ── */
          <>
            {/* Métricas */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Audiência", value: formatAudience(brand.followers_count), color: "text-white" },
                {
                  label: "Cliques/h",
                  value: String(brand.clicks_last_hour ?? brand.clicks ?? 0),
                  color: "text-fuchsia-400",
                },
                {
                  label: "Parcerias",
                  value: String(brand.contracts_count ?? brand.completed_deals ?? "—"),
                  color: "text-emerald-400",
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col items-center gap-1 hover:bg-white/[0.06] transition-all"
                >
                  <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tight">{label}</span>
                  <span className={`text-base font-display font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* Bio */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Sobre</span>
                {brand.interest_categories && brand.interest_categories.length > 0 ? (
                  <div className="flex gap-1">
                    {brand.interest_categories.slice(0, 2).map((cat) => (
                      <span
                        key={cat}
                        className="px-2 py-0.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-[10px] font-medium text-fuchsia-400"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium text-zinc-400">
                    {brand.category}
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Criador de conteúdo em{" "}
                <strong className="text-zinc-200 font-semibold">{brand.category}</strong>, com
                audiência altamente engajada. Especializado em entregas autênticas e parcerias de alto impacto.
              </p>
            </div>

            {/* Favoritar */}
            {showSaveButton && (
              <button
                type="button"
                onClick={handleToggleFavorite}
                disabled={saving}
                className={`w-full flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${
                  saved
                    ? "border-rose-500/30 bg-rose-500/8 text-rose-400"
                    : "border-white/8 text-zinc-500 hover:border-fuchsia-500/25 hover:bg-fuchsia-500/5 hover:text-fuchsia-400"
                }`}
              >
                <Heart className={`w-4 h-4 ${saved ? "fill-current" : ""}`} />
                {saved ? "Adicionado aos Favoritos ✓" : "Adicionar aos Favoritos"}
              </button>
            )}

            {/* CTA Principal */}
            <Button
              className="w-full gap-2.5 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 text-white border-0 shadow-xl shadow-fuchsia-500/20 h-14 text-base font-bold rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.98]"
              onClick={() => {
                supabase.auth.getUser().then(({ data: { user } }) => {
                  if (!user) {
                    toast({ title: "Faça login para participar da economia do mural.", variant: "destructive" });
                    return;
                  }
                  setProposalModalOpen(true);
                });
              }}
            >
              <Send className="w-5 h-5" />
              Enviar Proposta de Campanha
            </Button>

            {/* Contato Direto */}
            <Button
              variant="outline"
              className="w-full gap-2 border-white/8 text-zinc-400 hover:bg-white/5 hover:text-white rounded-2xl h-11 text-sm"
              onClick={handleOpenChat}
            >
              <MessageCircle className="w-4 h-4" />
              Contato Direto (WhatsApp / E-mail)
            </Button>

            {/* Ações Secundárias */}
            <div className="pt-3 border-t border-white/5 space-y-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-2 text-zinc-600 hover:text-fuchsia-400 hover:bg-fuchsia-500/5 rounded-xl h-10 text-xs"
                onClick={handleCopyLink}
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar Link de Divulgação
              </Button>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-400/5 border border-amber-400/10">
                <span className="text-amber-400 text-sm shrink-0 mt-0.5">⚠️</span>
                <p className="text-[11px] text-amber-200/60 leading-snug">
                  Para sua segurança, mantenha as negociações dentro da plataforma. Pagamentos externos não possuem garantia.
                </p>
              </div>

              {brand.website && brand.website !== "#" && (
                <a
                  href={brand.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-fuchsia-400 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Website Oficial
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
