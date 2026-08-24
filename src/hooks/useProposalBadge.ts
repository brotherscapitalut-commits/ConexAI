import { useState, useEffect } from "react";
import { localDb } from "@/lib/localDbClient";

/** Empresa: propostas pendentes recebidas. Influencer: propostas com nova atividade (pending + counter_offer). */
export function useProposalBadge(
  userId: string | null,
  options: { mode: "company" | "influencer"; companyIds?: string[] }
) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    if (options.mode === "company") {
      const ids = options.companyIds ?? [];
      if (ids.length === 0) {
        setCount(0);
        return;
      }
      localDb
        .from("partnership_proposals")
        .select("id")
        .in("to_company_id", ids)
        .eq("status", "pending")
        .then(({ data, error }) => {
          if (error) {
            setCount(0);
            return;
          }
          const arr = Array.isArray(data) ? data : data ? [data] : [];
          setCount(arr.length);
        });
      return;
    }
    localDb
      .from("partnership_proposals")
      .select("id")
      .eq("from_user_id", userId)
      .then(({ data, error }) => {
        if (error) {
          setCount(0);
          return;
        }
        const arr = Array.isArray(data) ? data : data ? [data] : [];
        const withActivity = arr.filter(
          (r: { status?: string }) => r.status === "pending" || r.status === "counter_offer"
        );
        setCount(withActivity.length);
      });
  }, [userId, options.mode, (options.companyIds ?? []).join(",")]);

  return count;
}
