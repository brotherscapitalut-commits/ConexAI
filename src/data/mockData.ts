// Mock data for the mural grid
export interface Brand {
  id: string;
  name: string;
  category: string;
  website: string;
  logo: string;
  color: string;
  blocks: { x: number; y: number }[];
  clicks: number;
  joinedAt: string;
  badges: string[];
  isPerpetual?: boolean;
  contact_email?: string | null;
  contact_whatsapp?: string | null;
  logo_url?: string | null;
  video_url?: string | null;
  mural_type?: "empresas" | "influencers" | null;
}

export const CATEGORIES = [
  "Tecnologia",
  "Saúde",
  "Educação",
  "Alimentação",
  "Moda",
  "Finanças",
  "Entretenimento",
  "Esportes",
  "Imobiliário",
  "Serviços",
];

const BRAND_COLORS = [
  "#00d4ff", "#ff6b35", "#7c3aed", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#06b6d4", "#84cc16", "#f97316",
  "#6366f1", "#14b8a6", "#e11d48", "#8b5cf6", "#0ea5e9",
];

/** Plus: 1 bloco só — para ver destaque em célula pequena */
const PREMIUM_PLUS_SINGLE: Brand = {
  id: "brand-plus-single",
  name: "Plus 1",
  category: "Tecnologia",
  website: "https://plus1.demo",
  logo: "P1",
  color: "#06b6d4",
  blocks: [{ x: 2, y: 8 }],
  clicks: 1200,
  joinedAt: new Date(2024, 1, 1).toISOString(),
  badges: ["Premium Plus"],
  isPerpetual: true,
  contact_email: null,
  contact_whatsapp: null,
};

/** Plus: área lateral (esquerda) */
const PREMIUM_PLUS_LATERAL: Brand = {
  id: "brand-plus-lateral",
  name: "Plus Lateral",
  category: "Moda",
  website: "https://pluslateral.demo",
  logo: "PL",
  color: "#ec4899",
  blocks: [{ x: 2, y: 10 }, { x: 3, y: 10 }, { x: 2, y: 11 }, { x: 3, y: 11 }],
  clicks: 5600,
  joinedAt: new Date(2024, 0, 20).toISOString(),
  badges: ["Premium Plus", "Lateral"],
  isPerpetual: true,
  contact_email: null,
  contact_whatsapp: null,
};

/** Plus: área intermediária */
const PREMIUM_PLUS_INTERMEDIATE: Brand = {
  id: "brand-plus-intermediate",
  name: "Plus Inter",
  category: "Saúde",
  website: "https://plusinter.demo",
  logo: "PI",
  color: "#10b981",
  blocks: [
    { x: 18, y: 20 }, { x: 19, y: 20 }, { x: 18, y: 21 }, { x: 19, y: 21 },
    { x: 18, y: 22 }, { x: 19, y: 22 },
  ],
  clicks: 8900,
  joinedAt: new Date(2024, 0, 10).toISOString(),
  badges: ["Premium Plus", "Intermediário"],
  isPerpetual: true,
  contact_email: null,
  contact_whatsapp: null,
};

/** Plus: centro (destaque máximo) */
const PREMIUM_PLUS_DEMO_BRAND: Brand = {
  id: "brand-premium-plus-demo",
  name: "Elite Plus",
  category: "Tecnologia",
  website: "https://eliteplus.com",
  logo: "EP",
  color: "#eab308",
  blocks: (() => {
    const blocks: { x: number; y: number }[] = [];
    for (let dx = 0; dx < 4; dx++) {
      for (let dy = 0; dy < 4; dy++) {
        blocks.push({ x: 24 + dx, y: 12 + dy });
      }
    }
    return blocks;
  })(),
  clicks: 28400,
  joinedAt: new Date(2024, 0, 15).toISOString(),
  badges: ["Premium Plus", "Destaque Máximo", "Centro Premium"],
  isPerpetual: true,
  contact_email: "contato@eliteplus.com",
  contact_whatsapp: "5511988887777",
  logo_url: "https://images.unsplash.com/photo-1599305090748-364e7b0404c0?q=80&w=200&auto=format&fit=crop",
  video_url: "https://player.vimeo.com/external/494252666.sd.mp4?s=7b038c1a603df5f0962b32f1437b0cf91f15809f&profile_id=164&oauth2_token_id=57447761",
  mural_type: "influencers",
};

function generateBrands(): Brand[] {
  const brands: Brand[] = [
    PREMIUM_PLUS_SINGLE,
    PREMIUM_PLUS_LATERAL,
    PREMIUM_PLUS_INTERMEDIATE,
    PREMIUM_PLUS_DEMO_BRAND,
  ];
  const names = [
    "TechNova", "PixelForge", "CloudSync", "DataPulse", "NeonLab",
    "VortexAI", "CodeCraft", "ByteWave", "QuantumLeap", "SkyNet Solutions",
    "InnovateTech", "GreenLeaf", "FitLife Pro", "EduSpark", "FoodHub",
    "StyleBox", "FinanceFlow", "GameVault", "SportZone", "HomeKey",
    "RapidDev", "MediCare Plus", "LearnPro", "GourmetGo", "TrendWear",
    "WealthWise", "PlayStream", "RunFast", "PropertyPro", "FixItNow",
    "AppForge", "HealthSync", "SkillUp", "FreshBite", "ChicMode",
    "PaySmart", "FunZone", "FitTrack", "RealtyMax", "TaskMaster",
    "DevOps Hub", "WellBeing", "BrainBoost", "TasteIt", "LuxFashion",
    "CryptoVault", "CineMax", "ProAthlete", "DreamHome", "QuickFix",
  ];

  const GRID_SIZE = 50; // Visual grid size for the demo

  const cols = 100;
  const rows = 50;
  const used = new Set<string>();

  function canPlace(ox: number, oy: number, uw: number, uh: number): boolean {
    if (ox < 0 || oy < 0 || ox + uw > cols || oy + uh > rows) return false;
    for (let dy = 0; dy < uh; dy++) {
      for (let dx = 0; dx < uw; dx++) {
        if (used.has(`${ox + dx},${oy + dy}`)) return false;
      }
    }
    return true;
  }
  
  function mark(ox: number, oy: number, uw: number, uh: number): void {
    for (let dy = 0; dy < uh; dy++) {
      for (let dx = 0; dx < uw; dx++) {
        used.add(`${ox + dx},${oy + dy}`);
      }
    }
  }

  // Pre-mark Premium zones where static brands were pushed
  mark(24, 12, 4, 4);
  mark(2, 8, 1, 1);
  mark(2, 10, 2, 2);
  mark(18, 20, 2, 3);

  let brandIndex = 0;

  const premiumZone = { x1: 40, x2: 60, y1: 15, y2: 35 };
  const intermediateZone = { x1: 25, x2: 75, y1: 8, y2: 42 };

  function getZone(x: number, y: number) {
    if (x >= premiumZone.x1 && x <= premiumZone.x2 && y >= premiumZone.y1 && y <= premiumZone.y2) return 'premium';
    if (x >= intermediateZone.x1 && x <= intermediateZone.x2 && y >= intermediateZone.y1 && y <= intermediateZone.y2) return 'intermediate';
    return 'border';
  }

  // Define sizes
  const premiumSizes = [[4, 4], [5, 3], [7, 3], [6, 3], [4, 5]];
  const intermediateSizes = [[3, 3], [4, 2], [3, 4], [2, 4], [4, 3]];
  const borderSizes = [[2, 2], [3, 2], [2, 3], [2, 1], [1, 2]];
  const influencerSize = [7, 2]; // Exactly 14 blocks

  function createBrand(blocks: {x: number, y: number}[], type: "empresas" | "influencers", zone: string) {
    const i = brandIndex++;
    const baseName = names[i % names.length];
    const name = i < names.length ? baseName : `${baseName} ${Math.floor(i / names.length) + 1}`;
    const catIndex = i % CATEGORIES.length;
    const badges: string[] = [];
    
    if (i < 10) badges.push("Pioneiro");
    if (Math.random() > 0.7) badges.push("Top 10");
    if (zone === 'premium') badges.push("Centro Premium");
    if (type === 'influencers') badges.push("Influenciador Parceiro");

    const hasContact = i < 8;
    brands.push({
      id: `brand-${i}`,
      name,
      category: CATEGORIES[catIndex],
      website: `https://${name.toLowerCase().replace(/\s/g, "")}.com`,
      logo: name.substring(0, 2).toUpperCase(),
      color: BRAND_COLORS[i % BRAND_COLORS.length],
      blocks,
      clicks: Math.floor(Math.random() * 15000) + 100,
      joinedAt: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
      badges,
      isPerpetual: false,
      contact_email: hasContact ? `contato@${name.toLowerCase().replace(/\s/g, "")}.com` : null,
      contact_whatsapp: hasContact ? "5511999999999" : null,
      mural_type: type,
      logo_url: null,
    });
  }

  // 1. Pass: Pre-allocate influencers in specific locations (e.g. bottom border)
  for (let ox = 10; ox <= 90; ox += 7) {
    const oy = 46; // bottom edge
    if (canPlace(ox, oy, 7, 2)) {
      mark(ox, oy, 7, 2);
      const blocks = [];
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 7; dx++) {
          blocks.push({ x: ox + dx, y: oy + dy });
        }
      }
      createBrand(blocks, "influencers", "border");
    }
  }

  // 2. Pass: Fill the rest
  for (let oy = 0; oy < rows; oy++) {
    for (let ox = 0; ox < cols; ox++) {
      if (used.has(`${ox},${oy}`)) continue;

      const zone = getZone(ox, oy);
      let sizesToTry = borderSizes;
      if (zone === 'premium') sizesToTry = premiumSizes;
      else if (zone === 'intermediate') sizesToTry = intermediateSizes;

      let placedW = 0;
      let placedH = 0;
      
      const shuffled = [...sizesToTry].sort(() => Math.random() - 0.5);
      if (zone === 'border') shuffled.push([1, 1]); // allow 1x1 only in border as normal fallback

      for (const [w, h] of shuffled) {
        if (canPlace(ox, oy, w, h)) {
          let valid = true;
          for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
              if (getZone(ox + dx, oy + dy) !== zone) valid = false;
            }
          }
          if (valid || zone === 'border') {
            placedW = w;
            placedH = h;
            break;
          }
        }
      }

      if (placedW > 0 && placedH > 0) {
        mark(ox, oy, placedW, placedH);
        const blocks: { x: number; y: number }[] = [];
        for (let dy = 0; dy < placedH; dy++) {
          for (let dx = 0; dx < placedW; dx++) {
            blocks.push({ x: ox + dx, y: oy + dy });
          }
        }
        createBrand(blocks, "empresas", zone);
      }
    }
  }

  // 3. Final Pass: Gap absorption to guarantee 100% fill without small brands
  for (let oy = 0; oy < rows; oy++) {
    for (let ox = 0; ox < cols; ox++) {
      if (!used.has(`${ox},${oy}`)) {
        // Find an adjacent brand
        let neighborId = null;
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dx, dy] of directions) {
          const nx = ox + dx;
          const ny = oy + dy;
          if (used.has(`${nx},${ny}`)) {
            const neighborBrand = brands.find(b => b.blocks.some(block => block.x === nx && block.y === ny));
            if (neighborBrand) {
              neighborBrand.blocks.push({ x: ox, y: oy });
              used.add(`${ox},${oy}`);
              break;
            }
          }
        }
        // If absolutely no neighbor (e.g. totally isolated), create a 1x1 fallback to prevent red screen
        if (!used.has(`${ox},${oy}`)) {
           mark(ox, oy, 1, 1);
           createBrand([{ x: ox, y: oy }], "empresas", "border");
        }
      }
    }
  }

  return brands;
}

export const MOCK_BRANDS = generateBrands();

export const STATS = {
  totalBrands: MOCK_BRANDS.length,
  totalClicks: MOCK_BRANDS.reduce((sum, b) => sum + b.clicks, 0),
  totalBlocks: MOCK_BRANDS.reduce((sum, b) => sum + b.blocks.length, 0),
  blocksAvailable: 1000000,
};
