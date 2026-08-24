export interface MuralBlock {
  x: number;
  y: number;
  purchase_price?: number;
  position_id?: string;
  purchased_at?: string;
}

export interface MuralBrand {
  id: string;
  name: string;
  category: string;
  website: string;
  logo: string;
  color: string;
  blocks: MuralBlock[];
  clicks: number;
  joinedAt: string;
  badges: string[];
  logo_url?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  /** Premium Plus: ignora ciclo de pulsação, escala 1.2 e glow fixo */
  isPerpetual?: boolean;
  /** Contato para influencer abrir chat (WhatsApp / e-mail) */
  contact_email?: string | null;
  contact_whatsapp?: string | null;
  /** Empresa com créditos para influencers (campanhas ativas) */
  has_active_campaigns?: boolean;
  /** Número de negociações concluídas (paid) para ordenação na busca */
  completed_deals?: number;
  /** Bids pendentes contra esta posição; usado para heatmap visual e destaque de disputa */
  active_bid_count?: number;
  /** Tier para tamanho no mural: bronze 1x1, prata 2x1/1x2, ouro 2x2, diamante 4x4 */
  tier?: "bronze" | "prata" | "ouro" | "diamante";
  video_url?: string | null;
  mural_type?: "empresas" | "influencers" | null;
  /** Métricas de Influenciador */
  followers_count?: number;
  clicks_last_hour?: number;
  contracts_count?: number;
  interest_categories?: string[];
  position_value?: number;
  /** Indica se o dono do território aceita explicitamente receber propostas (bids) de outras marcas */
  open_for_bids?: boolean;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MuralState {
  zoom: number;
  panX: number;
  panY: number;
  containerWidth: number;
  containerHeight: number;
}

export interface ZoneBounds {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export type ZoneName = "premium" | "intermediate" | "border";

/** Territory grid: 5,000 purchasable blocks (100×50) */
export const GRID_COLS = 100;
export const GRID_ROWS = 50;

/** Block coordinate display format (e.g. "A1", "F23", "AA1") */
export type BlockCoordinate = string;

// ── Digital city block states ───────────────────────────────────

export type BlockStateKind = "available" | "occupied" | "auction" | "bid_received";

export interface AuctionState {
  startingPrice: number;
  highestBid: number;
  auctionEndTime: number; // epoch millis
}

/**
 * `failed` cobre o caso em que o aceite foi disparado mas a liquidação não
 * concluiu (falha de pagamento, bloco já transferido). `processBidAcceptance`
 * já gravava esse valor, mas ele não existia no tipo — o que fazia o TypeScript
 * acusar erro e, pior, deixava o estado de falha indistinguível de um lance
 * ainda pendente para quem lê o tipo.
 */
export type BidStatus = "pending" | "accepted" | "rejected" | "counter" | "failed";

export interface BlockBid {
  id: string;
  blockKey: string; // `${x},${y}`
  fromBrandId: string;
  toBrandId: string;
  value: number;
  status: BidStatus;
  createdAt: string;
}

