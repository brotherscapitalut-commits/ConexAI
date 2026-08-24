import { useCallback, useEffect, useState } from "react";
import { LandingLang } from "@/lib/i18n/landingContent";

const STORAGE_KEY = "conexai_landing_lang";

/**
 * Resolve o idioma inicial da Landing Page.
 *
 * Ordem de prioridade:
 *  1. Escolha explícita salva antes (`localStorage`) — o usuário já decidiu,
 *     não perguntamos de novo a cada visita.
 *  2. Idioma do navegador (`navigator.language`): `pt-*` cai em português,
 *     `es-*` em espanhol.
 *  3. Inglês — padrão global, conforme pedido.
 */
function detectInitialLang(): LandingLang {
  if (typeof window === "undefined") return "en";

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "pt" || saved === "es") return saved;
  } catch {
    // localStorage pode estar bloqueado (modo privado/política de cookies) —
    // segue para a detecção por navegador em vez de quebrar a página.
  }

  const nav = (typeof navigator !== "undefined" && (navigator.language || navigator.languages?.[0])) || "";
  const lower = nav.toLowerCase();
  if (lower.startsWith("pt")) return "pt";
  if (lower.startsWith("es")) return "es";
  return "en";
}

export function useLandingLang(): [LandingLang, (lang: LandingLang) => void] {
  const [lang, setLangState] = useState<LandingLang>(() => detectInitialLang());

  const setLang = useCallback((next: LandingLang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sem persistência, o idioma ainda funciona nesta sessão — só não
      // sobrevive a um reload. Não é motivo para lançar erro ao usuário.
    }
  }, []);

  // Mantém o atributo `lang` do documento coerente com o que está na tela —
  // importante para leitores de tela e para o Google entender o idioma real
  // da página, não só o declarado no `<html>` estático do build.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return [lang, setLang];
}
