import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, LogOut } from "lucide-react";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";
import { Button } from "@/components/ui/button";
import InfluencerWalletSection from "@/components/dashboard/InfluencerWalletSection";
import InfluencerContractsSection from "@/components/dashboard/InfluencerContractsSection";
import ActiveCampaignsList from "@/components/dashboard/ActiveCampaignsList";
import { getPostLoginRedirect } from "@/lib/userRouting";

/** Página do Portal de Ganhos: Carteira (withdrawable_balance) e Meus Contratos. */
export default function InfluencerGanhosPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        navigate("/auth");
        return;
      }
      const { type } = await getPostLoginRedirect(u.id);
      if (type === "company") {
        navigate("/dashboard");
        return;
      }
      if (type === "admin") {
        navigate("/admin");
        return;
      }
      setUser(u);
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background/95 via-background/90 to-background/95">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <ConeXaiLogo textClassName="font-display font-bold" showText />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/dashboard/influencer">
              <Button variant="ghost" size="sm" className="gap-2">
                <Wallet className="w-4 h-4" />
                Meu painel
              </Button>
            </Link>
            <Link to="/dashboard/influencer">
              <Button variant="ghost" size="sm" className="gap-2">
                Buscar marcas
              </Button>
            </Link>
            <span className="text-sm text-muted-foreground truncate max-w-[180px]">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut().then(() => navigate("/"))}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>
      <div className="container mx-auto px-6 py-10">
        <h1 className="text-3xl font-display font-bold mb-2 text-foreground flex items-center gap-2">
          <Wallet className="w-8 h-8 text-primary" />
          Portal de Ganhos
        </h1>
        <p className="text-muted-foreground mb-4">Saldo sacável e contratos. Solicite saque via PIX.</p>
        <p className="text-sm text-muted-foreground/90 mb-10 rounded-xl bg-primary/5 border border-primary/10 px-4 py-3 max-w-2xl">
          Sua participação é gratuita. Ganhamos apenas quando você fecha um negócio de sucesso.
        </p>
        <InfluencerWalletSection userId={user.id} />
        <InfluencerContractsSection userId={user.id} />

        <section className="mt-10">
          <h2 className="text-xl font-display font-bold text-foreground mb-2 flex items-center gap-2">
            Campanhas abertas
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Marcas que estão buscando influenciadores. Candidatar-se segue o fluxo de garantia (valor congelado → entrega → liberação - 15% taxa plataforma).</p>
          <ActiveCampaignsList userId={user.id} />
        </section>
      </div>
    </div>
  );
}
