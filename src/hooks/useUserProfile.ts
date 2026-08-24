// src/hooks/useUserProfile.ts
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { UserProfileType } from "@/lib/userRouting";

type UserProfileState = {
  user: User | null;
  profileType: UserProfileType | null;
  loading: boolean;
  displayName: string | null;
  isSuperAdmin: boolean;
  canUseBrandMessaging: boolean;
};

/**
 * 🔥 BYPASS TOTAL DE AUTENTICAÇÃO
 * Este hook não consulta mais o banco de dados.
 * Ele retorna sempre o perfil de Administrador Master para desenvolvimento local.
 */
export function useUserProfile(): UserProfileState {
  const [user, setUser] = useState<User | null>(null);
  const [profileType, setProfileType] = useState<UserProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canUseBrandMessaging, setCanUseBrandMessaging] = useState(false);

  useEffect(() => {
    // Definindo usuário estático (Admin Master)
    const fakeUser = {
      email: "brotherscapitalut@gmail.com",
      id: "9134419b-e855-4081-9b63-0c46001712a8",
      user_metadata: { display_name: "Admin Master" }
    } as User;

    setUser(fakeUser);
    setProfileType("admin");
    setIsSuperAdmin(true);
    setDisplayName("Admin Master (Nexus Bypass)");
    setCanUseBrandMessaging(true);
    setLoading(false);

    console.log("🚀 [SYSTEM] Bypass Ativo - Perfil Admin Concedido.");
  }, []);

  return { user, profileType, loading, displayName, isSuperAdmin, canUseBrandMessaging };
}
