import type { MuralBrand } from "./types";
import { MOCK_BRANDS } from "@/data/mockData";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { isUuidV4Like } from "@/lib/uuid";

const TEST_COMPANY_NAME = "Empresa Teste ConexAi";

/**
 * Data loader with caching for mural brands/blocks.
 * Falls back to mock data when no DB data available.
 */

let cachedBrands: MuralBrand[] | null = null;
let lastFetch = 0;
const CACHE_TTL = 60_000; // 1 minute

export type LoadBrandsOptions = { sortByBids?: boolean };

export async function loadBrands(options?: LoadBrandsOptions): Promise<MuralBrand[]> {
  const sortByBids = options?.sortByBids === true;
  const now = Date.now();
  if (cachedBrands && now - lastFetch < CACHE_TTL && !sortByBids) return cachedBrands;

  try {
    const { data: companiesData } = await supabase.from("companies").select("*").eq("moderation_status", "approved");
    const { data: blocksData } = await supabase.from("blocks").select("*, purchase_price, position_id").eq("status", "occupied");

    const companies = Array.isArray(companiesData) ? companiesData : companiesData ? [companiesData] : [];
    const blocks = Array.isArray(blocksData) ? blocksData : blocksData ? [blocksData] : [];

    if (companies.length > 0 && blocks.length > 0) {
      const blocksByCompany = new Map<string, { x: number; y: number; purchase_price?: number; position_id?: string; purchased_at?: string }[]>();
      for (const block of blocks) {
        const bid = block as { company_id?: string; x: number; y: number; purchase_price?: number; position_id?: string; purchased_at?: string };
        if (!bid.company_id) continue;
        if (!blocksByCompany.has(bid.company_id)) blocksByCompany.set(bid.company_id, []);
        blocksByCompany.get(bid.company_id)!.push({ 
          x: bid.x, 
          y: bid.y, 
          purchase_price: bid.purchase_price,
          position_id: bid.position_id,
          purchased_at: bid.purchased_at
        });
      }

      const { data: withCreditsData } = await supabase.from("companies").select("id").gt("influencer_credits_balance", 0);
      const withCredits = Array.isArray(withCreditsData) ? withCreditsData : withCreditsData ? [withCreditsData] : [];
      const idsWithActiveCampaigns = new Set(withCredits.map((c: { id: string }) => c.id));

      const companyIds = companies.filter((c: { id: string }) => blocksByCompany.has(c.id)).map((c: { id: string }) => c.id);
      const completedByCompany = new Map<string, number>();
      const activeBidsByCompany = new Map<string, number>();
      if (companyIds.length > 0) {
        const { data: paidData } = await supabase.from("partnership_proposals").select("to_company_id").eq("status", "paid").in("to_company_id", companyIds);
        const paid = Array.isArray(paidData) ? paidData : paidData ? [paidData] : [];
        for (const row of paid) {
          const id = (row as { to_company_id: string }).to_company_id;
          completedByCompany.set(id, (completedByCompany.get(id) ?? 0) + 1);
        }
        try {
          const { data: bidsData } = await supabase.from("position_bids").select("to_brand_id").eq("status", "pending").in("to_brand_id", companyIds);
          const bids = Array.isArray(bidsData) ? bidsData : bidsData ? [bidsData] : [];
          for (const row of bids) {
            const id = (row as { to_brand_id: string }).to_brand_id;
            if (id) activeBidsByCompany.set(id, (activeBidsByCompany.get(id) ?? 0) + 1);
          }
        } catch (_) {}
      }

      const placeholderUrl = "https://placeholder.local";
      const getVisitUrl = (c: { website?: string; instagram?: string | null; tiktok?: string | null; youtube?: string | null }) => {
        const site = c.website?.trim();
        if (site && site !== placeholderUrl && site.startsWith("http")) return site;
        const ig = c.instagram?.trim().replace(/^@/, "");
        if (ig) return `https://instagram.com/${ig}`;
        const tt = c.tiktok?.trim().replace(/^@/, "");
        if (tt) return `https://tiktok.com/@${tt}`;
        const yt = c.youtube?.trim();
        if (yt) return yt.startsWith("http") ? yt : `https://youtube.com/${yt.startsWith("@") ? yt : `@${yt}`}`;
        return site || "#";
      };

      const dbBrands: MuralBrand[] = companies
        .filter((c: { id: string }) => blocksByCompany.has(c.id))
        .map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          category: (c.category as string) ?? "",
          website: getVisitUrl(c as Parameters<typeof getVisitUrl>[0]),
          logo: (c.logo_initials as string) ?? "XX",
          color: (c.color as string) ?? "#00d4ff",
          blocks: blocksByCompany.get(c.id as string) || [],
          clicks: 0,
          joinedAt: (c.created_at as string) ?? "",
          badges: [],
          logo_url: (c.logo_url as string | null) ?? null,
          instagram: (c.instagram as string | null) ?? null,
          tiktok: (c.tiktok as string | null) ?? null,
          youtube: (c.youtube as string | null) ?? null,
          isPerpetual: (c.is_perpetual as boolean) ?? false,
          contact_email: (c.contact_email as string | null) ?? null,
          contact_whatsapp: (c.contact_whatsapp as string | null) ?? null,
          has_active_campaigns: idsWithActiveCampaigns.has(c.id as string),
          completed_deals: completedByCompany.get(c.id as string) ?? 0,
          active_bid_count: activeBidsByCompany.get(c.id as string) ?? 0,
          position_value: (c.position_value as number) ?? 0,
        }));

      if (sortByBids) {
        dbBrands.sort((a, b) => (b.active_bid_count ?? 0) - (a.active_bid_count ?? 0));
      }

      cachedBrands = dbBrands;
    } else {
      logger.info("MuralDataLoader", "Nenhuma empresa aprovada com blocos.");
      cachedBrands = [];
    }
  } catch (e) {
    logger.error("MuralDataLoader", "Falha ao carregar marcas do banco.", e);
    cachedBrands = [];
  }

  lastFetch = now;
  // Fallback para MOCK_BRANDS se o banco estiver vazio ou der erro
  if (!cachedBrands || cachedBrands.length === 0) {
    console.warn("[MuralDataLoader] Banco vazio ou Erro 500. Usando MOCK_BRANDS para demonstração.");
    return MOCK_BRANDS;
  }
  return cachedBrands;
}

export async function recordClick(brand: MuralBrand): Promise<void> {
  if (!isUuidV4Like(brand.id)) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("interactions").insert({
      company_id: brand.id,
      block_x: brand.blocks[0]?.x ?? null,
      block_y: brand.blocks[0]?.y ?? null,
      source: "mural",
      user_id: user?.id ?? null,
    });
  } catch {}
}

export function invalidateCache() {
  cachedBrands = null;
  lastFetch = 0;
}

export type CountryRankEntry = { country: string; blocks: number; label: string };

/** Ranking global de países por blocos ocupados no mural */
export async function loadCountryRanking(): Promise<CountryRankEntry[]> {
  try {
    const { data: blocksData } = await supabase.from("blocks").select("company_id").eq("status", "occupied");
    const blocks = Array.isArray(blocksData) ? blocksData : blocksData ? [blocksData] : [];
    const filtered = blocks.filter((b: { company_id?: string }) => b.company_id);
    if (filtered.length === 0) return [];

    const companyIds = [...new Set(filtered.map((b: { company_id: string }) => b.company_id))] as string[];
    const { data: companiesData } = await supabase.from("companies").select("id, country, region").in("id", companyIds);
    const companies = Array.isArray(companiesData) ? companiesData : companiesData ? [companiesData] : [];

    const countByKey = new Map<string, number>();
    const blockCountByCompany = new Map<string, number>();
    for (const b of filtered) {
      if (b.company_id) blockCountByCompany.set(b.company_id, (blockCountByCompany.get(b.company_id) ?? 0) + 1);
    }

    for (const c of companies) {
      const key = (c.country || c.region || "XX").toString().trim().slice(0, 2).toUpperCase() || "XX";
      const n = blockCountByCompany.get(c.id) ?? 0;
      countByKey.set(key, (countByKey.get(key) ?? 0) + n);
    }

    const COUNTRY_LABELS: Record<string, string> = {
      BR: "Brasil", US: "EUA", PT: "Portugal", ES: "Espanha", MX: "México",
      AR: "Argentina", CO: "Colômbia", FR: "França", DE: "Alemanha", GB: "Reino Unido",
      IT: "Itália", JP: "Japão", CN: "China", IN: "Índia", CA: "Canadá", AU: "Austrália",
    };
    return Array.from(countByKey.entries())
      .map(([country, blocks]) => ({
        country,
        blocks,
        label: COUNTRY_LABELS[country] || country,
      }))
      .sort((a, b) => b.blocks - a.blocks)
      .slice(0, 8);
  } catch {
    return [];
  }
}
