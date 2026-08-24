import { Globe } from "lucide-react";
import { useI18n, Locale, LOCALE_LABELS } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LanguageSwitcher = () => {
  const { locale, setLocale } = useI18n();

  return (
    <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
      <SelectTrigger className="w-auto gap-1.5 border-border/50 bg-transparent h-8 text-xs px-2">
        <Globe className="w-3.5 h-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([code, label]) => (
          <SelectItem key={code} value={code} className="text-xs">
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default LanguageSwitcher;
