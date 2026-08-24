import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Loader2, CheckCircle, Building2 } from "lucide-react";

interface CampaignRow {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  budget_per_influencer: number;
  slots_available: number;
  created_at: string;
  company_name?: string;
}

export default function ActiveCampaignsList({ userId }: { userId: string | null }) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [myApplicationIds, setMyApplicationIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data: campData } = await supabase.from("active_campaigns").select("id, company_id, title, description, budget_per_influencer, slots_available, created_at").gt("slots_available", 0).order("created_at", { ascending: false });
      const rows = (campData ?? []) as CampaignRow[];
      const companyIds = [...new Set(rows.map((c) => c.company_id))];
      let names: Record<string, string> = {};
      if (companyIds.length > 0) {
        const { data: comps } = await supabase.from("companies").select("id, name").in("id", companyIds);
        names = Object.fromEntries((comps ?? []).map((c) => [c.id, c.name]));
      }
      setCampaigns(rows.map((c) => ({ ...c, company_name: names[c.company_id] })));
      if (userId) {
        const { data: myApps } = await supabase.from("campaign_applications").select("campaign_id").eq("from_user_id", userId);
        setMyApplicationIds(new Set((myApps ?? []).map((a) => a.campaign_id)));
      }
      setLoading(false);
    })();
  }, [userId]);

  const handleCandidatar = async (campaignId: string) => {
    if (!userId) {
      toast({ title: "Faça login para participar da economia do mural.", variant: "destructive" });
      return;
    }
    setApplyingId(campaignId);
    const { error } = await supabase.from("campaign_applications").insert({ campaign_id: campaignId, from_user_id: userId, status: "pending" });
    setApplyingId(null);
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Você já se candidatou a esta campanha." });
        setMyApplicationIds((prev) => new Set([...prev, campaignId]));
      } else {
        toast({ title: "Erro ao se candidatar", description: error.message, variant: "destructive" });
      }
      return;
    }
    toast({ title: "Candidatura enviada! A marca verá no painel e poderá aceitar." });
    setMyApplicationIds((prev) => new Set([...prev, campaignId]));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Nenhuma campanha aberta no momento.</p>;
  }

  return (
    <div className="space-y-3">
      {campaigns.map((c) => {
        const alreadyApplied = myApplicationIds.has(c.id);
        return (
          <div key={c.id} className="p-4 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-fuchsia-500/20">
                <Megaphone className="w-5 h-5 text-fuchsia-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">{c.title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3" />{c.company_name || "Marca"}</p>
                {c.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                <p className="text-sm text-fuchsia-400 font-semibold mt-1">R$ {Number(c.budget_per_influencer).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · {c.slots_available} vaga(s)</p>
              </div>
            </div>
            {alreadyApplied ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0"><CheckCircle className="w-4 h-4" />Candidatado</span>
            ) : (
              <Button size="sm" className="shrink-0 gap-1.5 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500" onClick={() => handleCandidatar(c.id)} disabled={applyingId === c.id}>
                {applyingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Candidatar-se
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
