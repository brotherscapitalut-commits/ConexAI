import { useEffect, useState } from "react";
import { Building2, CheckCircle, Link2, Loader2, Package, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  accepted: "Aceita",
  under_review: "Em revisão",
  paid: "Paga",
  cancelled: "Cancelada",
};

interface DirectOfferRow {
  id: string;
  company_id: string;
  amount: number;
  description: string | null;
  status: string;
  delivery_link: string | null;
  created_at: string;
  campaign_id: string | null;
  company_name?: string;
}

export default function InfluencerDirectOffersInbox({ userId }: { userId: string }) {
  const [offers, setOffers] = useState<DirectOfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deliveryLinks, setDeliveryLinks] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const loadOffers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("direct_offers")
      .select("id, company_id, amount, description, status, delivery_link, created_at, campaign_id")
      .eq("to_user_id", userId)
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as DirectOfferRow[];
    const companyIds = [...new Set(rows.map((o) => o.company_id).filter(Boolean))];
    let names: Record<string, string> = {};
    if (companyIds.length > 0) {
      const { data: companies } = await supabase.from("companies").select("id, name").in("id", companyIds);
      names = Object.fromEntries((companies ?? []).map((c) => [c.id, c.name]));
    }
    setOffers(rows.map((o) => ({ ...o, company_name: names[o.company_id] || "Marca" })));
    setLoading(false);

    if (rows.some((o) => !("read_at" in o))) return;
  };

  useEffect(() => {
    if (!userId) return;
    loadOffers();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("direct_offers")
      .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("to_user_id", userId)
      .is("read_at", null)
      .then(() => {});
  }, [userId, offers.length]);

  const handleAccept = async (offerId: string) => {
    setAcceptingId(offerId);
    const { data, error } = await supabase.rpc("accept_direct_offer", { offer_id: offerId });
    setAcceptingId(null);
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      toast({ title: "Erro ao aceitar", description: (result?.error as string) || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Oferta aceita", description: "O valor foi reservado. Envie o link da entrega quando concluir." });
    setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: "accepted" } : o)));
  };

  const handleSendDelivery = async (offerId: string) => {
    const link = (deliveryLinks[offerId] ?? "").trim();
    if (!link) {
      toast({ title: "Cole o link da entrega.", variant: "destructive" });
      return;
    }
    setSendingId(offerId);
    const { error } = await supabase
      .from("direct_offers")
      .update({ delivery_link: link, status: "under_review", updated_at: new Date().toISOString() })
      .eq("id", offerId)
      .eq("to_user_id", userId);
    setSendingId(null);
    if (error) {
      toast({ title: "Erro ao enviar entrega", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Entrega enviada", description: "A marca vai revisar e liberar o valor." });
    setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, delivery_link: link, status: "under_review" } : o)));
    setDeliveryLinks((prev) => ({ ...prev, [offerId]: "" }));
  };

  const activeCount = offers.filter((o) => ["pending", "accepted", "under_review"].includes(o.status)).length;

  return (
    <section id="inbox-convites" className="mb-10">
      <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-amber-400" />
        Inbox de Convites
        {activeCount > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-black">
            {activeCount}
          </span>
        )}
      </h2>
      <Card className="rounded-2xl border-amber-400/15 bg-white/5 backdrop-blur-md overflow-hidden">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground mb-4">
            Convites diretos enviados por marcas aparecem aqui. Aceite, entregue e acompanhe a liberação do valor.
          </p>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
            </div>
          ) : offers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum convite direto ainda. Quanto mais completo estiver seu perfil, mais fácil para marcas enviarem ofertas.
            </p>
          ) : (
            <ul className="space-y-3">
              {offers.map((offer) => (
                <li key={offer.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{offer.company_name || "Marca"}</p>
                      <p className="mt-0.5 text-sm font-semibold text-amber-400 tabular-nums">
                        R$ {Number(offer.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      {offer.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{offer.description}</p>}
                      {offer.delivery_link && (
                        <a href={offer.delivery_link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-amber-400 hover:underline">
                          <Link2 className="w-3 h-3" />
                          Link da entrega
                        </a>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(offer.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                    <span className={`self-start rounded-full px-2 py-1 text-xs font-medium ${
                      offer.status === "pending" ? "bg-amber-500/20 text-amber-300" :
                      offer.status === "accepted" ? "bg-emerald-500/20 text-emerald-300" :
                      offer.status === "under_review" ? "bg-blue-500/20 text-blue-300" :
                      offer.status === "cancelled" ? "bg-white/10 text-muted-foreground" :
                      "bg-primary/20 text-primary"
                    }`}>
                      {STATUS_LABELS[offer.status] ?? offer.status}
                    </span>
                  </div>

                  {offer.status === "pending" && (
                    <div className="mt-3 border-t border-white/10 pt-3">
                      <Button size="sm" className="gap-1.5" onClick={() => handleAccept(offer.id)} disabled={acceptingId === offer.id}>
                        {acceptingId === offer.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Aceitar convite
                      </Button>
                    </div>
                  )}

                  {offer.status === "accepted" && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row">
                      <Input
                        placeholder="Cole o link da entrega..."
                        value={deliveryLinks[offer.id] ?? ""}
                        onChange={(e) => setDeliveryLinks((prev) => ({ ...prev, [offer.id]: e.target.value }))}
                        className="text-sm"
                      />
                      <Button size="sm" className="gap-1.5 sm:w-auto" onClick={() => handleSendDelivery(offer.id)} disabled={sendingId === offer.id}>
                        {sendingId === offer.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Enviar entrega
                      </Button>
                    </div>
                  )}

                  {offer.status === "under_review" && (
                    <p className="mt-3 flex items-center gap-1.5 border-t border-white/10 pt-3 text-xs text-blue-300">
                      <Package className="w-3.5 h-3.5" />
                      Entrega enviada. Aguardando confirmação da marca.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
