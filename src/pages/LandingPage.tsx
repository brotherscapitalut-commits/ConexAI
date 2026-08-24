import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Gavel,
  MousePointerClick,
  Sparkles,
  Upload,
  Bot,
  TrendingUp,
  Check,
  Layers,
  Star,
  Globe,
  Menu,
  X,
  Newspaper,
  ArrowUpRight,
} from "lucide-react";
import { BlockField } from "@/components/landing/BlockField";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  PLANS,
  BLOCK_REGIONS,
  computeCost,
  formatUsd,
  type PlanDefinition,
  type BlockRegion,
} from "@/lib/stripe";
import { MIN_BID_MULTIPLIER } from "@/lib/mural/MuralBidding";
import { MOCK_BRANDS } from "@/data/mockData";
import { MOCK_INFLUENCERS } from "@/data/influencerMockData";
import { useLandingLang } from "@/hooks/useLandingLang";
import {
  LANDING_CONTENT,
  LANDING_LANGS,
  LANG_LABELS,
  LANG_LOCALE,
  LANG_NAMES,
  LANG_TAG,
  type LandingContent,
  type LandingLang,
} from "@/lib/i18n/landingContent";

const SITE_URL = "https://conexai.app";

/** Rota do fluxo de resgate (escolha de plano e blocos). */
const CLAIM_PATH = "/claim";
/** Rota do mural interativo — a raiz "/" agora é só esta landing informativa. */
const MURAL_PATH = "/mural";

/* ────────────────────────────────────────────────────────────────────────
   Animações compartilhadas
   ──────────────────────────────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

/* ────────────────────────────────────────────────────────────────────────
   Página
   ──────────────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const reduced = useReducedMotion();
  const [lang, setLang] = useLandingLang();
  const t = LANDING_CONTENT[lang];

  /**
   * Métricas exibidas na prova social.
   *
   * Derivadas dos dados reais do mural, não escritas à mão: um número
   * inventado na landing que não bate com o que o mural mostra destrói a
   * confiança justamente de quem foi verificar.
   */
  const metrics = useMemo(() => {
    const brands = MOCK_BRANDS.length;
    const blocks = MOCK_BRANDS.reduce((sum, b) => sum + (b.blocks?.length ?? 0), 0);
    const clicks = MOCK_BRANDS.reduce((sum, b) => sum + (b.clicks ?? 0), 0);
    const creators = MOCK_INFLUENCERS.length;
    return { brands, blocks, clicks, creators };
  }, []);

  // ── SEO da rota raiz — atualiza a cada troca de idioma ──
  useEffect(() => {
    document.title = t.meta.title;
    upsertMeta('meta[name="description"]', "name", "description", t.meta.description);
    upsertMeta('meta[property="og:title"]', "property", "og:title", t.meta.title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", t.meta.description);
    upsertMeta('meta[property="og:url"]', "property", "og:url", `${SITE_URL}/`);
    upsertMeta('meta[property="og:type"]', "property", "og:type", "website");
    upsertMeta('meta[property="og:locale"]', "property", "og:locale", LANG_TAG[lang].replace("-", "_"));
    upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", t.meta.title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", t.meta.description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${SITE_URL}/`;
  }, [t, lang]);

  // WebSite + FAQPage no mesmo bloco: o segundo é o que motores de resposta
  // (Google SGE, GPTBot, ClaudeBot, PerplexityBot) mais valorizam — perguntas
  // e respostas prontas, sem precisar raspar a página inteira.
  const jsonLd = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "ConeXai",
        url: SITE_URL,
        description: t.meta.description,
        inLanguage: LANG_TAG[lang],
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/mural?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
        publisher: { "@type": "Organization", name: "ConeXai", url: SITE_URL },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: LANG_TAG[lang],
        mainEntity: t.faq.items.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
    [t, lang]
  );

  return (
    <div className="min-h-[100dvh] bg-[#07070B] text-white antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <TopBar t={t} lang={lang} setLang={setLang} />

      <main>
        <Hero t={t} metrics={metrics} reduced={Boolean(reduced)} locale={LANG_LOCALE[lang]} />
        <HowItWorks t={t} />
        <SocialProof t={t} metrics={metrics} locale={LANG_LOCALE[lang]} />
        <Auction t={t} />
        <Plans t={t} />
        <Creators t={t} creators={metrics.creators} locale={LANG_LOCALE[lang]} />
        <Faq t={t} />
        <Blog t={t} />
        <FinalCta t={t} />
      </main>

      <Footer t={t} lang={lang} setLang={setLang} />
      <FloatingCta t={t} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Seletor de idioma
   ──────────────────────────────────────────────────────────────────────── */

function LangSwitcher({
  lang,
  setLang,
  align = "right",
}: {
  lang: LandingLang;
  setLang: (l: LandingLang) => void;
  align?: "right" | "left";
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change language"
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-white/70 backdrop-blur-md transition-colors hover:text-white"
      >
        <Globe className="h-3.5 w-3.5" />
        {LANG_LABELS[lang]}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Camada invisível para fechar ao clicar fora — mais simples que
                gerenciar listeners de document manualmente. */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
            <motion.ul
              role="listbox"
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className={`absolute top-full z-50 mt-2 min-w-[9rem] overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d13]/95 p-1 shadow-2xl backdrop-blur-xl ${
                align === "right" ? "right-0" : "left-0"
              }`}
            >
              {LANDING_LANGS.map((code) => (
                <li key={code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={lang === code}
                    onClick={() => {
                      setLang(code);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[13px] transition-colors ${
                      lang === code ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <span>{LANG_NAMES[code]}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
                      {LANG_LABELS[code]}
                    </span>
                  </button>
                </li>
              ))}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Topo
   ──────────────────────────────────────────────────────────────────────── */

function TopBar({
  t,
  lang,
  setLang,
}: {
  t: LandingContent;
  lang: LandingLang;
  setLang: (l: LandingLang) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "#how-it-works", label: t.nav.how },
    { href: "#auction", label: t.nav.auction },
    { href: "#pricing", label: t.nav.pricing },
    { href: "#creators", label: t.nav.creators },
    { href: "#faq", label: t.nav.faq },
    { href: "#blog", label: t.nav.blog },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#07070B]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2" aria-label="ConeXai — home">
          <ConeXaiLogo textClassName="font-display text-lg font-black tracking-tight" />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Main navigation">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[13px] text-white/55 transition-colors hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LangSwitcher lang={lang} setLang={setLang} />
          </div>
          <Link
            to={MURAL_PATH}
            className="hidden rounded-full px-4 py-2 text-[13px] font-medium text-white/70 transition-colors hover:text-white md:block"
          >
            {t.nav.viewMural}
          </Link>
          <Link
            to={CLAIM_PATH}
            className="rounded-full bg-white px-4 py-2 text-[13px] font-bold text-[#07070B] transition-transform hover:scale-[1.03] active:scale-95"
          >
            {t.nav.claim}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            className="rounded-full border border-white/10 p-2 text-white/70 lg:hidden"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/[0.06] lg:hidden"
          >
            <nav className="flex flex-col gap-1 px-5 py-4" aria-label="Mobile navigation">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-[14px] text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-2 flex items-center justify-between px-3 sm:hidden">
                <span className="text-[12px] text-white/35">{t.footer.langLabel}</span>
                <LangSwitcher lang={lang} setLang={setLang} align="left" />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Hero — Full-bleed verdadeiro, cubos 3D de ponta a ponta
   ──────────────────────────────────────────────────────────────────────── */

function Hero({
  t,
  metrics,
  reduced,
  locale,
}: {
  t: LandingContent;
  metrics: { brands: number; blocks: number; clicks: number; creators: number };
  reduced: boolean;
  locale: string;
}) {
  return (
    <section
      style={{
        position: "relative",
        width: "100vw",
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        // Puxa qualquer margem/padding do container pai para zero
        marginLeft: "calc(-50vw + 50%)",
        marginRight: "calc(-50vw + 50%)",
      }}
    >
      {/* ── Canvas 3D: cobre rigorosamente 100vw × 100dvh ─────────────────── */}
      <BlockField
        className="absolute inset-0"
        style={{
          position: "absolute",
          top: 0, left: 0,
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />

      {/* ── Camadas de composição ──────────────────────────────────────────── */}

      {/* Vinheta suave: apenas nas bordas, centro aberto para ver os cubos */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: [
            // Borda superior
            "linear-gradient(to bottom, rgba(7,7,11,0.85) 0%, transparent 18%)",
            // Borda inferior
            "linear-gradient(to top, rgba(7,7,11,0.95) 0%, transparent 22%)",
            // Laterais
            "linear-gradient(to right, rgba(7,7,11,0.7) 0%, transparent 12%)",
            "linear-gradient(to left, rgba(7,7,11,0.7) 0%, transparent 12%)",
            // Escurecimento central muito leve para o texto ser legível
            "radial-gradient(ellipse 60% 55% at 50% 50%, rgba(7,7,11,0.55) 0%, transparent 100%)",
          ].join(", "),
        }}
      />

      {/* Auras de cor neon: violeta topo, esmeralda baixo, dourado canto */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: [
            "radial-gradient(ellipse 90% 45% at 50% 0%, rgba(124,58,237,0.28) 0%, transparent 60%)",
            "radial-gradient(ellipse 80% 40% at 50% 100%, rgba(16,185,129,0.20) 0%, transparent 60%)",
            "radial-gradient(ellipse 45% 35% at 85% 20%, rgba(240,193,75,0.16) 0%, transparent 55%)",
            "radial-gradient(ellipse 40% 30% at 15% 80%, rgba(192,38,211,0.14) 0%, transparent 55%)",
          ].join(", "),
        }}
      />

      {/* Scanline animada */}
      {!reduced && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute", left: 0, right: 0, height: 1, pointerEvents: "none",
            background: "linear-gradient(90deg, transparent 0%, #a855f7 25%, #f0c14b 50%, #10b981 75%, transparent 100%)",
            opacity: 0.28,
            animation: "scanline 7s linear infinite",
          }}
        />
      )}

      {/* ── Conteúdo textual flutuante ─────────────────────────────────────── */}
      <motion.div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: 900,
          padding: "6rem 1.5rem 5rem",
          textAlign: "center",
          // Separado do max-w do layout pai — aqui é o conteúdo, não o canvas
        }}
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Badge "ao vivo" */}
        <motion.div variants={fadeUp} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              borderRadius: 9999,
              padding: "6px 14px",
              border: "1px solid rgba(168,85,247,0.35)",
              background: "rgba(124,58,237,0.10)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 0 24px rgba(168,85,247,0.14), inset 0 0 16px rgba(168,85,247,0.05)",
            }}
          >
            <span style={{ position: "relative", display: "flex", width: 6, height: 6 }}>
              <span
                className="animate-ping"
                style={{
                  position: "absolute", inset: 0,
                  borderRadius: "50%", backgroundColor: "#34d399", opacity: 0.75,
                }}
              />
              <span style={{ borderRadius: "50%", width: 6, height: 6, backgroundColor: "#34d399" }} />
            </span>
            <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>
              {t.hero.badge(metrics.blocks)}
            </span>
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={fadeUp}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{
            marginTop: 28,
            fontFamily: "'Space Grotesk', 'Plus Jakarta Sans', sans-serif",
            fontSize: "clamp(2.4rem, 7.5vw, 5.8rem)",
            fontWeight: 900,
            lineHeight: 0.93,
            letterSpacing: "-0.03em",
            textShadow: "0 0 60px rgba(168,85,247,0.2), 0 4px 32px rgba(0,0,0,0.6)",
          }}
        >
          {t.hero.title1}
          <br />
          <span
            style={{
              backgroundImage: "linear-gradient(105deg, #a855f7 0%, #d8b4fe 28%, #f0c14b 58%, #34d399 88%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 24px rgba(168,85,247,0.45))",
            }}
          >
            {t.hero.titleAccent}
          </span>{" "}
          {t.hero.title2}
        </motion.h1>

        {/* Subtítulo */}
        <motion.p
          variants={fadeUp}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{
            margin: "24px auto 0",
            maxWidth: 640,
            fontSize: "clamp(15px, 1.6vw, 18px)",
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.62)",
            textShadow: "0 2px 16px rgba(0,0,0,0.5)",
          }}
        >
          {t.hero.subtitle}
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginTop: 40, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}
        >
          <Link
            to={CLAIM_PATH}
            className="group"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              borderRadius: 16,
              background: "#ffffff",
              padding: "16px 28px",
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 15, fontWeight: 700,
              color: "#07070B",
              boxShadow: "0 20px 60px -10px rgba(255,255,255,0.3), 0 0 40px rgba(168,85,247,0.3)",
              transition: "transform 0.15s, box-shadow 0.15s",
              textDecoration: "none",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.03)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
          >
            <Sparkles style={{ width: 16, height: 16 }} />
            {t.hero.ctaPrimary}
            <span style={{
              borderRadius: 9999, background: "rgba(7,7,11,0.1)",
              padding: "2px 8px", fontSize: 11, fontWeight: 700,
            }}>
              {t.hero.ctaPrimaryBadge}
            </span>
            <ArrowRight style={{ width: 16, height: 16, transition: "transform 0.15s" }} />
          </Link>

          <Link
            to={MURAL_PATH}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              borderRadius: 16,
              border: "1px solid rgba(168,85,247,0.3)",
              background: "rgba(124,58,237,0.08)",
              backdropFilter: "blur(12px)",
              padding: "16px 28px",
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 15, fontWeight: 700,
              color: "#ffffff",
              transition: "background 0.15s, border-color 0.15s",
              textDecoration: "none",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "rgba(124,58,237,0.18)";
              el.style.borderColor = "rgba(168,85,247,0.5)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "rgba(124,58,237,0.08)";
              el.style.borderColor = "rgba(168,85,247,0.3)";
            }}
          >
            <Layers style={{ width: 16, height: 16 }} />
            {t.hero.ctaSecondary}
          </Link>
        </motion.div>

        {/* Nota */}
        <motion.p
          variants={fadeUp}
          transition={{ duration: 0.7 }}
          style={{ marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.28)" }}
        >
          {t.hero.note}
        </motion.p>
      </motion.div>

      {/* Scroll indicator */}
      {!reduced && (
        <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }}>
          <motion.div
            animate={{ y: [0, 9, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 20, height: 36, borderRadius: 10,
              border: "1px solid rgba(168,85,247,0.35)",
              boxShadow: "0 0 14px rgba(168,85,247,0.22)",
              display: "flex", justifyContent: "center", paddingTop: 6,
            }}
          >
            <div style={{ width: 2, height: 6, borderRadius: 2, background: "rgba(168,85,247,0.7)" }} />
          </motion.div>
        </div>
      )}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Como funciona
   ──────────────────────────────────────────────────────────────────────── */

const STEP_META = [
  { icon: Gavel, accent: "#a855f7" },
  { icon: Upload, accent: "#f0c14b" },
  { icon: Bot, accent: "#10b981" },
] as const;

function HowItWorks({ t }: { t: LandingContent }) {
  return (
    <Section id="how-it-works" eyebrow={t.how.eyebrow} title={t.how.title}>
      <motion.ol
        className="grid gap-4 md:grid-cols-3"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
      >
        {t.how.steps.map((step, i) => {
          const { icon: Icon, accent } = STEP_META[i];
          return (
            <motion.li
              key={step.title}
              variants={fadeUp}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-7 transition-colors hover:border-white/20"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background: `radial-gradient(120% 80% at 50% 0%, ${accent}18, transparent 70%)`,
                }}
              />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span
                    className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10"
                    style={{ background: `${accent}1a`, color: accent }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.2em] text-white/20">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-bold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-white/50">{step.body}</p>
              </div>
            </motion.li>
          );
        })}
      </motion.ol>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Prova social
   ──────────────────────────────────────────────────────────────────────── */

function SocialProof({
  t,
  metrics,
  locale,
}: {
  t: LandingContent;
  metrics: { brands: number; blocks: number; clicks: number; creators: number };
  locale: string;
}) {
  const stats = [
    { label: t.stats.brands, value: metrics.brands, icon: Layers },
    { label: t.stats.blocks, value: metrics.blocks, icon: Star },
    { label: t.stats.clicks, value: metrics.clicks, icon: MousePointerClick },
    { label: t.stats.creators, value: metrics.creators, icon: Sparkles },
  ];

  return (
    <section className="border-y border-white/[0.06] bg-white/[0.015]">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 sm:px-8 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="px-4 py-10 text-center sm:py-12">
            <Icon className="mx-auto h-4 w-4 text-white/25" />
            <p className="mt-3 font-display text-[clamp(1.75rem,4vw,2.75rem)] font-black tabular-nums tracking-tight">
              {value.toLocaleString(locale)}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
              {label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Leilão
   ──────────────────────────────────────────────────────────────────────── */

function Auction({ t }: { t: LandingContent }) {
  return (
    <Section id="auction" eyebrow={t.auction.eyebrow} title={t.auction.title}>
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-5"
        >
          <p className="text-[15px] leading-relaxed text-white/55">{t.auction.body}</p>

          <ul className="space-y-3">
            {t.auction.bullets.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[14px] text-white/70">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {item}
              </li>
            ))}
          </ul>

          <Link
            to={MURAL_PATH}
            className="inline-flex items-center gap-2 pt-2 font-display text-[14px] font-bold text-white transition-colors hover:text-emerald-300"
          >
            {t.auction.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-7"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(90% 60% at 50% 0%, rgba(168,85,247,0.16), transparent 70%)",
            }}
          />
          <div className="relative">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
              {t.auction.exampleLabel}
            </p>

            <div className="mt-5 space-y-3">
              <Row label={t.auction.occupantPaid} value={formatUsd(24.99)} />
              <Row label={t.auction.minOffer(MIN_BID_MULTIPLIER)} value={formatUsd(125)} accent="#a855f7" />
              <div className="h-px bg-white/10" />
              <Row label={t.auction.youPay} value={formatUsd(125)} strong />
              <Row label={t.auction.ownerReceives} value={formatUsd(87.5)} accent="#10b981" />
            </div>

            <p className="mt-5 text-[11px] leading-relaxed text-white/30">{t.auction.note}</p>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}

function Row({
  label,
  value,
  accent,
  strong,
}: {
  label: string;
  value: string;
  accent?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-white/50">{label}</span>
      <span
        className={`font-mono tabular-nums ${strong ? "text-[19px] font-medium" : "text-[15px]"}`}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Planos
   ──────────────────────────────────────────────────────────────────────── */

function Plans({ t }: { t: LandingContent }) {
  return (
    <Section id="pricing" eyebrow={t.plans.eyebrow} title={t.plans.title}>
      <div className="grid gap-4 lg:grid-cols-3">
        {BLOCK_REGIONS.map((region, i) => (
          <PlanCard key={region} t={t} plan={PLANS[region]} highlighted={i === 1} />
        ))}
      </div>

      <p className="mt-6 text-center text-[12px] text-white/30">{t.plans.footnote}</p>
    </Section>
  );
}

function tierFeature(t: LandingContent, region: BlockRegion): string {
  if (region === "centro_premium") return t.plans.featuresTierExtra.premium;
  if (region === "intermediaria") return t.plans.featuresTierExtra.standard;
  return t.plans.featuresTierExtra.basic;
}

function PlanCard({
  t,
  plan,
  highlighted,
}: {
  t: LandingContent;
  plan: PlanDefinition;
  highlighted: boolean;
}) {
  const min = computeCost(plan.region, plan.minBlocks);
  const max = computeCost(plan.region, plan.maxBlocks);

  const features = [t.plans.articles(plan.articlesPerMonth), ...t.plans.featuresCommon, tierFeature(t, plan.region)];

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      transition={{ duration: 0.55 }}
      className={`relative overflow-hidden rounded-3xl border p-7 ${
        highlighted
          ? "border-purple-400/30 bg-gradient-to-b from-purple-500/[0.09] to-transparent"
          : "border-white/[0.08] bg-white/[0.02]"
      }`}
    >
      {highlighted && (
        <span className="absolute right-6 top-6 rounded-full bg-purple-500/20 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-purple-200">
          {t.plans.mostChosen}
        </span>
      )}

      <h3 className="font-display text-xl font-bold tracking-tight">{plan.name}</h3>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/35">
        {plan.zoneLabel} · {plan.minBlocks}–{plan.maxBlocks} {t.plans.rangeSuffix}
      </p>

      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-black tracking-tight">
          {formatUsd(plan.baseMonthlyUsd)}
        </span>
        <span className="text-[13px] text-white/40">{t.plans.perMonthBase}</span>
      </div>
      <p className="mt-1.5 text-[13px] text-white/50">
        + <span className="font-semibold text-white">{formatUsd(plan.perBlockMonthlyUsd)}</span>{" "}
        {t.plans.perBlock}
      </p>
      <p className="mt-2 font-mono text-[11px] text-white/30">
        {formatUsd(min.monthly)} {t.plans.monthlyRange} {formatUsd(max.monthly)}
      </p>

      <ul className="mt-6 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-[13px] text-white/60">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            {feature}
          </li>
        ))}
      </ul>

      <Link
        to={CLAIM_PATH}
        className={`mt-7 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-display text-[14px] font-bold transition-transform hover:scale-[1.02] active:scale-[0.98] ${
          highlighted
            ? "bg-white text-[#07070B]"
            : "border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.09]"
        }`}
      >
        {t.plans.choose} {plan.name}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Criadores
   ──────────────────────────────────────────────────────────────────────── */

const CREATOR_ICONS = [Sparkles, TrendingUp, Bot] as const;

function Creators({ t, creators, locale }: { t: LandingContent; creators: number; locale: string }) {
  return (
    <Section id="creators" eyebrow={t.creators.eyebrow} title={t.creators.title}>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-5"
        >
          <p className="text-[15px] leading-relaxed text-white/55">{t.creators.body}</p>

          <div className="grid gap-3 sm:grid-cols-3">
            {t.creators.cards.map((card, i) => {
              const Icon = CREATOR_ICONS[i];
              return (
                <div key={card.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <Icon className="h-4 w-4 text-purple-300" />
                  <p className="mt-2.5 font-display text-[13px] font-bold">{card.label}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/45">{card.body}</p>
                </div>
              );
            })}
          </div>

          <Link
            to="/influencers"
            className="inline-flex items-center gap-2 pt-1 font-display text-[14px] font-bold text-white transition-colors hover:text-purple-300"
          >
            {t.creators.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 p-8 text-center"
          style={{
            background: "radial-gradient(90% 70% at 50% 0%, rgba(168,85,247,0.16), rgba(255,255,255,0.02) 70%)",
          }}
        >
          <p className="font-display text-[clamp(2.5rem,6vw,4rem)] font-black tabular-nums tracking-tight">
            {creators.toLocaleString(locale)}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            {t.creators.statLabel}
          </p>
          <Link
            to="/auth"
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-display text-[14px] font-bold text-[#07070B] transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {t.creators.ctaBecome}
          </Link>
        </motion.div>
      </div>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   FAQ
   ──────────────────────────────────────────────────────────────────────── */

function Faq({ t }: { t: LandingContent }) {
  return (
    <Section id="faq" eyebrow={t.faq.eyebrow} title={t.faq.title}>
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-3xl rounded-3xl border border-white/[0.08] bg-white/[0.02] px-6 sm:px-8"
      >
        <Accordion type="single" collapsible className="w-full">
          {t.faq.items.map((item, i) => (
            <AccordionItem key={item.q} value={`item-${i}`} className="border-white/[0.08]">
              <AccordionTrigger className="py-5 text-left font-display text-[15px] font-bold tracking-tight text-white hover:no-underline [&>svg]:text-white/40">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-[14px] leading-relaxed text-white/55">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.div>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Blog / trechos AEO
   ──────────────────────────────────────────────────────────────────────── */

function Blog({ t }: { t: LandingContent }) {
  return (
    <Section id="blog" eyebrow={t.blog.eyebrow} title={t.blog.title}>
      <motion.p
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="-mt-6 mb-10 max-w-2xl text-[14px] leading-relaxed text-white/50"
      >
        {t.blog.subtitle}
      </motion.p>

      <motion.div
        className="grid gap-4 md:grid-cols-3"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
      >
        {t.blog.posts.map((post) => (
          <motion.article
            key={post.title}
            variants={fadeUp}
            transition={{ duration: 0.55 }}
            className="group flex flex-col rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 transition-colors hover:border-white/20"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
                <Newspaper className="h-3 w-3" />
                {post.tag}
              </span>
              <ArrowUpRight className="h-4 w-4 text-white/20 transition-colors group-hover:text-white/60" />
            </div>
            <h3 className="mt-4 font-display text-[15px] font-bold leading-snug tracking-tight">
              {post.title}
            </h3>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-white/50">{post.excerpt}</p>
            <Link
              to="/guia"
              className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-bold text-white/70 transition-colors group-hover:text-white"
            >
              {t.blog.readMore}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.article>
        ))}
      </motion.div>

      <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-white/25">
        {t.blog.aeoNote}
      </p>
    </Section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   CTA final e rodapé
   ──────────────────────────────────────────────────────────────────────── */

function FinalCta({ t }: { t: LandingContent }) {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] px-5 py-28 sm:px-8">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 80% at 50% 100%, rgba(168,85,247,0.18), transparent 70%), radial-gradient(50% 60% at 50% 0%, rgba(16,185,129,0.10), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] font-black leading-[1.05] tracking-[-0.03em]">
          {t.finalCta.title1}
          <br />
          {t.finalCta.title2}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-white/50">
          {t.finalCta.body(MIN_BID_MULTIPLIER)}
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to={CLAIM_PATH}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 font-display text-[15px] font-bold text-[#07070B] shadow-[0_20px_60px_-15px_rgba(255,255,255,0.35)] transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
          >
            {t.finalCta.ctaPrimary}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to={MURAL_PATH}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 px-8 py-4 font-display text-[15px] font-bold text-white transition-colors hover:bg-white/[0.06] sm:w-auto"
          >
            {t.finalCta.ctaSecondary}
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer({
  t,
  lang,
  setLang,
}: {
  t: LandingContent;
  lang: LandingLang;
  setLang: (l: LandingLang) => void;
}) {
  return (
    <footer className="border-t border-white/[0.06] px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <ConeXaiLogo textClassName="font-display text-base font-black tracking-tight" />
            <p className="max-w-xs text-center text-[12px] text-white/35 sm:text-left">{t.footer.tagline}</p>
          </div>

          <nav
            className="flex flex-wrap items-center justify-center gap-6"
            aria-label={t.footer.sitemapLabel}
          >
            <Link to={MURAL_PATH} className="text-[13px] text-white/45 transition-colors hover:text-white">
              {t.footer.links.mural}
            </Link>
            <Link to="/influencers" className="text-[13px] text-white/45 transition-colors hover:text-white">
              {t.footer.links.creators}
            </Link>
            <Link to="/precos" className="text-[13px] text-white/45 transition-colors hover:text-white">
              {t.footer.links.pricing}
            </Link>
            <Link to="/ranking" className="text-[13px] text-white/45 transition-colors hover:text-white">
              {t.footer.links.ranking}
            </Link>
            <Link to="/guia" className="text-[13px] text-white/45 transition-colors hover:text-white">
              {t.footer.links.guide}
            </Link>
            <Link to="/termos" className="text-[13px] text-white/45 transition-colors hover:text-white">
              {t.footer.links.terms}
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-[12px] text-white/30 sm:inline">{t.footer.langLabel}</span>
            <LangSwitcher lang={lang} setLang={setLang} align="right" />
          </div>
        </div>

        <p className="mt-8 text-center font-mono text-[11px] text-white/25">
          © {new Date().getFullYear()} ConeXai
        </p>
      </div>
    </footer>
  );
}

/**
 * CTA flutuante para mobile.
 *
 * Some acima de `sm` porque no desktop o CTA do topo permanece visível — um
 * botão fixo ali só cobriria conteúdo sem ganho de conversão.
 */
function FloatingCta({ t }: { t: LandingContent }) {
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 sm:hidden">
      <Link
        to={CLAIM_PATH}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 font-display text-[15px] font-bold text-[#07070B] shadow-[0_16px_40px_-10px_rgba(0,0,0,0.8)]"
      >
        <Sparkles className="h-4 w-4" />
        {t.floating}
      </Link>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Utilitários
   ──────────────────────────────────────────────────────────────────────── */

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12 max-w-2xl"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">{eyebrow}</p>
          <h2 className="mt-3 font-display text-[clamp(1.75rem,4vw,3rem)] font-black leading-[1.05] tracking-[-0.03em]">
            {title}
          </h2>
        </motion.div>
        {children}
      </div>
    </section>
  );
}

function upsertMeta(
  selector: string,
  attr: "name" | "property",
  key: string,
  content: string
): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
