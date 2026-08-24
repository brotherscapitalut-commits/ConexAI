import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Users, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

interface Conversation {
  id: string;
  company_id: string | null;
  influencer_id: string | null;
  status: string;
  last_message_at: string;
  created_at: string;
  company_name?: string;
  influencer_name?: string;
  lastMessagePreview?: string;
  lastMessageFromSelf?: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface ConversationsPanelProps {
  userId: string;
  /** Portal influenciador (Nexus): filtra conversas em que aparece como influencer alvo. */
  influencerIds?: string[];
  /** Mural influenciadores: IDs dos perfis influencer do usuário (para DM peer + lista). */
  muralViewerInfluencerIds?: string[];
  variant?: "default" | "nexus";
  companyId?: string | null;
  openConversationWithInfluencerId?: string | null;
  onUnreadCountChange?: (count: number) => void;
  floating?: boolean;
  onClose?: () => void;
}

const ConversationsPanel = ({
  userId,
  influencerIds,
  muralViewerInfluencerIds,
  variant = "default",
  companyId,
  openConversationWithInfluencerId,
  onUnreadCountChange,
  floating = false,
  onClose,
}: ConversationsPanelProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileResolved, setProfileResolved] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const openedFromMuralRef = useRef(false);
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;
    setProfileResolved(false);
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .or(`user_id.eq.${userId},id.eq.${userId}`)
        .maybeSingle();
      if (cancelled) return;
      setProfileId((data as { id?: string } | null)?.id ?? null);
      setProfileResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const loadConversations = useCallback(
    async (silent = false) => {
      if (!profileId) {
        if (!silent) setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      let query = supabase.from("conversations").select("*").order("last_message_at", { ascending: false });

      if (influencerIds?.length) {
        query = query.or(`influencer_id.in.(${influencerIds.join(",")}),initiated_by.eq.${profileId})`);
      } else if (muralViewerInfluencerIds?.length) {
        if (companyId) {
          query = query.or(
            `company_id.eq.${companyId},influencer_id.in.(${muralViewerInfluencerIds.join(",")}),initiated_by.eq.${profileId})`,
          );
        } else {
          query = query.or(`influencer_id.in.(${muralViewerInfluencerIds.join(",")}),initiated_by.eq.${profileId})`);
        }
      } else if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data } = await query;

      if (data && data.length > 0) {
        const companyIds = data.filter((c: { company_id: string | null }) => c.company_id).map((c: { company_id: string }) => c.company_id);
        const infIds = data.filter((c: { influencer_id: string | null }) => c.influencer_id).map((c: { influencer_id: string }) => c.influencer_id);

        const [companiesRes, influencersRes, messagesRes] = await Promise.all([
          companyIds.length > 0 ? supabase.from("companies").select("id, name").in("id", companyIds) : { data: [] },
          infIds.length > 0 ? supabase.from("influencers").select("id, name").in("id", infIds) : { data: [] },
          supabase.from("messages").select("conversation_id, content, sender_id, created_at").in("conversation_id", data.map((c: { id: string }) => c.id)).order("created_at", { ascending: false }),
        ]);

        const companyMap = new Map(((companiesRes as { data?: { id: string; name: string }[] }).data || []).map((c) => [c.id, c.name]));
        const influencerMap = new Map(((influencersRes as { data?: { id: string; name: string }[] }).data || []).map((i) => [i.id, i.name]));

        const messagesData = (messagesRes as { data?: { conversation_id: string; content: string; sender_id: string; created_at: string }[] }).data || [];
        const lastByConv = new Map<string, { content: string; sender_id: string }>();
        messagesData.forEach((m) => {
          if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, { content: m.content, sender_id: m.sender_id });
        });

        const mapped = data.map((c: { id: string; company_id: string | null; influencer_id: string | null; last_message_at: string; created_at: string; status: string }) => {
          const last = lastByConv.get(c.id);
          return {
            ...c,
            company_name: c.company_id ? companyMap.get(c.company_id) || "Empresa" : undefined,
            influencer_name: c.influencer_id ? influencerMap.get(c.influencer_id) || "Influencer" : undefined,
            lastMessagePreview: last ? (last.content.length > 50 ? last.content.slice(0, 50) + "…" : last.content) : undefined,
            lastMessageFromSelf: last ? last.sender_id === profileId : undefined,
          };
        });
        setConversations(mapped);
        const unreadCount = mapped.filter((c: { lastMessageFromSelf?: boolean }) => c.lastMessageFromSelf === false).length;
        onUnreadCountChange?.(unreadCount);
      } else {
        setConversations([]);
        onUnreadCountChange?.(0);
      }
      setLoading(false);
    },
    [profileId, companyId, influencerIds?.join(","), muralViewerInfluencerIds?.join(","), onUnreadCountChange],
  );

  useEffect(() => {
    if (!profileResolved) return;
    if (!profileId) {
      setLoading(false);
      return;
    }
    loadConversations();
  }, [profileResolved, profileId, loadConversations]);

  useEffect(() => {
    openedFromMuralRef.current = false;
  }, [openConversationWithInfluencerId]);

  useEffect(() => {
    if (!profileResolved || !openConversationWithInfluencerId || !userId || !profileId || loading) return;
    if (openedFromMuralRef.current) return;

    const targetInfluencerId = openConversationWithInfluencerId;
    const peerIdsForUser = muralViewerInfluencerIds?.length ? muralViewerInfluencerIds : influencerIds;
    const canCompanyPath = Boolean(companyId);
    const canPeerPath = Boolean(peerIdsForUser?.length);
    /* Aguarda carregar empresa / perfis influencer (evita toast falso no primeiro render). */
    if (!canCompanyPath && !canPeerPath) return;

    openedFromMuralRef.current = true;
    (async () => {
      try {
        if (peerIdsForUser?.length && peerIdsForUser.includes(targetInfluencerId)) {
          toast({ title: "Este é o seu próprio perfil no mural.", variant: "default" });
          return;
        }

        if (canCompanyPath) {
          const { data: existing } = await supabase
            .from("conversations")
            .select("id")
            .eq("company_id", companyId as string)
            .eq("influencer_id", targetInfluencerId)
            .maybeSingle();
          if (existing?.id) {
            setSelectedConv(existing.id);
            await loadConversations(true);
            return;
          }
          const { data: newConv, error } = await supabase
            .from("conversations")
            .insert({
              company_id: companyId,
              influencer_id: targetInfluencerId,
              status: "active",
              initiated_by: profileId,
            })
            .select("id")
            .single();
          if (error) throw error;
          setConversations((prev) => [
            ...prev,
            {
              id: newConv.id,
              company_id: companyId,
              influencer_id: targetInfluencerId,
              status: "active",
              last_message_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            } as Conversation,
          ]);
          setSelectedConv(newConv.id);
          await loadConversations(true);
          return;
        }

        const { data: existingPeer } = await supabase
          .from("conversations")
          .select("id")
          .is("company_id", null)
          .eq("influencer_id", targetInfluencerId)
          .maybeSingle();

        if (existingPeer?.id) {
          setSelectedConv(existingPeer.id);
          await loadConversations(true);
          return;
        }

        const { data: newConv, error } = await supabase
          .from("conversations")
          .insert({
            company_id: null,
            influencer_id: targetInfluencerId,
            status: "active",
            initiated_by: profileId,
          })
          .select("id")
          .single();

        if (error) throw error;
        setConversations((prev) => [
          ...prev,
          {
            id: newConv.id,
            company_id: null,
            influencer_id: targetInfluencerId,
            status: "active",
            last_message_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          } as Conversation,
        ]);
        setSelectedConv(newConv.id);
        await loadConversations(true);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast({ title: "Erro ao abrir conversa", description: msg, variant: "destructive" });
        openedFromMuralRef.current = false;
      }
    })();
  }, [
    profileResolved,
    companyId,
    openConversationWithInfluencerId,
    userId,
    profileId,
    loading,
    muralViewerInfluencerIds?.join(","),
    influencerIds?.join(","),
    loadConversations,
    toast,
  ]);

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv);

      const channel = supabase
        .channel(`messages-${selectedConv}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${selectedConv}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as Message]);
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => loadConversations(true), 30000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const loadMessages = async (convId: string) => {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", convId).order("created_at", { ascending: true });
    setMessages(data || []);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConv || !profileId) return;
    const { error } = await supabase.from("messages").insert({
      conversation_id: selectedConv,
      sender_id: profileId,
      content: newMessage.trim(),
    });
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } else {
      setNewMessage("");
      await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", selectedConv);
    }
  };

  const isNexus = variant === "nexus";
  const cardClass = isNexus ? "rounded-2xl border border-amber-400/20 bg-white/5 backdrop-blur-xl shadow-[0_0_24px_rgba(234,179,8,0.06)]" : "glass-card";
  const listItemClass = (selected: boolean) =>
    isNexus
      ? `w-full text-left p-3 rounded-xl transition-all text-sm border ${
          selected ? "bg-amber-500/10 border-amber-400/30 shadow-[0_0_12px_rgba(234,179,8,0.08)]" : "border-transparent hover:bg-white/5 hover:border-amber-400/10"
        }`
      : `w-full text-left p-2.5 rounded-lg transition-colors text-sm ${selected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"}`;

  if (!profileResolved || loading) {
    const loadingBody = (
      <CardContent className="p-6 text-center text-muted-foreground">Carregando conversas...</CardContent>
    );
    if (floating) {
      return (
        <div className="fixed bottom-4 right-4 z-[200] flex w-[min(100vw-1rem,400px)] max-h-[min(88vh,560px)] flex-col rounded-2xl border border-white/15 bg-background/95 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 shrink-0">
            <span className="text-sm font-display font-semibold">Mensagens</span>
            {onClose && (
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Card className={`${cardClass} border-0 shadow-none rounded-none flex-1 min-h-0`}>{loadingBody}</Card>
        </div>
      );
    }
    return <Card className={cardClass}>{loadingBody}</Card>;
  }

  if (!profileId) {
    const errBody = (
      <CardContent className="p-6 text-center text-muted-foreground text-sm">
        Perfil não encontrado no banco. Faça login novamente ou complete o cadastro.
      </CardContent>
    );
    if (floating) {
      return (
        <div className="fixed bottom-4 right-4 z-[200] flex w-[min(100vw-1rem,400px)] max-h-[min(88vh,560px)] flex-col rounded-2xl border border-white/15 bg-background/95 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 shrink-0">
            <span className="text-sm font-display font-semibold">Mensagens</span>
            {onClose && (
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Card className={`${cardClass} border-0 shadow-none rounded-none flex-1 min-h-0`}>{errBody}</Card>
        </div>
      );
    }
    return <Card className={cardClass}>{errBody}</Card>;
  }

  const panelBody = (
    <>
      {!floating && (
        <CardHeader className="pb-3">
          <CardTitle className={`flex items-center gap-2 text-lg font-display ${isNexus ? "text-amber-200/90" : ""}`}>
            <MessageCircle className={isNexus ? "w-5 h-5 text-amber-400" : "w-5 h-5 text-primary"} />
            {t("dash.panel_conversations")}
            {conversations.length > 0 && (
              <Badge variant="outline" className={`ml-2 text-xs ${isNexus ? "border-amber-400/30 text-amber-300" : ""}`}>
                {conversations.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={floating ? "p-3 pt-2 flex flex-col flex-1 min-h-0 overflow-hidden" : undefined}>
        {conversations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma conversa ainda.</p>
            <p className="text-xs mt-1">Inicie pelo perfil de um influencer no mural.</p>
          </div>
        ) : (
          <div className="flex gap-4 min-h-[300px]">
            <div className={`w-1/3 border-r pr-3 space-y-1.5 overflow-y-auto max-h-[400px] ${isNexus ? "border-amber-400/10" : "border-border"}`}>
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedConv(conv.id)}
                  className={listItemClass(selectedConv === conv.id)}
                >
                  <div className="font-medium truncate">
                    {conv.company_name || conv.influencer_name || "Conversa"}
                  </div>
                  {conv.lastMessagePreview && (
                    <div className={`text-xs mt-0.5 truncate ${conv.lastMessageFromSelf ? "text-amber-400/80" : "text-muted-foreground"}`}>
                      {conv.lastMessageFromSelf ? "Você: " : ""}
                      {conv.lastMessagePreview}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(conv.last_message_at).toLocaleDateString("pt-BR")} ·{" "}
                    {new Date(conv.last_message_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex-1 flex flex-col">
              {selectedConv ? (
                <>
                  <div className="flex-1 overflow-y-auto space-y-2 mb-3 max-h-[320px] pr-2">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender_id === profileId ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
                            msg.sender_id === profileId ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          }`}
                        >
                          {msg.content}
                          <div
                            className={`text-[10px] mt-1 ${
                              msg.sender_id === profileId ? "text-primary-foreground/60" : "text-muted-foreground"
                            }`}
                          >
                            {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Escreva uma mensagem..."
                      className="text-sm bg-card/60 border-border/50 text-foreground"
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    />
                    <Button size="sm" onClick={sendMessage} disabled={!newMessage.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Selecione uma conversa</div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </>
  );

  if (floating) {
    return (
      <div className="fixed bottom-4 right-4 z-[200] flex w-[min(100vw-1rem,400px)] max-h-[min(88vh,560px)] flex-col rounded-2xl border border-white/15 bg-background/95 shadow-2xl backdrop-blur-xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-white/10 shrink-0 bg-background/80">
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-display font-semibold truncate">{t("dash.panel_conversations")}</span>
            {conversations.length > 0 && <Badge variant="outline" className="text-[10px] shrink-0">{conversations.length}</Badge>}
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10 shrink-0" aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Card className={`${cardClass} border-0 shadow-none rounded-none flex flex-col flex-1 min-h-0 overflow-hidden`}>
          {panelBody}
        </Card>
      </div>
    );
  }

  return <Card className={cardClass}>{panelBody}</Card>;
};

export default ConversationsPanel;
