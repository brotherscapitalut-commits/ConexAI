import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ROUTE_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: "ConeXai - O Maior Mural Digital do Mundo",
    description: "ConeXai conecta empresas e influencers em um mural digital interativo. Explore o mural Ultra HD, filtros e poeira estelar. Garanta seu espaço e ganhe visibilidade.",
  },
  "/auth": {
    title: "Entrar | ConeXai",
    description: "Acesse seu painel ou crie sua conta para anunciar no mural.",
  },
  "/dashboard": {
    title: "Painel do Anunciante | ConeXai",
    description: "Acompanhe cliques, blocos, assinaturas e conversas com influencers.",
  },
  "/ranking": {
    title: "Ranking | ConeXai",
    description: "Ranking de marcas e influenciadores no mural.",
  },
  "/precos": {
    title: "Preços e Planos | ConeXai",
    description: "Escolha sua zona no mural, quantidade de blocos e efetue o pagamento.",
  },
  "/influencers": {
    title: "Influenciadores | ConeXai",
    description: "Encontre influenciadores por nicho e país para parcerias.",
  },
  "/dashboard/influencer": {
    title: "Nexus - Centro de Comando do Influenciador | ConeXai",
    description: "Visão geral, carteira, ganhos e mural de marcas. Cadastre suas redes e receba propostas de empresas.",
  },
  "/portal-empresa": {
    title: "Painel do Anunciante | ConeXai",
    description: "Acompanhe cliques, blocos, assinaturas e conversas com influencers.",
  },
  "/admin": {
    title: "Admin | ConeXai",
    description: "Painel de administração.",
  },
};

const DEFAULT_META = {
  title: "ConeXai - O Maior Mural Digital do Mundo",
  description: "ConeXai conecta empresas e influencers em um mural digital interativo.",
};

/** Atualiza title e meta description conforme a rota (SEO). */
export default function SeoHead() {
  const { pathname } = useLocation();

  useEffect(() => {
    let meta: { title: string; description: string };
    if (pathname.startsWith("/empresa/")) meta = { title: "Perfil da Empresa | ConeXai", description: DEFAULT_META.description };
    else if (pathname.startsWith("/influencer/")) meta = { title: "Perfil do Influenciador | ConeXai", description: DEFAULT_META.description };
    else if (pathname.startsWith("/campanha/")) meta = { title: "Campanha | ConeXai", description: "Detalhes da campanha para influenciadores." };
    else if (pathname.startsWith("/p/")) meta = { title: "Perfil | ConeXai", description: "Perfil no ConeXai. Contrate via ConeXai." };
    else if (ROUTE_META[pathname]) meta = ROUTE_META[pathname];
    else {
      const base = "/" + pathname.split("/")[1];
      meta = ROUTE_META[base] || DEFAULT_META;
    }
    document.title = meta.title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", meta.description);
  }, [pathname]);

  return null;
}
