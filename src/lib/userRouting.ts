import { supabase } from "@/integrations/supabase/client";
import { isSuperAdminEmail } from "@/lib/superAdmin";

/**
 * Profile type for redirect logic.
 * - admin: user_roles.role === 'admin'
 * - company: role === 'advertiser' or user owns at least one company (purchases/dashboard)
 * - influencer: user owns at least one influencer profile
 */
export type UserProfileType = "admin" | "company" | "influencer" | "user";

export type RedirectResult = {
  type: UserProfileType;
  path: string;
};

/**
 * Determines where to send the user after login.
 * - admin → /admin
 * - company (advertiser or has companies) → /dashboard
 * - influencer (has influencer profiles, no company context) → /influencer/:id or /influencers
 * - fallback → /dashboard
 */
export async function getPostLoginRedirect(userId: string): Promise<RedirectResult> {
  try {
    let { data: prof } = await supabase.from("profiles").select("email").eq("user_id", userId).maybeSingle();
    if (!prof) {
      const r2 = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
      prof = r2.data;
    }
    const row = prof as { email?: string } | null;
    if (isSuperAdminEmail(row?.email)) {
      return { type: "admin", path: "/admin" };
    }

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set(roles?.map((r) => r.role) ?? []);

    if (roleSet.has("admin")) {
      return { type: "admin", path: "/admin" };
    }

    const { data: companies } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", userId)
      .limit(1);
    const hasCompanies = companies && companies.length > 0;
    const isAdvertiser = roleSet.has("advertiser");

    if (isAdvertiser || hasCompanies) {
      return { type: "company", path: "/dashboard" };
    }

    const { data: influencers } = await supabase
      .from("influencers")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (influencers && influencers.length > 0) {
      return { type: "influencer", path: "/dashboard/influencer" };
    }

    const { data: profile } = await supabase.from("profiles").select("profile_type").eq("user_id", userId).maybeSingle();
    if (profile?.profile_type === "influencer") {
      return { type: "influencer", path: "/dashboard/influencer" };
    }
  } catch {
    // API local sem user_roles ou erro de rede: envia para dashboard
  }
  return { type: "user", path: "/dashboard" };
}
