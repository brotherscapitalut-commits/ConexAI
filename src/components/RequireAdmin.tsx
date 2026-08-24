import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  children: React.ReactNode;
};

/**
 * Route guard: only allows access for users with role 'admin'.
 * Non-admin users are redirected to /dashboard.
 */
export default function RequireAdmin({ children }: Props) {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setStatus("denied");
        return;
      }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = roles?.some((r) => r.role === "admin") ?? false;
      if (!cancelled) setStatus(isAdmin ? "allowed" : "denied");
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground font-medium">Verificando acesso...</span>
        </div>
      </div>
    );
  }
  if (status === "denied") {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
