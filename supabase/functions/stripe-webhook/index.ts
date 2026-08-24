import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    let event: Stripe.Event;

    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      // For development without webhook signature verification
      event = JSON.parse(body);
    }

    logStep("Event received", { type: event.type });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};
      const companyId = metadata.company_id;
      const type = metadata.type;

      if (type === "credits") {
        const amount = parseFloat(metadata.amount || "0");
        if (companyId && amount > 0) {
          const { data: company } = await supabase.from("companies").select("influencer_credits_balance").eq("id", companyId).single();
          const current = Number(company?.influencer_credits_balance ?? 0);
          await supabase.from("companies").update({ influencer_credits_balance: current + amount }).eq("id", companyId);
          logStep("Credits added to company", { companyId, amount });
        }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      const region = metadata.region;
      const blocksCount = parseInt(metadata.blocks_count || "0");
      const userId = metadata.user_id;

      logStep("Processing checkout", { companyId, region, blocksCount, userId });

      if (!companyId || !region || blocksCount <= 0) {
        logStep("Missing metadata, skipping block assignment");
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // Record the payment
      await supabase.from("payments").insert({
        company_id: companyId,
        amount: session.amount_total || 0,
        blocks_count: blocksCount,
        region,
        status: "completed",
        stripe_session_id: session.id,
        stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      });

      logStep("Payment recorded");

      // Find available blocks in the requested region and assign them
      const regionRanges = {
        borda: { xMin: 0, xMax: 99, yMin: 0, yMax: 49, excludeInner: true },
        intermediaria: { xMin: 20, xMax: 80, yMin: 8, yMax: 42, excludePremium: true },
        centro_premium: { xMin: 35, xMax: 65, yMin: 15, yMax: 35 },
      };

      const range = regionRanges[region as keyof typeof regionRanges];
      if (!range) {
        logStep("Unknown region", { region });
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // Get already occupied blocks
      const { data: occupiedBlocks } = await supabase
        .from("blocks")
        .select("x, y")
        .eq("status", "occupied");

      const occupiedSet = new Set((occupiedBlocks || []).map(b => `${b.x},${b.y}`));

      // Generate available positions in the region
      const availablePositions: { x: number; y: number }[] = [];
      for (let y = range.xMin !== undefined ? range.yMin : 0; y <= range.yMax; y++) {
        for (let x = range.xMin; x <= range.xMax; x++) {
          const key = `${x},${y}`;
          if (occupiedSet.has(key)) continue;

          // Check region constraints
          const isPremium = x >= 35 && x <= 65 && y >= 15 && y <= 35;
          const isIntermediate = x >= 20 && x <= 80 && y >= 8 && y <= 42;

          if (region === "borda" && isIntermediate) continue;
          if (region === "intermediaria" && (isPremium || !isIntermediate)) continue;
          if (region === "centro_premium" && !isPremium) continue;

          availablePositions.push({ x, y });
        }
      }

      logStep("Available positions found", { count: availablePositions.length, needed: blocksCount });

      // Pick the requested number of blocks
      const toAssign = availablePositions.slice(0, blocksCount);

      if (toAssign.length > 0) {
        const blocksToInsert = toAssign.map(pos => ({
          x: pos.x,
          y: pos.y,
          company_id: companyId,
          status: "occupied" as const,
          region: region as "borda" | "intermediaria" | "centro_premium",
        }));

        const { error: insertError } = await supabase.from("blocks").insert(blocksToInsert);
        if (insertError) {
          logStep("Error inserting blocks", { error: insertError.message });
        } else {
          logStep("Blocks assigned successfully", { count: toAssign.length });
        }
      }

      // Set company expiry to 1 year from now
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      await supabase.from("companies").update({
        expires_at: expiresAt.toISOString(),
        moderation_status: "approved",
      }).eq("id", companyId);

      logStep("Company updated with expiry date");

    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const metadata = subscription.metadata || {};
      const companyId = metadata.company_id;

      if (companyId) {
        // Remove blocks when subscription is fully cancelled
        await supabase.from("blocks").delete().eq("company_id", companyId);
        logStep("Blocks removed for cancelled subscription", { companyId });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
