import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { localDb } from "@/lib/localDbClient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, Building2, UserCircle, Globe } from "lucide-react";

const SUPER_ADMIN_EMAIL = "brotherscapitalut@gmail.com";

export default function AdminQuickJump() {
  const { user } = useUserProfile();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const email = (user?.email ?? "").toLowerCase().trim();
      if (!email) {
        if (!cancelled) setIsAdmin(false);
        return;
      }

      // Super Admin original mantém acesso permanente mesmo que algo aconteça à tabela.
      if (email === SUPER_ADMIN_EMAIL) {
        if (!cancelled) setIsAdmin(true);
        return;
      }

      try {
        const { data, error } = await localDb.from("admins").select("id, role").eq("email", email);
        const row = Array.isArray(data) ? data[0] : data;
        if (!cancelled) setIsAdmin(!error && !!row);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  if (!isAdmin) return null;

  return (
    <div className="fixed top-20 left-4 z-[60]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-background/90 backdrop-blur border-white/20 shadow-lg text-xs font-medium"
          >
            Admin Quick Jump
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px]">
          <DropdownMenuItem asChild>
            {/*
              Aponta para /admin (painel com sidebar e sub-páginas), o mesmo
              destino do menu da navbar. Antes levava a /admin-master, então
              "ir para o admin" significava telas diferentes dependendo de onde
              você clicava.
            */}
            <Link to="/admin" className="flex items-center gap-2 cursor-pointer">
              <LayoutDashboard className="w-4 h-4" />
              Painel Admin
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/dashboard" className="flex items-center gap-2 cursor-pointer">
              <Building2 className="w-4 h-4" />
              Dashboard Empresa
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/dashboard/influencer" className="flex items-center gap-2 cursor-pointer">
              <UserCircle className="w-4 h-4" />
              Dashboard Influencer
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/" className="flex items-center gap-2 cursor-pointer">
              <Globe className="w-4 h-4" />
              Mural Público
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
