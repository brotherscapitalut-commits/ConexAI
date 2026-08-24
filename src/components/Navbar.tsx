import { useState } from "react";
import { Menu, X, LayoutDashboard, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const { user, profileType } = useUserProfile();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setOpen(false);
    navigate("/");
  };

  const panelPath =
    profileType === "admin" ? "/admin" : profileType === "influencer" ? "/dashboard/influencer" : "/dashboard";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <ConeXaiLogo textClassName="font-display font-bold text-lg" />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("nav.mural")}</Link>
          <Link to="/ranking" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("nav.ranking")}</Link>
          <Link to="/precos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("nav.pricing")}</Link>
          <LanguageSwitcher />
          {user ? (
            <>
              <Link to={panelPath} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                {profileType === "admin" ? <Shield className="w-4 h-4" /> : profileType === "influencer" ? <User className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                {profileType === "admin" ? "Admin" : profileType === "influencer" ? "Influencers" : "Dashboard"}
              </Link>
              <Button size="sm" variant="ghost" className="font-display font-semibold" onClick={handleLogout}>Sair</Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="font-display font-semibold">{t("nav.advertise")}</Button>
            </Link>
          )}
        </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen(!open)}>
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="container mx-auto px-6 py-6 flex flex-col gap-4">
              <Link to="/" className="text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>{t("nav.mural")}</Link>
              <Link to="/ranking" className="text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>{t("nav.ranking")}</Link>
              <Link to="/precos" className="text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>{t("nav.pricing")}</Link>
              <LanguageSwitcher />
              {user ? (
                <>
                  <Link to={panelPath} className="text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>
                    {profileType === "admin" ? "Admin" : profileType === "influencer" ? "Influencers" : "Dashboard"}
                  </Link>
                  <button type="button" className="text-left text-muted-foreground hover:text-foreground" onClick={handleLogout}>Sair</button>
                </>
              ) : (
                <Link to="/auth" onClick={() => setOpen(false)}>
                  <Button className="font-display font-semibold w-full">{t("nav.advertise")}</Button>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
