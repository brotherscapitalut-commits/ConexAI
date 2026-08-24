import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { FileText, CheckCircle, Loader2 } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  collecting_interest: "Lista de interesse",
  funded: "Valor congelado",
  active: "Em execução",
  completed: "Concluída",
  cancelled: "Cancelada",
};

interface ContractRow {
  campaign_id: string;
  amount: number;
  status: string;
  title: string | null;
  created_at: string;
  company_name?: string;
}

export default function InfluencerContractsSection({ userId }: { userId: string }) {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: myInfluencers } = await supabase.from("influencers").select("id").eq("owner_id", userId);
      const infIds = (myInfluencers ?? []).map((i) => i.id);
      if (infIds.length === 0) {
        setContracts([]);
        setLoading(false);
        return;
      }
      const { data: links } = await supabase.from("campaign_influencers").select("campaign_id").in("influencer_id", infIds);
      const campaignIds = [...new Set((links ?? []).map((l) => l.campaign_id))];
      if (campaignIds.length === 0) {
        setContracts([]);
        setLoading(false);
        return;
      }
      const { data: camps } = await supabase.from("active_campaigns").select("id, company_id, budget_per_influencer, title, created_at").in("id", campaignIds).order("created_at", { ascending: false });
      const rows = (camps ?? []) as Array<{ id: string; company_id: string; budget_per_influencer?: number; title: string | null; created_at: string }>;
      const companyIds = [...new Set(rows.map((c) => c.company_id).filter(Boolean))];
      let companyNames: Record<string, string> = {};
      if (companyIds.length > 0) {
        const { data: comps } = await supabase.from("companies").select("id, name").in("id", companyIds);
        companyNames = Object.fromEntries((comps ?? []).map((c) => [c.id, c.name]));
      }
      setContracts(
        rows.map((c) => ({
          campaign_id: c.id,
          amount: Number(c.budget_per_influencer ?? 0),
          status: "active",
          title: c.title,
          created_at: c.created_at,
          company_name: companyNames[c.company_id],
        })),
      );
      setLoading(false);
    })();
  }, [userId]);

  return (
    <section className="mb-10">
      <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" />
        Meus Contratos
      </h2>
      <Card className="rounded-2xl border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground mb-4">Campanhas em que você está na lista de interesse ou contratado. Acompanhe o status do pagamento garantido pela plataforma.</p>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">Nenhum contrato ainda. Empresas podem adicioná-lo à lista de interesse ao criar uma campanha.</p>
          ) : (
            <ul className="space-y-3">
              {contracts.map((c) => (
                <li key={c.campaign_id} className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5">
                  <div>
                    <p className="font-medium text-foreground">{c.title || "Campanha"} {c.company_name ? `— ${c.company_name}` : ""}</p>
                    <p className="text-sm text-muted-foreground">
                      R$ {Number(c.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} — {STATUS_LABELS[c.status] ?? c.status}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  {(c.status === "funded" || c.status === "active") && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                  {c.status === "completed" && <CheckCircle className="w-5 h-5 text-primary" />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
