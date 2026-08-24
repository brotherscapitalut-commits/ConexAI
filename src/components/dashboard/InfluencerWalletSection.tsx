import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Wallet, CreditCard, Loader2, Send } from "lucide-react";

export default function InfluencerWalletSection({ userId }: { userId: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<"cpf" | "email" | "phone" | "random">("cpf");
  const [requesting, setRequesting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("withdrawable_balance")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        setBalance(Number((data as { withdrawable_balance?: number })?.withdrawable_balance) || 0);
        setLoading(false);
      });
  }, [userId]);

  const handleRequestWithdraw = async () => {
    const key = pixKey.trim();
    if (!key) {
      toast({ title: "Informe a chave PIX.", variant: "destructive" });
      return;
    }
    const amount = balance ?? 0;
    if (amount < 10) {
      toast({ title: "Saldo mínimo para saque: R$ 10,00.", variant: "destructive" });
      return;
    }
    setRequesting(true);
    const { data, error } = await supabase.rpc("request_withdrawal", {
      amount_to_withdraw: amount,
      pix_key: key,
      pix_key_type: pixKeyType,
    });
    setRequesting(false);
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      toast({ title: "Erro ao solicitar saque", description: (result?.error as string) || error?.message || "Tente novamente.", variant: "destructive" });
      return;
    }
    toast({ title: "Solicitação enviada!", description: "Seu saque será processado em até 1 dia útil. Transferência para conta ou cartão conforme os dados informados." });
    setWithdrawModal(false);
    setPixKey("");
    setBalance(0);
  };

  return (
    <section className="mb-10">
      <h2 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
        <Wallet className="w-5 h-5 text-primary" />
        Carteira
      </h2>
      <Card className="rounded-2xl border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground mb-4">
            Saldo disponível para saque. Transfira para sua conta ou cartão via PIX.
          </p>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 rounded-xl bg-primary/10 border border-primary/20 mb-4">
                <span className="text-sm font-medium text-muted-foreground">Saldo disponível</span>
                <span className="text-2xl font-display font-bold text-primary tabular-nums">
                  R$ {(balance ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => setWithdrawModal(true)}
                disabled={(balance ?? 0) < 10}
              >
                <CreditCard className="w-4 h-4" />
                Solicitar Saque via PIX
              </Button>
              {(balance ?? 0) < 10 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">Saldo mínimo para saque: R$ 10,00.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {withdrawModal && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setWithdrawModal(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm z-50 rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <h3 className="font-display font-bold text-lg mb-4">Solicitar Saque via PIX</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Informe sua chave PIX para receber R$ {(balance ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. A transferência será feita para sua conta ou cartão em até 1 dia útil.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Tipo de chave</label>
                <select
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value as "cpf" | "email" | "phone" | "random")}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave aleatória</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Chave PIX</label>
                <Input
                  placeholder={pixKeyType === "email" ? "seu@email.com" : pixKeyType === "phone" ? "(11) 99999-9999" : "Digite a chave"}
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setWithdrawModal(false)}>Cancelar</Button>
                <Button className="flex-1 gap-2" onClick={handleRequestWithdraw} disabled={requesting}>
                  {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Solicitar
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
