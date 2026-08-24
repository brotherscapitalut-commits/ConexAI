// ─────────────────────────────────────────────────────────────────────────
// Conteúdo multilíngue da Landing Page (raiz "/").
//
// ── Por que um dicionário centralizado, e não react-i18next ──
// A página tem ~10 seções e nenhuma outra rota do produto precisa de
// tradução — só esta. Trazer uma lib de i18n completa (namespaces, loaders
// assíncronos, plugin de detecção) para traduzir uma única página é peso
// morto no bundle. Um objeto tipado por idioma dá autocomplete, um único
// lugar para revisar copy, e o TypeScript denuncia qualquer chave faltando
// num idioma — o mesmo problema que uma lib resolveria, sem a dependência.
//
// Inglês é o idioma PADRÃO (mercado global); Português e Espanhol são
// detectados a partir de `navigator.language` em `useLandingLang`.
// ─────────────────────────────────────────────────────────────────────────

export type LandingLang = "en" | "pt" | "es";

export const LANDING_LANGS: LandingLang[] = ["en", "pt", "es"];

export const LANG_LABELS: Record<LandingLang, string> = {
  en: "EN",
  pt: "PT",
  es: "ES",
};

export const LANG_NAMES: Record<LandingLang, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
};

/** Locale do `Intl`/`toLocaleString`, usado para formatar números por idioma. */
export const LANG_LOCALE: Record<LandingLang, string> = {
  en: "en-US",
  pt: "pt-BR",
  es: "es-ES",
};

/** Código IETF para `<html lang>`, `og:locale` e o `inLanguage` do JSON-LD. */
export const LANG_TAG: Record<LandingLang, string> = {
  en: "en-US",
  pt: "pt-BR",
  es: "es-ES",
};

interface Step {
  title: string;
  body: string;
}

interface FaqItem {
  q: string;
  a: string;
}

interface BlogPost {
  tag: string;
  title: string;
  excerpt: string;
}

export interface LandingContent {
  meta: { title: string; description: string };
  nav: {
    how: string;
    auction: string;
    pricing: string;
    creators: string;
    faq: string;
    blog: string;
    viewMural: string;
    claim: string;
  };
  hero: {
    badge: (blocks: number) => string;
    title1: string;
    titleAccent: string;
    title2: string;
    subtitle: string;
    ctaPrimary: string;
    ctaPrimaryBadge: string;
    ctaSecondary: string;
    note: string;
  };
  stats: { brands: string; blocks: string; clicks: string; creators: string };
  how: { eyebrow: string; title: string; steps: [Step, Step, Step] };
  auction: {
    eyebrow: string;
    title: string;
    body: string;
    bullets: string[];
    cta: string;
    exampleLabel: string;
    occupantPaid: string;
    minOffer: (m: number) => string;
    youPay: string;
    ownerReceives: string;
    note: string;
  };
  plans: {
    eyebrow: string;
    title: string;
    perMonthBase: string;
    perBlock: string;
    rangeSuffix: string;
    monthlyRange: string;
    footnote: string;
    mostChosen: string;
    choose: string;
    featuresCommon: [string, string];
    featuresTierExtra: { basic: string; standard: string; premium: string };
    articles: (n: number) => string;
  };
  creators: {
    eyebrow: string;
    title: string;
    body: string;
    cards: [
      { label: string; body: string },
      { label: string; body: string },
      { label: string; body: string },
    ];
    cta: string;
    statLabel: string;
    ctaBecome: string;
  };
  faq: { eyebrow: string; title: string; items: FaqItem[] };
  blog: { eyebrow: string; title: string; subtitle: string; posts: [BlogPost, BlogPost, BlogPost]; aeoNote: string; readMore: string };
  finalCta: { title1: string; title2: string; body: (m: number) => string; ctaPrimary: string; ctaSecondary: string };
  footer: {
    tagline: string;
    sitemapLabel: string;
    links: { mural: string; creators: string; pricing: string; ranking: string; guide: string; terms: string };
    langLabel: string;
  };
  floating: string;
}

const en: LandingContent = {
  meta: {
    title: "ConeXai — Permanent Brand Territory, Powered by AI Agents",
    description:
      "Claim a permanent block on the internet's most contested brand mural, defend it in live takeover auctions, and get traffic driven by autonomous AI agents. 7 days free.",
  },
  nav: {
    how: "How it works",
    auction: "Live auction",
    pricing: "Pricing",
    creators: "Creators",
    faq: "FAQ",
    blog: "Blog",
    viewMural: "Explore live mural",
    claim: "Claim your block",
  },
  hero: {
    badge: (blocks) => `live takeover market · ${blocks.toLocaleString("en-US")} blocks occupied`,
    title1: "Permanent brand territory,",
    titleAccent: "defended",
    title2: "in real time",
    subtitle:
      "Every block is permanent real estate for your brand on the ConeXai mural. Claim yours, defend it when someone else bids for the spot, and let autonomous AI agents drive qualified traffic to it while you sleep.",
    ctaPrimary: "Claim my block",
    ctaPrimaryBadge: "7 days free",
    ctaSecondary: "Explore the live mural",
    note: "No card required to start · Cancel anytime",
  },
  stats: {
    brands: "active brands",
    blocks: "blocks occupied",
    clicks: "clicks driven",
    creators: "creators indexed",
  },
  how: {
    eyebrow: "How it works",
    title: "Three steps to your territory",
    steps: [
      {
        title: "Claim or take over",
        body: "Pick free blocks on the mural, or outbid whoever already holds a position. The more central the zone, the higher the visibility — and the fiercer the competition.",
      },
      {
        title: "Publish instantly",
        body: "Upload your logo, set your destination link and description. Your brand goes live on the mural immediately, and you can edit it anytime.",
      },
      {
        title: "AI-driven traffic",
        body: "Autonomous AI agents write content, prospect leads, and route visitors straight to the mural. Every click on your block lands directly on your site.",
      },
    ],
  },
  auction: {
    eyebrow: "Live marketplace & takeover engine",
    title: "The mural doesn't have infinite inventory",
    body:
      "Once the center fills up, the only way in is convincing someone already there to sell. Any advertiser can bid on another brand's position — and the owner decides whether to accept.",
    bullets: [
      "Minimum bid is 5× what the current occupant paid",
      "A block only changes hands with the owner's explicit acceptance",
      "Funds are held in escrow and refunded in full if the offer is declined",
      "Sellers keep 70% of the accepted bid, paid directly to their wallet",
    ],
    cta: "See positions in dispute",
    exampleLabel: "sample takeover",
    occupantPaid: "Current occupant paid",
    minOffer: (m) => `Minimum offer (${m}×)`,
    youPay: "You pay",
    ownerReceives: "Owner receives (70%)",
    note: "The platform keeps 30% of every brokered transaction, per the Terms of Service.",
  },
  plans: {
    eyebrow: "Pricing",
    title: "The more central, the greater the reach",
    perMonthBase: "/mo base",
    perBlock: "per block",
    rangeSuffix: "blocks",
    monthlyRange: "to",
    footnote: "Recurring monthly subscription · No commitment · Cancel anytime",
    mostChosen: "most chosen",
    choose: "Choose",
    featuresCommon: ["Real-time click tracking", "Editable logo, link and description"],
    featuresTierExtra: {
      basic: "Dashboard with reach metrics",
      standard: "Featured badge in search",
      premium: "Premium badge, special animation and priority support",
    },
    articles: (n) => `${n} institutional article${n > 1 ? "s" : ""} per month`,
  },
  creators: {
    eyebrow: "For creators",
    title: "Become an ambassador and earn on every conversion",
    body:
      "Creators join the public ConeXai index, get discovered by brands looking for partners, and earn a recurring commission on every company they bring to the mural.",
    cards: [
      { label: "Public profile", body: "Reach and engagement visible to brands" },
      { label: "Recurring commission", body: "You earn for as long as the referred brand stays subscribed" },
      { label: "Ready-made assets", body: "AI-generated campaign copy tailored to your audience" },
    ],
    cta: "Browse the creator index",
    statLabel: "creators already indexed",
    ctaBecome: "Become an ambassador",
  },
  faq: {
    eyebrow: "FAQ",
    title: "Everything you need to know before you claim a block",
    items: [
      {
        q: "Do I actually own the block, or is it a lease?",
        a: "A block is a recurring subscription, not a title deed — think of it as permanent shelf space you keep as long as your subscription is active. As long as you stay subscribed and no one wins a takeover auction against you, the position is yours indefinitely, with no forced expiration date.",
      },
      {
        q: "What happens when my plan renews?",
        a: "Your subscription renews automatically every month at the price locked in for your block count and zone. If you add blocks, the new blocks are billed from the day you claim them, prorated for the first cycle.",
      },
      {
        q: "How exactly does a takeover auction work?",
        a: "Any advertiser can bid on a position that's already occupied. The minimum bid is 5× what the current occupant paid for it. You, as the owner, choose whether to accept — there's no forced sale. If you decline, the bidder's funds are returned in full.",
      },
      {
        q: "How do payments and the trial period work?",
        a: "Checkout runs entirely through Stripe: your card is only charged after a 7-day free trial, and you can cancel before it ends without being billed. All prices are calculated server-side from the official price table — the amount you see is exactly what Stripe charges.",
      },
      {
        q: "Can I move to a bigger zone later?",
        a: "Yes. You can upgrade from Basic to Standard or Premium at any time; the new plan's base fee and per-block rate apply from your next billing cycle, and you keep your existing blocks unless a takeover changes them.",
      },
      {
        q: "What happens if I cancel?",
        a: "Cancelling stops future renewals — there's no long-term contract. Your blocks remain live until the end of the current billing period, after which they return to the free pool and can be claimed by someone else.",
      },
    ],
  },
  blog: {
    eyebrow: "Blog & AI answer engine snippets",
    title: "Institutional articles, written by AI agents",
    subtitle:
      "Structured content our AI agents publish weekly — indexed for search engines and answer engines like GPTBot, ClaudeBot and PerplexityBot, so brands on the mural get found in both.",
    posts: [
      {
        tag: "Guide",
        title: "How takeover auctions actually redistribute mural territory",
        excerpt:
          "A breakdown of the 5× minimum bid rule, the 70/30 revenue split, and why scarcity drives real advertiser demand instead of vanity metrics.",
      },
      {
        tag: "Playbook",
        title: "Turning a $9.99 block into measurable, trackable traffic",
        excerpt:
          "What the click-tracking dashboard shows, how AI agents route visitors to your block, and which zone fits which growth stage.",
      },
      {
        tag: "Program",
        title: "The creator ambassador program, explained end to end",
        excerpt:
          "How the public creator index works, what brands look for when choosing a partner, and how recurring commissions are calculated.",
      },
    ],
    aeoNote: "Optimized for AI answer engines — read directly by GPTBot, ClaudeBot and PerplexityBot.",
    readMore: "Read more",
  },
  finalCta: {
    title1: "The best blocks",
    title2: "get claimed first",
    body: (m) => `Start with 7 days free. If someone wants your spot later, they'll have to pay ${m}× what you paid — and you decide whether to sell.`,
    ctaPrimary: "Claim my block",
    ctaSecondary: "Explore the mural",
  },
  footer: {
    tagline: "Permanent brand territory on the internet's most contested mural.",
    sitemapLabel: "Sitemap",
    links: { mural: "Mural", creators: "Creators", pricing: "Pricing", ranking: "Ranking", guide: "Guide", terms: "Terms & Privacy" },
    langLabel: "Language",
  },
  floating: "Claim my block — 7 days free",
};

const pt: LandingContent = {
  meta: {
    title: "ConeXai — Território permanente de marcas, impulsionado por agentes de IA",
    description:
      "Resgate seu bloco no mural interativo, dispute posições em leilão e receba tráfego direcionado por agentes de IA. 7 dias grátis para começar.",
  },
  nav: {
    how: "Como funciona",
    auction: "Leilão ao vivo",
    pricing: "Planos",
    creators: "Criadores",
    faq: "Perguntas frequentes",
    blog: "Blog",
    viewMural: "Ver o mural ao vivo",
    claim: "Resgatar bloco",
  },
  hero: {
    badge: (blocks) => `disputa ao vivo · ${blocks.toLocaleString("pt-BR")} blocos ocupados`,
    title1: "Território permanente de marcas,",
    titleAccent: "defendido",
    title2: "em tempo real",
    subtitle:
      "Cada bloco é um território permanente da sua marca no mural ConeXai. Resgate o seu, defenda de quem quiser tomá-lo em leilão, e deixe agentes de IA autônomos trazerem tráfego qualificado enquanto você dorme.",
    ctaPrimary: "Resgatar meu bloco",
    ctaPrimaryBadge: "7 dias grátis",
    ctaSecondary: "Explorar o mural ao vivo",
    note: "Sem cartão para começar · Cancele quando quiser",
  },
  stats: {
    brands: "marcas ativas",
    blocks: "blocos ocupados",
    clicks: "cliques direcionados",
    creators: "criadores no índice",
  },
  how: {
    eyebrow: "Como funciona",
    title: "Três passos até o seu território",
    steps: [
      {
        title: "Resgate ou conquiste",
        body: "Escolha blocos livres no mural, ou dispute em leilão a posição de quem já está lá. Quanto mais central a área, maior a visibilidade — e a disputa.",
      },
      {
        title: "Publique sua marca",
        body: "Suba seu logo, defina o link de destino e a descrição. Sua marca aparece no mural na mesma hora, e você edita quando quiser.",
      },
      {
        title: "Receba tráfego",
        body: "Agentes de IA autônomos produzem conteúdo, prospectam e direcionam visitantes para o mural. Cada clique no seu bloco vai direto para o seu site.",
      },
    ],
  },
  auction: {
    eyebrow: "Mercado de posições ao vivo",
    title: "O mural não tem estoque infinito",
    body:
      "Quando o centro lota, a única forma de entrar é convencer quem já está lá. Qualquer anunciante pode ofertar pela posição de outro — e o dono decide se aceita.",
    bullets: [
      "A oferta mínima é 5× o valor que o ocupante pagou",
      "O bloco só muda de mãos com aceite expresso do proprietário",
      "Os valores ficam em custódia e voltam integralmente se a oferta for recusada",
      "Quem vende recebe 70% do valor ofertado, direto na carteira",
    ],
    cta: "Ver posições em disputa",
    exampleLabel: "exemplo de takeover",
    occupantPaid: "Ocupante pagou",
    minOffer: (m) => `Oferta mínima (${m}×)`,
    youPay: "Você paga",
    ownerReceives: "O dono recebe (70%)",
    note: "A plataforma retém 30% de cada negociação intermediada, conforme os Termos de Uso.",
  },
  plans: {
    eyebrow: "Planos",
    title: "Quanto mais central, maior o domínio",
    perMonthBase: "/mês base",
    perBlock: "por bloco",
    rangeSuffix: "blocos",
    monthlyRange: "a",
    footnote: "Assinatura mensal recorrente · Sem fidelidade · Cancele quando quiser",
    mostChosen: "mais escolhido",
    choose: "Escolher",
    featuresCommon: ["Rastreamento de cliques em tempo real", "Logo, link e descrição editáveis"],
    featuresTierExtra: {
      basic: "Dashboard com métricas de alcance",
      standard: "Badge de destaque na busca",
      premium: "Badge Premium, animação especial e suporte prioritário",
    },
    articles: (n) => `${n} artigo${n > 1 ? "s" : ""} institucional${n > 1 ? "is" : ""} por mês`,
  },
  creators: {
    eyebrow: "Para criadores",
    title: "Vire embaixador e lucre por conversão",
    body:
      "Criadores entram no índice público do ConeXai, aparecem para marcas que procuram parceria e ganham comissão sobre cada empresa que trouxerem para o mural.",
    cards: [
      { label: "Perfil no índice", body: "Alcance e engajamento visíveis para as marcas" },
      { label: "Comissão recorrente", body: "Você ganha enquanto a marca indicada assinar" },
      { label: "Material pronto", body: "Copy de campanha gerada por IA sob medida" },
    ],
    cta: "Ver o índice de criadores",
    statLabel: "criadores já no índice",
    ctaBecome: "Quero ser embaixador",
  },
  faq: {
    eyebrow: "Perguntas frequentes",
    title: "Tudo que você precisa saber antes de resgatar um bloco",
    items: [
      {
        q: "Eu sou dono do bloco de verdade, ou é um aluguel?",
        a: "O bloco é uma assinatura recorrente, não uma escritura — pense nele como um espaço permanente que você mantém enquanto a assinatura estiver ativa. Enquanto você continuar pagando e ninguém vencer um leilão de takeover contra você, a posição é sua indefinidamente, sem data de expiração forçada.",
      },
      {
        q: "O que acontece quando meu plano renova?",
        a: "Sua assinatura renova automaticamente todo mês, pelo preço travado para a quantidade de blocos e a zona escolhida. Se você adicionar blocos, os novos são cobrados a partir do dia do resgate, proporcional ao primeiro ciclo.",
      },
      {
        q: "Como funciona exatamente o leilão de takeover?",
        a: "Qualquer anunciante pode ofertar por uma posição já ocupada. A oferta mínima é 5× o que o ocupante atual pagou. Você, como dono, decide se aceita — não existe venda forçada. Se recusar, o valor da oferta volta integralmente para quem ofertou.",
      },
      {
        q: "Como funcionam os pagamentos e o período de teste?",
        a: "O checkout roda inteiramente pelo Stripe: seu cartão só é cobrado depois de 7 dias de teste grátis, e você pode cancelar antes do fim sem ser cobrado. Todos os preços são calculados no servidor a partir da tabela oficial — o valor que você vê é exatamente o que o Stripe cobra.",
      },
      {
        q: "Posso mudar para uma zona maior depois?",
        a: "Sim. Você pode fazer upgrade do Basic para o Standard ou Premium a qualquer momento; a nova base e a taxa por bloco valem a partir do próximo ciclo de cobrança, e você mantém os blocos que já tem, a menos que um takeover os altere.",
      },
      {
        q: "O que acontece se eu cancelar?",
        a: "Cancelar interrompe as próximas renovações — não existe fidelidade. Seus blocos continuam ativos até o fim do ciclo já pago; depois disso, voltam ao estoque livre e podem ser resgatados por outra pessoa.",
      },
    ],
  },
  blog: {
    eyebrow: "Blog e trechos para motores de resposta por IA",
    title: "Artigos institucionais, escritos por agentes de IA",
    subtitle:
      "Conteúdo estruturado que nossos agentes de IA publicam semanalmente — indexado para buscadores e motores de resposta como GPTBot, ClaudeBot e PerplexityBot, para que as marcas do mural sejam encontradas nos dois.",
    posts: [
      {
        tag: "Guia",
        title: "Como o leilão de takeover redistribui o território do mural",
        excerpt:
          "Um raio-x da regra da oferta mínima 5×, da divisão 70/30 da receita, e por que a escassez gera demanda real de anunciantes, não só vaidade.",
      },
      {
        tag: "Playbook",
        title: "Transformando um bloco de $9,99 em tráfego mensurável",
        excerpt:
          "O que o dashboard de rastreamento de cliques mostra, como os agentes de IA direcionam visitantes ao seu bloco, e qual zona combina com cada fase de crescimento.",
      },
      {
        tag: "Programa",
        title: "O programa de embaixadores, explicado do início ao fim",
        excerpt:
          "Como funciona o índice público de criadores, o que as marcas procuram ao escolher um parceiro, e como a comissão recorrente é calculada.",
      },
    ],
    aeoNote: "Otimizado para motores de resposta por IA — lido diretamente por GPTBot, ClaudeBot e PerplexityBot.",
    readMore: "Ler mais",
  },
  finalCta: {
    title1: "Os melhores blocos",
    title2: "são ocupados primeiro",
    body: (m) => `Comece com 7 dias grátis. Se alguém quiser sua posição depois, vai ter que pagar ${m}× o que você pagou — e você decide se vende.`,
    ctaPrimary: "Resgatar meu bloco",
    ctaSecondary: "Explorar o mural",
  },
  footer: {
    tagline: "Território permanente de marcas no mural mais disputado da internet.",
    sitemapLabel: "Mapa do site",
    links: { mural: "Mural", creators: "Criadores", pricing: "Planos", ranking: "Ranking", guide: "Guia", terms: "Termos e Privacidade" },
    langLabel: "Idioma",
  },
  floating: "Resgatar meu bloco — 7 dias grátis",
};

const es: LandingContent = {
  meta: {
    title: "ConeXai — Territorio permanente de marcas, impulsado por agentes de IA",
    description:
      "Reclama tu bloque en el mural interactivo, disputa posiciones en subasta y recibe tráfico dirigido por agentes de IA. 7 días gratis para empezar.",
  },
  nav: {
    how: "Cómo funciona",
    auction: "Subasta en vivo",
    pricing: "Precios",
    creators: "Creadores",
    faq: "Preguntas frecuentes",
    blog: "Blog",
    viewMural: "Explorar el mural en vivo",
    claim: "Reclamar mi bloque",
  },
  hero: {
    badge: (blocks) => `subasta en vivo · ${blocks.toLocaleString("es-ES")} bloques ocupados`,
    title1: "Territorio permanente de marcas,",
    titleAccent: "defendido",
    title2: "en tiempo real",
    subtitle:
      "Cada bloque es un territorio permanente para tu marca en el mural ConeXai. Reclama el tuyo, defiéndelo cuando alguien más puje por la posición, y deja que agentes de IA autónomos dirijan tráfico calificado mientras duermes.",
    ctaPrimary: "Reclamar mi bloque",
    ctaPrimaryBadge: "7 días gratis",
    ctaSecondary: "Explorar el mural en vivo",
    note: "Sin tarjeta para empezar · Cancela cuando quieras",
  },
  stats: {
    brands: "marcas activas",
    blocks: "bloques ocupados",
    clicks: "clics dirigidos",
    creators: "creadores indexados",
  },
  how: {
    eyebrow: "Cómo funciona",
    title: "Tres pasos hacia tu territorio",
    steps: [
      {
        title: "Reclama o conquista",
        body: "Elige bloques libres en el mural, o puja por la posición de quien ya está allí. Cuanto más céntrica la zona, mayor la visibilidad — y la disputa.",
      },
      {
        title: "Publica al instante",
        body: "Sube tu logo, define el enlace de destino y la descripción. Tu marca aparece en el mural de inmediato, y puedes editarla cuando quieras.",
      },
      {
        title: "Recibe tráfico con IA",
        body: "Agentes de IA autónomos producen contenido, prospectan y dirigen visitantes directo al mural. Cada clic en tu bloque va directo a tu sitio.",
      },
    ],
  },
  auction: {
    eyebrow: "Mercado en vivo y motor de subastas",
    title: "El mural no tiene inventario infinito",
    body:
      "Cuando el centro se llena, la única forma de entrar es convencer a quien ya está allí de vender. Cualquier anunciante puede pujar por la posición de otra marca — y el dueño decide si acepta.",
    bullets: [
      "La puja mínima es 5× lo que pagó el ocupante actual",
      "Un bloque solo cambia de dueño con la aceptación expresa del propietario",
      "Los fondos quedan en custodia y se devuelven íntegros si la oferta es rechazada",
      "Quien vende recibe el 70% del valor ofertado, directo a su cuenta",
    ],
    cta: "Ver posiciones en disputa",
    exampleLabel: "ejemplo de takeover",
    occupantPaid: "El ocupante pagó",
    minOffer: (m) => `Oferta mínima (${m}×)`,
    youPay: "Tú pagas",
    ownerReceives: "El dueño recibe (70%)",
    note: "La plataforma retiene el 30% de cada transacción intermediada, según los Términos de Servicio.",
  },
  plans: {
    eyebrow: "Precios",
    title: "Cuanto más céntrico, mayor el dominio",
    perMonthBase: "/mes base",
    perBlock: "por bloque",
    rangeSuffix: "bloques",
    monthlyRange: "a",
    footnote: "Suscripción mensual recurrente · Sin permanencia · Cancela cuando quieras",
    mostChosen: "más elegido",
    choose: "Elegir",
    featuresCommon: ["Seguimiento de clics en tiempo real", "Logo, enlace y descripción editables"],
    featuresTierExtra: {
      basic: "Panel con métricas de alcance",
      standard: "Insignia destacada en la búsqueda",
      premium: "Insignia Premium, animación especial y soporte prioritario",
    },
    articles: (n) => `${n} artículo${n > 1 ? "s" : ""} institucional${n > 1 ? "es" : ""} al mes`,
  },
  creators: {
    eyebrow: "Para creadores",
    title: "Conviértete en embajador y gana por cada conversión",
    body:
      "Los creadores se suman al índice público de ConeXai, son descubiertos por marcas que buscan aliados, y ganan una comisión recurrente por cada empresa que traen al mural.",
    cards: [
      { label: "Perfil público", body: "Alcance y engagement visibles para las marcas" },
      { label: "Comisión recurrente", body: "Ganas mientras la marca referida siga suscrita" },
      { label: "Material listo", body: "Copy de campaña generado por IA a tu medida" },
    ],
    cta: "Ver el índice de creadores",
    statLabel: "creadores ya indexados",
    ctaBecome: "Quiero ser embajador",
  },
  faq: {
    eyebrow: "Preguntas frecuentes",
    title: "Todo lo que necesitas saber antes de reclamar un bloque",
    items: [
      {
        q: "¿De verdad soy dueño del bloque, o es un alquiler?",
        a: "El bloque es una suscripción recurrente, no una escritura — piénsalo como un espacio permanente que conservas mientras la suscripción esté activa. Mientras sigas pagando y nadie gane una subasta de takeover contra ti, la posición es tuya indefinidamente, sin fecha de vencimiento forzada.",
      },
      {
        q: "¿Qué pasa cuando se renueva mi plan?",
        a: "Tu suscripción se renueva automáticamente cada mes, al precio fijado según tu cantidad de bloques y zona. Si agregas bloques, los nuevos se cobran desde el día que los reclamas, prorrateados en el primer ciclo.",
      },
      {
        q: "¿Cómo funciona exactamente la subasta de takeover?",
        a: "Cualquier anunciante puede pujar por una posición ya ocupada. La puja mínima es 5× lo que pagó el ocupante actual. Tú, como dueño, decides si aceptas — no hay venta forzada. Si rechazas, el dinero de la oferta se devuelve íntegro a quien pujó.",
      },
      {
        q: "¿Cómo funcionan los pagos y el periodo de prueba?",
        a: "El checkout corre íntegramente por Stripe: tu tarjeta solo se cobra después de 7 días de prueba gratis, y puedes cancelar antes de que termine sin que se te cobre. Todos los precios se calculan en el servidor a partir de la tabla oficial — el monto que ves es exactamente el que Stripe cobra.",
      },
      {
        q: "¿Puedo pasar a una zona más grande después?",
        a: "Sí. Puedes mejorar de Basic a Standard o Premium en cualquier momento; la nueva base y la tarifa por bloque aplican desde tu próximo ciclo de facturación, y conservas los bloques que ya tienes, salvo que un takeover los cambie.",
      },
      {
        q: "¿Qué pasa si cancelo?",
        a: "Cancelar detiene las próximas renovaciones — no hay permanencia. Tus bloques siguen activos hasta el final del ciclo ya pagado; después vuelven al inventario libre y pueden ser reclamados por otra persona.",
      },
    ],
  },
  blog: {
    eyebrow: "Blog y fragmentos para motores de respuesta con IA",
    title: "Artículos institucionales, escritos por agentes de IA",
    subtitle:
      "Contenido estructurado que nuestros agentes de IA publican cada semana — indexado para buscadores y motores de respuesta como GPTBot, ClaudeBot y PerplexityBot, para que las marcas del mural sean encontradas en ambos.",
    posts: [
      {
        tag: "Guía",
        title: "Cómo la subasta de takeover redistribuye el territorio del mural",
        excerpt:
          "Un análisis de la regla de puja mínima 5×, el reparto 70/30 de los ingresos, y por qué la escasez genera demanda real de anunciantes, no solo vanidad.",
      },
      {
        tag: "Playbook",
        title: "Convertir un bloque de $9.99 en tráfico medible",
        excerpt:
          "Qué muestra el panel de seguimiento de clics, cómo los agentes de IA dirigen visitantes a tu bloque, y qué zona conviene según tu etapa de crecimiento.",
      },
      {
        tag: "Programa",
        title: "El programa de embajadores creadores, explicado de principio a fin",
        excerpt:
          "Cómo funciona el índice público de creadores, qué buscan las marcas al elegir un aliado, y cómo se calcula la comisión recurrente.",
      },
    ],
    aeoNote: "Optimizado para motores de respuesta con IA — leído directamente por GPTBot, ClaudeBot y PerplexityBot.",
    readMore: "Leer más",
  },
  finalCta: {
    title1: "Los mejores bloques",
    title2: "se ocupan primero",
    body: (m) => `Empieza con 7 días gratis. Si alguien quiere tu posición después, tendrá que pagar ${m}× lo que tú pagaste — y tú decides si vendes.`,
    ctaPrimary: "Reclamar mi bloque",
    ctaSecondary: "Explorar el mural",
  },
  footer: {
    tagline: "Territorio permanente de marcas en el mural más disputado de internet.",
    sitemapLabel: "Mapa del sitio",
    links: { mural: "Mural", creators: "Creadores", pricing: "Precios", ranking: "Ranking", guide: "Guía", terms: "Términos y Privacidad" },
    langLabel: "Idioma",
  },
  floating: "Reclamar mi bloque — 7 días gratis",
};

export const LANDING_CONTENT: Record<LandingLang, LandingContent> = { en, pt, es };
