import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Usuário não autenticado");

    const body = await req.json();
    const { company_id, amount } = body;
    if (!company_id || amount == null || amount < 1) throw new Error("Informe company_id e amount (valor em reais >= 1)");

    const amountNum = typeof amount === "string" ? parseFloat(amount.replace(",", ".")) : Number(amount);
    if (isNaN(amountNum) || amountNum < 1) throw new Error("Valor inválido");

    const { data: company } = await supabaseClient
      .from("companies")
      .select("id, owner_id")
      .eq("id", company_id)
      .single();
    if (!company || company.owner_id !== user.id) throw new Error("Empresa não encontrada ou você não é o dono");

    const priceId = Deno.env.get("STRIPE_CREDITS_PRICE_ID");
    if (!priceId) throw new Error("Checkout de créditos não configurado (STRIPE_CREDITS_PRICE_ID). Use um preço em BRL com valor unitário 1 (ex.: R$ 1,00 por unidade).");

    const baseUrl = (req.headers.get("origin") || req.headers.get("referer") || "").replace(/\/$/, "") || "http://localhost:5173";
    const success = `${baseUrl}/dashboard?payment=credits&success=1`;
    const cancel = `${baseUrl}/dashboard?payment=credits&cancel=1`;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const session = await stripe.checkout.sessions.create({
      customer: customerId ?? undefined,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: Math.round(amountNum) }],
      mode: "payment",
      success_url: success,
      cancel_url: cancel,
      metadata: {
        type: "credits",
        company_id,
        amount: String(amountNum),
        user_id: user.id,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message ?? "Erro ao criar checkout" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
