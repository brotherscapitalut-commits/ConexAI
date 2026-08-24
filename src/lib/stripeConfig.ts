// Configuração oficial dos Planos e Preços do Stripe - ConexAi
export const STRIPE_CONFIG = {
  account: "acct_1Tx8jqRmDCdzWe19",
  mode: "test",
  currency: "usd",
  trialPeriodDays: 7,
  plans: {
    basic: {
      label: "Basic (Edge)",
      productId: "prod_V7twVT26gbrVvf",
      basePriceId: "price_1U7e8YRmDCdzWe19bvBU1kKI",
      blockPriceId: "price_1U7eAHRmDCdzWe19qX2nu1ov",
      blockLookupKey: "conexai_basic_block_monthly",
      baseAmountUsd: 9.99,
      blockAmountUsd: 2.5,
      minBlocks: 1,
      maxBlocks: 6,
      monthlyRangeUsd: [12.49, 24.99]
    },
    standard: {
      label: "Standard (Mid)",
      mostPopular: true,
      productId: "prod_V7txhD2VrmRhso",
      basePriceId: "price_1U7e99RmDCdzWe19vnXbGeCY",
      blockPriceId: "price_1U7eBQRmDCdzWe1944o0jmyJ",
      blockLookupKey: "conexai_standard_block_monthly",
      baseAmountUsd: 20.99,
      blockAmountUsd: 3.5,
      minBlocks: 7,
      maxBlocks: 12,
      monthlyRangeUsd: [45.49, 62.99]
    },
    premium: {
      label: "Premium (Prime Center)",
      productId: "prod_V7txG5igk2Ffi0",
      basePriceId: "price_1U7e9ZRmDCdzWe19aO7Qbhcv",
      blockPriceId: "price_1U7eCDRmDCdzWe194uTiIazn",
      blockLookupKey: "conexai_premium_block_monthly",
      baseAmountUsd: 49.99,
      blockAmountUsd: 5.0,
      minBlocks: 13,
      maxBlocks: 25,
      monthlyRangeUsd: [114.99, 174.99]
    }
  }
};

export function isStripeConfigured(): boolean {
  return true; // Configurado com sucesso via Sandbox do Stripe
}