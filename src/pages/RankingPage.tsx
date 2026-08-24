import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Blocks, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useToast } from "@/hooks/use-toast";
import Ranking from "@/components/Ranking";

const INTENT_KEY = "intent_after_login";

const RankingPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profileType } = useUserProfile();
  const executedRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    const saveInfluencerId = searchParams.get("save_influencer");
    if (!saveInfluencerId || !user || profileType !== "company" || executedRef.current) return;

    (async () => {
      executedRef.current = true;
      try {
        const { data: comp } = await supabase
          .from("companies")
          .select("id")
          .eq("owner_id", user.id)
          .limit(1)
          .single();
        if (!comp?.id) {
          setSearchParams((p) => {
            p.delete("save_influencer");
            return p;
          }, { replace: true });
          return;
        }
        const { error } = await supabase.from("favorite_influencers").insert({
          company_id: comp.id,
          influencer_id: saveInfluencerId,
        });
        sessionStorage.removeItem(INTENT_KEY);
        setSearchParams((p) => {
          p.delete("save_influencer");
          return p;
        }, { replace: true });
        if (error) {
          if (error.code === "23505") {
            toast({ title: "Já está nos favoritos!" });
          } else throw error;
          return;
        }
        toast({ title: "Influenciador salvo!", description: "Ele aparece em Ofertas diretas no seu dashboard." });
        try {
          const confetti = await import("canvas-confetti");
          confetti.default({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
        } catch (_) {
          /* confetti optional */
        }
      } catch (e) {
        toast({
          title: "Erro ao salvar",
          description: e instanceof Error ? e.message : "Tente novamente.",
          variant: "destructive",
        });
        setSearchParams((p) => {
          p.delete("save_influencer");
          return p;
        }, { replace: true });
      }
    })();
  }, [searchParams, user, profileType, setSearchParams, toast]);

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
      <div className="border-b border-border/40 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <Blocks className="w-5 h-5 text-primary" />
            <span className="font-display font-bold">ConeXai</span>
          </Link>
        </div>
      </div>
      <Ranking />
    </div>
  );
};

export default RankingPage;
