import React from "react";
import { useLanguage } from "../../context/LanguageContext";

/**
 * Seletor de idioma compacto.
 *
 * ⚠️ Correção: os três `className` estavam escritos como
 * `className={px-2 py-1 rounded font-bold transition }` — sem as crases do
 * template literal. Isso não é JSX válido: o arquivo inteiro deixava de
 * parsear, o `npm run build` quebrava, e o `tsc` abortava a checagem do
 * projeto (os erros de todos os outros arquivos sumiam do relatório, dando a
 * falsa impressão de que o código estava mais saudável do que estava).
 *
 * Além de corrigir a sintaxe, o estado ativo passou a ser destacado — era
 * evidentemente a intenção do `${...}` que faltava no template.
 *
 * Nota: o projeto já tem `@/components/LanguageSwitcher`, usado na Navbar.
 * Este componente não é referenciado em lugar nenhum; mantido apenas para não
 * apagar trabalho de outra pessoa, mas vale consolidar os dois num só.
 */
const LANGUAGES = [
  { code: "en", flag: "🇺🇸", label: "EN" },
  { code: "pt", flag: "🇧🇷", label: "PT" },
  { code: "es", flag: "🇪🇸", label: "ES" },
] as const;

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 p-1 text-xs">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => setLanguage(lang.code)}
          aria-pressed={language === lang.code}
          className={`rounded px-2 py-1 font-bold transition ${
            language === lang.code
              ? "bg-white/15 text-white"
              : "text-white/50 hover:bg-white/5 hover:text-white"
          }`}
        >
          {lang.flag} {lang.label}
        </button>
      ))}
    </div>
  );
};

export default LanguageSelector;
