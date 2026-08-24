import { useState, useEffect } from "react";
import { Mail, Twitter, Instagram, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";
import { loadCountryRanking, type CountryRankEntry } from "@/lib/mural/MuralDataLoader";

function CountryRanking() {
  const [ranking, setRanking] = useState<CountryRankEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadCountryRanking()
      .then((data) => {
        if (!cancelled) setRanking(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (ranking.length === 0) return null;

  return (
    <div className="mt-8 pt-8 border-t border-border">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
        <MapPin className="w-3.5 h-3.5" />
        Ranking de países
      </p>
      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
        {ranking.map(({ country, label, blocks }) => (
          <li key={country} className="flex items-center gap-1.5">
            <span className="font-medium text-foreground">{label}</span>
            <span>({blocks} {blocks === 1 ? "bloco" : "blocos"})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const Footer = () => {
  const { t } = useI18n();

  return (
    <footer className="border-t border-border py-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2">
            <ConeXaiLogo textClassName="font-display font-bold text-lg" />
          </Link>

          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/#sobre" className="hover:text-foreground transition-colors">{t("footer.about")}</Link>
            <Link to="/termos" className="hover:text-foreground transition-colors">{t("footer.terms")}</Link>
            <Link to="/termos" className="hover:text-foreground transition-colors">{t("footer.privacy")}</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">{t("footer.contact")}</Link>
          </div>

          <div className="flex gap-4 text-muted-foreground">
            <a href="mailto:contato@conexai.com" className="hover:text-primary transition-colors" aria-label="Email">
              <Mail className="w-5 h-5" />
            </a>
            <a href="https://x.com/conexai" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors" aria-label="Twitter">
              <Twitter className="w-5 h-5" />
            </a>
            <a href="https://instagram.com/conexai" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors" aria-label="Instagram">
              <Instagram className="w-5 h-5" />
            </a>
          </div>
        </div>

        <CountryRanking />

        <div className="mt-8 text-center text-sm text-muted-foreground">{t("footer.rights")}</div>
      </div>
    </footer>
  );
};

export default Footer;
