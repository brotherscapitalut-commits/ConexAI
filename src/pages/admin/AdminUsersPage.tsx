import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Users, Building2, LogIn, Wallet, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:3001";
const SIMULATE_KEY = "admin_simulate_owner_id";
const INACTIVE_DAYS = 30;

function getAuthHeader(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("local_db_token");
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

interface AdvertiserRow {
  company_id: string;
  owner_id: string;
  company_name: string;
  influencer_credits_balance: number;
  company_created_at: string;
  email: string | null;
  display_name: string | null;
  profile_created_at: string | null;
  last_login_at: string | null;
}

function isInactive(lastLoginAt: string | null): boolean {
  if (!lastLoginAt) return true;
  const last = new Date(lastLoginAt).getTime();
  const cutoff = Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000;
  return last < cutoff;
}

type UserFilterTab = "all" | "active" | "inactive";

export default function AdminUsersPage() {
  const [advertisers, setAdvertisers] = useState<AdvertiserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creditsModal, setCreditsModal] = useState<AdvertiserRow | null>(null);
  const [creditsValue, setCreditsValue] = useState("");
  const [creditsSaving, setCreditsSaving] = useState(false);
  const [userTab, setUserTab] = useState<UserFilterTab>("all");
  const navigate = useNavigate();
  const { toast } = useToast();

  const filteredAdvertisers = advertisers.filter((row) => {
    const inactive = isInactive(row.last_login_at);
    if (userTab === "active") return !inactive;
    if (userTab === "inactive") return inactive;
    return true;
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/advertisers-list`, { headers: getAuthHeader() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[AdminUsers] advertisers-list falhou:", res.status, json?.error?.message);
        setAdvertisers([]);
        return;
      }
      setAdvertisers(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      console.error("[AdminUsers] load:", e);
      setAdvertisers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (creditsModal) {
      setCreditsValue(String(Number(creditsModal.influencer_credits_balance) ?? 0));
    }
  }, [creditsModal]);

  const handleEntrarComoUsuario = (ownerId: string, companyName: string) => {
    localStorage.setItem(SIMULATE_KEY, ownerId);
    localStorage.setItem("admin_simulate_company_name", companyName);
    navigate("/dashboard");
  };

  const handleSaveCredits = async () => {
    if (!creditsModal) return;
    const num = parseFloat(creditsValue.replace(",", "."));
    if (isNaN(num) || num < 0) {
      toast({ title: "Valor inválido", description: "Use um número ≥ 0.", variant: "destructive" });
      return;
    }
    setCreditsSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/adjust-credits`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ company_id: creditsModal.company_id, new_balance: num }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        toast({ title: "Erro", description: json?.error?.message ?? "Falha ao atualizar saldo", variant: "destructive" });
        return;
      }
      toast({ title: "Saldo atualizado", description: `Créditos definidos para R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.` });
      setCreditsModal(null);
      await load();
    } catch (e) {
      console.error("[AdminUsers] handleSaveCredits:", e);
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha na requisição", variant: "destructive" });
    } finally {
      setCreditsSaving(false);
    }
  };

  const formatDate = (s: string | null) => {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return "—";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">CRM de Usuários — Anunciantes</h1>
        <p className="text-sm text-muted-foreground mt-1">Tabela de clientes (empresas), entrar como usuário e gestão de créditos. Filtre por ativos, inativos e mais.</p>
      </div>

      {loading ? (
        <div className="text-muted-foreground py-8">Carregando...</div>
      ) : (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-sm font-display flex items-center gap-2 text-foreground">
              <Building2 className="w-5 h-5 text-primary" />
              Tabela de Clientes — Anunciantes ({filteredAdvertisers.length}{userTab !== "all" ? ` / ${advertisers.length}` : ""})
            </CardTitle>
            <div className="flex gap-2">
              <Button variant={userTab === "all" ? "default" : "outline"} size="sm" onClick={() => setUserTab("all")}>Todos</Button>
              <Button variant={userTab === "active" ? "default" : "outline"} size="sm" onClick={() => setUserTab("active")}>Ativos</Button>
              <Button variant={userTab === "inactive" ? "default" : "outline"} size="sm" onClick={() => setUserTab("inactive")}>Inativos (&gt;30 dias)</Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredAdvertisers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhuma empresa cadastrada.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/50 bg-background/80">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left py-3 px-4 font-medium text-foreground">Nome</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">E-mail</th>
                      <th className="text-right py-3 px-4 font-medium text-foreground">Saldo de Créditos</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground">Data de Cadastro</th>
                      <th className="text-right py-3 px-4 font-medium text-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdvertisers.map((row) => {
                      const inactive = isInactive(row.last_login_at);
                      return (
                        <tr
                          key={row.company_id}
                          className={`border-b border-border/30 transition-colors ${
                            inactive ? "bg-destructive/10 hover:bg-destructive/15" : "hover:bg-muted/20"
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{row.company_name}</span>
                              {inactive && (
                                <span className="inline-flex items-center gap-1 rounded border border-destructive/40 bg-destructive/20 px-1.5 py-0.5 text-xs text-destructive" title="Sem login há mais de 30 dias — reengajamento">
                                  <AlertCircle className="w-3 h-3" /> Inativo
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{row.email ?? "—"}</td>
                          <td className="py-3 px-4 text-right tabular-nums font-medium">
                            R$ {Number(row.influencer_credits_balance ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{formatDate(row.profile_created_at ?? row.company_created_at)}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 shrink-0 border-primary/50 text-primary hover:bg-primary/10"
                                onClick={() => handleEntrarComoUsuario(row.owner_id, row.company_name)}
                                title="Entrar como este usuário (suporte)"
                              >
                                <LogIn className="w-3.5 h-3.5" />
                                Entrar como Usuário
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 shrink-0"
                                onClick={() => setCreditsModal(row)}
                                title="Ajustar saldo de créditos"
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                Ajustar Saldo
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!creditsModal} onOpenChange={(open) => !open && setCreditsModal(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Ajustar saldo de créditos</DialogTitle>
          </DialogHeader>
          {creditsModal && (
            <>
              <p className="text-sm text-muted-foreground">{creditsModal.company_name}</p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Novo saldo (R$)</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={creditsValue}
                  onChange={(e) => setCreditsValue(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreditsModal(null)}>Cancelar</Button>
                <Button onClick={handleSaveCredits} disabled={creditsSaving}>Salvar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { SIMULATE_KEY };
