import { useEffect } from "react";
import { Link } from "react-router-dom";

/**
 * Entidade genérica exibida em um mural. Cobre tanto `MuralBrand` quanto
 * `MuralInfluencer` sem acoplar o SEO aos tipos de domínio.
 */
export interface SeoEntity {
  id: string;
  name: string;
  category?: string;
  website?: string | null;
  logo_url?: string | null;
  followers_count?: number | null;
  clicks?: number | null;
  blocks?: unknown[];
}

type MuralKind = "empresas" | "influencers";

interface MuralSeoProps {
  kind: MuralKind;
  /** Participantes exibidos no mural. */
  entities: SeoEntity[];
  /** Caminho canônico da página, ex.: "/" ou "/influencers". */
  path: string;
  /** Título da aba e do OpenGraph. */
  title: string;
  description: string;
  /** Limite de itens no JSON-LD e na lista indexável. */
  limit?: number;
}

const SITE_URL = "https://muraldigital.com";

const COPY: Record<MuralKind, {
  h1: string;
  h2: string;
  itemPath: (id: string) => string;
  entityType: "Organization" | "Person";
  listName: string;
}> = {
  empresas: {
    h1: "Mural de marcas: empresas anunciando em blocos de pixels",
    h2: "Marcas e empresas anunciantes",
    itemPath: (id) => `/empresa/${id}`,
    entityType: "Organization",
    listName: "Marcas anunciantes no mural digital",
  },
  influencers: {
    h1: "Mural de criadores: influenciadores disponíveis para campanhas",
    h2: "Criadores de conteúdo e influenciadores",
    itemPath: (id) => `/influencer/${id}`,
    entityType: "Person",
    listName: "Criadores de conteúdo no mural digital",
  },
};

/** Cria ou atualiza uma <meta> no <head>, sem duplicar em re-renders. */
function upsertMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Camada de SEO dos murais.
 *
 * ── Por que este componente existe ──
 * O mural de marcas é renderizado em `<canvas>`. Para um crawler, um canvas
 * é um elemento vazio: nenhuma marca, nenhum nome, nenhum link — a página
 * inteira é invisível para busca, por mais anunciantes que tenha. O mural de
 * criadores é DOM, mas os cards abrem modais em vez de navegar, então
 * também não geravam destinos rastreáveis.
 *
 * A solução aqui tem três camadas, todas invisíveis para quem enxerga:
 *   1. Cabeçalho semântico `sr-only` — dá à página um H1/H2 real.
 *   2. Lista `sr-only` de âncoras com `href` real para cada participante,
 *      que é o que permite ao Google descobrir e indexar cada perfil.
 *   3. JSON-LD `CollectionPage` + `ItemList` com nomes, categorias, métricas
 *      e URLs, para rich results.
 *
 * `sr-only` (não `display:none`) é deliberado: conteúdo oculto por
 * `display:none` ou `visibility:hidden` é depreciado pelo Google, enquanto
 * texto posicionado fora da viewport e acessível a leitores de tela é
 * tratado como conteúdo legítimo — é exatamente o que leitores de tela
 * precisam para navegar um canvas.
 */
export function MuralSeo({
  kind,
  entities,
  path,
  title,
  description,
  limit = 100,
}: MuralSeoProps) {
  const copy = COPY[kind];
  const canonical = `${SITE_URL}${path === "/" ? "/" : path}`;
  const items = entities.slice(0, limit);

  // ── <head>: título, descrição e canônica por rota ──
  useEffect(() => {
    document.title = title;
    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonical);

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;
  }, [title, description, canonical]);

  // ── JSON-LD: CollectionPage envolvendo um ItemList ──
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonical,
    inLanguage: "pt-BR",
    isPartOf: {
      "@type": "WebSite",
      name: "MuralDigital",
      url: SITE_URL,
    },
    // Amostra de imagens da coleção. Sinaliza ao Google Imagens que esta
    // página é primariamente visual e quais arquivos a compõem.
    image: items
      .filter((e) => e.logo_url)
      .slice(0, 12)
      .map((e) => ({
        "@type": "ImageObject",
        contentUrl: e.logo_url,
        name: e.name,
      })),
    mainEntity: {
      "@type": "ItemList",
      name: copy.listName,
      numberOfItems: items.length,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: items.map((e, i) => {
        const entity: Record<string, unknown> = {
          "@type": copy.entityType,
          name: e.name,
          url: `${SITE_URL}${copy.itemPath(e.id)}`,
        };
        if (e.logo_url) {
          /*
            `ImageObject` completo em vez de uma URL solta.

            Este produto é um mural: quase todo o conteúdo é imagem, e um
            crawler não lê pixels. Descrever cada imagem com `name`,
            `caption` e `contentUrl` é o que permite ao Google Imagens e aos
            assistentes de IA entenderem QUEM está naquele bloco — sem isso,
            uma página cheia de logos é, para a máquina, uma página vazia.
          */
          entity.image = {
            "@type": "ImageObject",
            contentUrl: e.logo_url,
            url: e.logo_url,
            name: `${e.name}${e.category ? ` — ${e.category}` : ""}`,
            caption:
              copy.entityType === "Person"
                ? `Foto de ${e.name}, criador de conteúdo${e.category ? ` em ${e.category}` : ""}`
                : `Logotipo de ${e.name}${e.category ? `, marca do setor ${e.category}` : ""}`,
            representativeOfPage: false,
          };
        }
        if (e.category) {
          // `knowsAbout` para pessoas, `knowsAbout`/`category` genérico para
          // organizações — ambos são propriedades válidas do schema.org.
          entity[copy.entityType === "Person" ? "knowsAbout" : "category"] = e.category;
        }
        if (e.website) entity.sameAs = [e.website];
        if (typeof e.followers_count === "number" && e.followers_count > 0) {
          entity.interactionStatistic = {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/FollowAction",
            userInteractionCount: e.followers_count,
          };
        }
        return {
          "@type": "ListItem",
          position: i + 1,
          item: entity,
        };
      }),
    },
  };

  return (
    <>
      {/*
        Cabeçalho semântico. A interface visual do mural não tem — e não deve
        ter — um H1 desenhado na tela; o produto é a grade. Este bloco dá à
        página a estrutura de títulos que o crawler espera, sem custo visual.
      */}
      <header className="sr-only">
        <h1>{copy.h1}</h1>
        <h2>{copy.h2}</h2>
        <p>{description}</p>
      </header>

      {/*
        Lista indexável. É esta seção que transforma cada participante em um
        destino rastreável — sem ela, os perfis em /empresa/:id e
        /influencer/:id ficam órfãos, sem nenhum link interno apontando para
        eles, e dificilmente entram no índice.
      */}
      <nav className="sr-only" aria-label={copy.h2}>
        <h2>{copy.listName}</h2>
        <ul>
          {items.map((e) => (
            <li key={e.id}>
              <Link to={copy.itemPath(e.id)}>
                {e.name}
                {e.category ? ` — ${e.category}` : ""}
                {typeof e.followers_count === "number" && e.followers_count > 0
                  ? ` — ${e.followers_count.toLocaleString("pt-BR")} seguidores`
                  : ""}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <script
        type="application/ld+json"
        // JSON serializado por nós a partir de dados da própria aplicação.
        // `</script>` é escapado para impedir que um nome de marca com essa
        // sequência feche a tag e injete markup.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}

export default MuralSeo;
