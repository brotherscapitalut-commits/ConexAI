import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Usuário não autenticado");

    const body = await req.json();
    const { price_id, quantity, region, company_id, years, success_url, cancel_url } = body;
    if (!price_id || !quantity || !region) throw new Error("Dados incompletos");

    const baseUrl = (req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "").replace(/\/$/, "");
    let success = `${baseUrl}/dashboard?payment=success`;
    let cancel = `${baseUrl}/precos?payment=canceled`;
    if (success_url && typeof success_url === "string" && success_url.startsWith(baseUrl)) {
      try {
        const pathname = new URL(success_url).pathname;
        if (pathname === "/dashboard" || pathname.startsWith("/empresa/")) success = success_url;
      } catch (_) {}
    }
    if (cancel_url && typeof cancel_url === "string" && cancel_url.startsWith(baseUrl)) cancel = cancel_url;

    // Server-side block limits per region
    const maxBlocks: Record<string, number> = { borda: 6, intermediaria: 12, centro_premium: 25 };
    const regionMax = maxBlocks[region];
    if (regionMax && quantity > regionMax) {
      throw new Error(`Limite máximo para ${region}: ${regionMax} blocos`);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Use subscription mode for automatic yearly renewal; success always goes to company dashboard
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: price_id, quantity }],
      mode: "subscription",
      success_url: success,
      cancel_url: cancel,
      metadata: {
        user_id: user.id,
        company_id: company_id || "",
        region,
        blocks_count: String(quantity),
        years: String(years || 1),
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          company_id: company_id || "",
          region,
          blocks_count: String(quantity),
          years: String(years || 1),
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
