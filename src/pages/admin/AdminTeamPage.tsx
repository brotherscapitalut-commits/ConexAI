import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, ShieldCheck, Trash2, UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:3001";

function getAuthHeader(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("local_db_token");
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

interface AdminRow {
  id: string;
  email: string;
  role: "admin" | "super_admin";
  created_at: string;
}

const GLASS_CARD =
  "rounded-2xl border border-amber-400/30 bg-white/5 backdrop-blur-xl shadow-[0_0_24px_rgba(234,179,8,0.18)]";

export default function AdminTeamPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const { toast } = useToast();

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/rest/admins?select=id,email,role,created_at&order=created_at.desc`,
        { headers: getAuthHeader() }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        console.error("[AdminTeam] loadAdmins:", json?.error || res.statusText);
        setAdmins([]);
      } else {
        setAdmins(Array.isArray(json.data) ? json.data : []);
      }
    } catch (e) {
      console.error("[AdminTeam] loadAdmins:", e);
      setAdmins([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast({ title: "Informe um e-mail válido", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/rest/admins`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ email, role: "admin" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        toast({
          title: "Erro ao adicionar admin",
          description: json?.error?.message ?? "Verifique as permissões ou se o e-mail já está cadastrado.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Admin adicionado",
          description: "Convite registrado. Quando este e-mail criar uma conta, terá acesso de administrador.",
        });
        setNewEmail("");
        await loadAdmins();
      }
    } catch (e) {
      console.error("[AdminTeam] handleAddAdmin:", e);
      toast({
        title: "Erro ao adicionar admin",
        description: e instanceof Error ? e.message : "Falha na requisição",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, role: string) => {
    if (role === "super_admin") {
      toast({
        title: "Proteção de Super Admin",
        description: "O super administrador original não pode ser removido por este painel.",
        variant: "destructive",
      });
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`${API}/api/rest/admins?id=eq.${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        toast({
          title: "Erro ao remover admin",
          description: json?.error?.message ?? "Falha ao remover privilégios.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Admin removido", description: "Privilégios revogados com sucesso." });
        await loadAdmins();
      }
    } catch (e) {
      console.error("[AdminTeam] handleDelete:", e);
      toast({
        title: "Erro ao remover admin",
        description: e instanceof Error ? e.message : "Falha na requisição",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-400" />
            Gestão de Equipe
          </h1>
          <p className="text-sm text-muted-foreground">
            Controle quem tem acesso administrativo à ConeXai. Convide novos administradores ou remova privilégios em tempo real.
          </p>
        </div>
      </div>

      <Card className={GLASS_CARD}>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-display">
              <UserPlus className="w-4 h-4 text-amber-400" />
              Convidar novo admin
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Informe o e-mail corporativo. Mesmo que ainda não tenha conta, o convite ficará registrado.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddAdmin} className="flex flex-col sm:flex-row gap-3">
            <Input
              type="email"
              placeholder="email@empresa.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1 bg-background/60"
            />
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Adicionar admin
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className={GLASS_CARD}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-display">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            Administradores atuais
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Carregando equipe...
            </div>
          ) : admins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhum admin cadastrado além do super administrador. Use o formulário acima para convidar novos membros.
            </p>
          ) : (
            <div className="space-y-2">
              {admins.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-black/30 px-3 py-2.5"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{a.email}</span>
                      {a.role === "super_admin" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-100 font-semibold">
                          SUPER ADMIN
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Desde {new Date(a.created_at).toLocaleDateString("pt-BR")} •{" "}
                      {a.role === "admin" ? "Admin" : "Super Admin"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={deletingId === a.id || a.role === "super_admin"}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => handleDelete(a.id, a.role)}
                  >
                    {deletingId === a.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

