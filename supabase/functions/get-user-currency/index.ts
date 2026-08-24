import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Currency data with BRL exchange rates (approximate)
const COUNTRY_CURRENCY: Record<string, { currency: string; symbol: string; rate_to_brl: number }> = {
  BR: { currency: "BRL", symbol: "R$", rate_to_brl: 1 },
  US: { currency: "USD", symbol: "$", rate_to_brl: 5.5 },
  GB: { currency: "GBP", symbol: "£", rate_to_brl: 7.0 },
  EU: { currency: "EUR", symbol: "€", rate_to_brl: 6.0 },
  DE: { currency: "EUR", symbol: "€", rate_to_brl: 6.0 },
  FR: { currency: "EUR", symbol: "€", rate_to_brl: 6.0 },
  ES: { currency: "EUR", symbol: "€", rate_to_brl: 6.0 },
  IT: { currency: "EUR", symbol: "€", rate_to_brl: 6.0 },
  PT: { currency: "EUR", symbol: "€", rate_to_brl: 6.0 },
  MX: { currency: "MXN", symbol: "MX$", rate_to_brl: 0.32 },
  AR: { currency: "ARS", symbol: "AR$", rate_to_brl: 0.006 },
  CO: { currency: "COP", symbol: "COL$", rate_to_brl: 0.0013 },
  CL: { currency: "CLP", symbol: "CL$", rate_to_brl: 0.006 },
  JP: { currency: "JPY", symbol: "¥", rate_to_brl: 0.037 },
  CN: { currency: "CNY", symbol: "¥", rate_to_brl: 0.76 },
  IN: { currency: "INR", symbol: "₹", rate_to_brl: 0.065 },
  CA: { currency: "CAD", symbol: "CA$", rate_to_brl: 4.0 },
  AU: { currency: "AUD", symbol: "A$", rate_to_brl: 3.6 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get country from CF header or X-Forwarded-For
    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-country") || "BR";
    
    const info = COUNTRY_CURRENCY[country] || COUNTRY_CURRENCY["BR"];
    
    // Base price is 1 unit of local currency
    // But minimum must be equivalent to R$1
    let basePrice = 1;
    if (info.rate_to_brl < 1) {
      // Local currency is worth less than BRL, convert so minimum = R$1
      basePrice = Math.ceil(1 / info.rate_to_brl);
    }

    return new Response(
      JSON.stringify({
        country,
        currency: info.currency,
        symbol: info.symbol,
        base_price: basePrice,
        multipliers: { borda: 1, intermediaria: 2, centro_premium: 5 },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
