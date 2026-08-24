import { Brand } from "./mockData";

const INFLUENCER_COLORS = [
  "#e11d48", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899",
  "#10b981", "#f97316", "#6366f1", "#14b8a6", "#84cc16",
  "#ef4444", "#0ea5e9", "#7c3aed", "#00d4ff", "#ff6b35",
];

export const INFLUENCER_CATEGORIES = [
  "Música",
  "Comédia",
  "Lifestyle",
  "Fitness",
  "Games",
  "Beleza",
  "Culinária",
  "Tecnologia",
  "Dança",
  "Arte",
  "Moda",
  "Tech",
];

export interface MuralInfluencer extends Brand {
  /** Seguidores ou métrica de massa para tamanho do círculo */
  followers_count?: number;
  /** Cliques na última hora (Hot Now = top N) */
  clicks_last_hour?: number;
  /** Número de contratos/parcerias concluídas (métrica para escala) */
  contracts_count?: number;
  hotNow?: boolean;
  /** Categorias de interesse para match com marcas */
  interest_categories?: string[];
  /** Tamanho pré-calculado da bolha em px (render once) */
  bubbleSizePx: number;
}

// Tamanho do bloco = tamanho base do mural (1 célula). Só aumenta para quem tem mais
// cliques, parcerias e seguidores. Maioria fica 1x1; 2x2 e 4x4 só para top performers.
// Faixa: 40 (mínimo, 1 célula) até 130 (4x4 para os melhores).
function computeBubbleSizePx(args: {
  followers_count: number;
  contracts_count: number;
  clicks: number;
}): number {
  const base = 40;
  const followersTerm = Math.min(18, Math.floor(args.followers_count / 25000));
  const contractsTerm = args.contracts_count * 1.8;
  const clicksTerm = Math.min(25, Math.floor(args.clicks / 80));
  const raw = base + followersTerm + contractsTerm + clicksTerm;
  return Math.min(130, Math.max(40, Math.round(raw)));
}

/** Score único para ranking e posição no mural: mesma lógica em todo o app. Quem está no topo do ranking fica nas melhores posições do mural. */
export function getInfluencerRankScore(inf: MuralInfluencer): number {
  const f = inf.followers_count ?? 0;
  const c = inf.contracts_count ?? 0;
  const clicks = inf.clicks ?? 0;
  const base = 40;
  const followersTerm = Math.min(18, Math.floor(f / 25000));
  const contractsTerm = c * 1.8;
  const clicksTerm = Math.min(25, Math.floor(clicks / 80));
  return base + followersTerm + contractsTerm + clicksTerm;
}

function generateInfluencers(): MuralInfluencer[] {
  const influencers: MuralInfluencer[] = [];
  const baseNames = [
    "MC Vitória", "Lucas Comedy", "Ana Lifestyle", "FitDuo", "GamerzBR",
    "Belle Makeup", "Chef Matheus", "TechReview BR", "Dança Total", "Arte Urbana",
    "Voz do Povo", "Riso Fácil", "VidaReal", "IronFit", "PixelPlays",
    "Glow Studio", "Sabor Caseiro", "Gadget Pro", "Ritmo Flow", "Sketch Lab",
    "Som na Caixa", "Piada Pronta", "Estilo Livre", "CrossFire", "StreamKing",
    "NailArt BR", "Receita Fácil", "DevLife", "Breaking BR", "Paint Masters",
    "Batida Forte", "Stand Up BR", "Daily Vibes", "Gym Rats", "RetroGamer",
    "Hair Goals", "Doce Mania", "Code & Coffee", "HipHop BR", "Canvas Pro",
    "Rap Nacional", "Zueira Total", "Nomad Life", "Yoga Flow", "E-Sports BR",
    "Skin Care", "BBQ Master", "AI Explorer", "Funk Hits", "Digital Art",
  ];

  const names: string[] = [];
  for (let i = 0; i < 6; i++) {
    baseNames.forEach((n) => names.push(i === 0 ? n : `${n} ${i + 1}`));
  }

  const GRID_SIZE = 50;
  let blockIndex = 0;

  names.forEach((name, i) => {
    const blocks: { x: number; y: number }[] = [];
    const bx = blockIndex % GRID_SIZE;
    const by = Math.floor(blockIndex / GRID_SIZE);
    blocks.push({ x: bx, y: by });
    blockIndex += 1;

    const catIndex = i % INFLUENCER_CATEGORIES.length;
    const badges: string[] = [];
    if (i < 10) badges.push("Revelação");
    if (Math.random() > 0.7) badges.push("Em Alta");

    const clicks = Math.floor(Math.random() * 10000) + 50;
    const followers_count = Math.floor(Math.random() * 500000) + 5000;
    const clicks_last_hour = Math.floor(Math.random() * 80);
    const contracts_count = Math.floor(Math.random() * 20);

    influencers.push({
      id: `influencer-${i}`,
      name,
      category: INFLUENCER_CATEGORIES[catIndex],
      website: `https://instagram.com/${name.toLowerCase().replace(/\s/g, "")}`,
      logo: name.substring(0, 2).toUpperCase(),
      color: INFLUENCER_COLORS[i % INFLUENCER_COLORS.length],
      blocks,
      clicks,
      joinedAt: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
      badges,
      followers_count,
      clicks_last_hour,
      contracts_count,
      hotNow: false,
      interest_categories: [INFLUENCER_CATEGORIES[catIndex], INFLUENCER_CATEGORIES[(catIndex + 1) % INFLUENCER_CATEGORIES.length]],
      bubbleSizePx: computeBubbleSizePx({ followers_count, contracts_count, clicks }),
      mural_type: "influencers",
      // Retrato real, não avatar cartoon. O mural de criadores é editorial:
      // um desenho estilo "avataaars" descaracteriza pessoas reais e faz o
      // produto parecer um jogo. `pravatar` serve headshots fotográficos
      // determinísticos por índice (1–70), então o mock fica estável entre
      // recarregamentos. Em produção, `logo_url` vem da foto enviada.
      logo_url: `https://i.pravatar.cc/400?img=${(i % 70) + 1}`,
      video_url: (i < 5) ? "https://player.vimeo.com/external/494252666.sd.mp4?s=7b038c1a603df5f0962b32f1437b0cf91f15809f&profile_id=164&oauth2_token_id=57447761" : null,
    });
  });

  // Marcar top 5 por clicks_last_hour como Hot Now
  const sorted = [...influencers].sort((a, b) => (b.clicks_last_hour ?? 0) - (a.clicks_last_hour ?? 0));
  sorted.slice(0, 5).forEach((inf) => { inf.hotNow = true; });
  return influencers;
}

export const MOCK_INFLUENCERS = generateInfluencers();
