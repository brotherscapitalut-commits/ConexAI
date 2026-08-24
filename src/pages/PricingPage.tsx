import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Zap, Users } from "lucide-react";
import Pricing from "@/components/Pricing";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";

const PricingPage = () => {
  return (
    <div className="min-h-screen bg-background aurora-bg">
      {/* Premium Navbar */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-sm font-medium hidden sm:inline">Voltar ao mural</span>
            </Link>
            <div className="w-px h-4 bg-border/60 hidden sm:block" />
            <Link to="/" className="flex items-center gap-2">
              <ConeXaiLogo textClassName="font-display font-bold" showText />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pagamento seguro</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Publicação imediata</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>38K+ influenciadores</span>
              </div>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
};

export default PricingPage;

