// src/components/admin/AdminMasterGuard.tsx
import { Navigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";

/**
 * 🔥 GUARD SIMPLIFICADO (BYPASS)
 * Agora utiliza apenas o estado estático do useUserProfile.
 * Se o bypass estiver ativo, o acesso é concedido instantaneamente.
 */
export default function AdminMasterGuard({ children }: { children: React.ReactNode }) {
  const { profileType, loading, isSuperAdmin } = useUserProfile();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-primary/60 font-medium font-mono">NEXUS PULSE: Verificando Credenciais...</span>
        </div>
      </div>
    );
  }

  // Se o perfil for admin ou for superAdmin pelo bypass, libera.
  if (profileType !== "admin" && !isSuperAdmin) {
    console.warn("Acesso negado - Redirecionando para Dashboard.");
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
