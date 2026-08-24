import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Trash2, Pencil, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface InfluencerListProps {
  userId: string;
  onDataReload: () => void;
}

const InfluencerList = ({ userId, onDataReload }: InfluencerListProps) => {
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadInfluencers();
  }, [userId]);

  const loadInfluencers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("influencers")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    setInfluencers(data || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("influencers").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Influencer removido" });
      loadInfluencers();
      onDataReload();
    }
  };

  const formatFollowers = (count: number) => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return count.toString();
  };

  const statusMap: Record<string, { label: string; className: string }> = {
    pending: { label: "Pendente", className: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
    approved: { label: "Aprovado", className: "bg-green-500/15 text-green-600 border-green-500/30" },
    rejected: { label: "Rejeitado", className: "bg-red-500/15 text-red-600 border-red-500/30" },
  };

  if (loading) return null;
  if (influencers.length === 0) return null;

  return (
    <Card className="mb-6 glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Meus Perfis de Influencer
          <Badge variant="outline" className="ml-2 text-xs">{influencers.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {influencers.map((inf) => {
            const status = statusMap[inf.moderation_status] || statusMap.pending;
            return (
              <div
                key={inf.id}
                className="flex items-center gap-4 p-3 rounded-xl border border-border/30 hover:bg-muted/30 transition-colors"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden"
                  style={{ backgroundColor: inf.color, color: "#fff" }}
                >
                  {inf.photo_url ? (
                    <img src={inf.photo_url} alt={inf.name} className="w-full h-full object-cover" />
                  ) : (
                    inf.logo_initials
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{inf.name}</span>
                    <Badge className={status.className}>{status.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>{inf.category}</span>
                    {inf.niche && <span>• {inf.niche}</span>}
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {formatFollowers(inf.followers_count || 0)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link to={`/influencer/${inf.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(inf.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default InfluencerList;
