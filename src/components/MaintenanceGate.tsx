// src/components/MaintenanceGate.tsx
import { useState, useEffect } from "react";
import { LOCAL_API_URL } from "@/lib/localApi";
import { useUserProfile } from "@/hooks/useUserProfile";

/**
 * 🔥 GATE DE MANUTENÇÃO (BYPASS)
 * Agora sincronizado com o Bypass Total do perfil.
 * Admins Master nunca são bloqueados pela tela de manutenção.
 */
export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [maintenance, setMaintenance] = useState(false);
  const { isSuperAdmin, loading } = useUserProfile();

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        // Tenta checar modo de manutenção no servidor local
        const res = await fetch(`${LOCAL_API_URL}/api/maintenance-mode`).catch(() => null);
        if (!res || !res.ok) {
          if (!cancelled) setMaintenance(false); // Fallback: sistema disponível se API falhar
          return;
        }
        const json = await res.json().catch(() => ({}));
        if (!cancelled) setMaintenance(!!json.enabled);
      } catch {
        if (!cancelled) setMaintenance(false);
      }
    };

    check();
    const t = setInterval(check, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Se estiver carregando o bypass inicial, mostra nada ou loader
  if (loading) return null;

  // Bloqueia apenas se estiver em manutenção E o usuário NÃO for o Admin Master
  if (maintenance && !isSuperAdmin) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0a] backdrop-blur-md">
        <div className="text-center max-w-md mx-4 p-8 rounded-2xl border border-primary/20 bg-primary/5 shadow-2xl">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
             <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Nexus em Manutenção</h1>
          <p className="text-white/40 text-sm font-mono leading-relaxed">
            O Nexus Pulse está em fase de recalibração. <br /> Retorne em instantes para continuar as transações.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
