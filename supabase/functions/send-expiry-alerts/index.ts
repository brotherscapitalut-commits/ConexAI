import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const alerts = [
      { days: 30, label: "30 dias" },
      { days: 7, label: "7 dias" },
      { days: 1, label: "1 dia" },
    ];

    const results: any[] = [];

    for (const alert of alerts) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + alert.days);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: companies } = await supabase
        .from("companies")
        .select("id, name, owner_id, expires_at, contact_email")
        .gte("expires_at", startOfDay.toISOString())
        .lte("expires_at", endOfDay.toISOString());

      if (!companies || companies.length === 0) continue;

      for (const company of companies) {
        // Get owner email from auth
        const { data: userData } = await supabase.auth.admin.getUserById(company.owner_id);
        const email = company.contact_email || userData?.user?.email;

        if (!email) continue;

        // In production, integrate with an email service (Resend, SendGrid, etc.)
        // For now, log the alert
        console.log(`ALERT: ${company.name} expires in ${alert.label} - notify ${email}`);
        results.push({
          company: company.name,
          email,
          days_until_expiry: alert.days,
        });
      }
    }

    return new Response(
      JSON.stringify({ alerts_sent: results.length, details: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Expiry alert error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
