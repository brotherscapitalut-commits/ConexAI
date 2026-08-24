import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Ban } from "lucide-react";

interface Subscription {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string;
  quantity: number;
  metadata: Record<string, string>;
}

interface SubscriptionListProps {
  subscriptions: Subscription[];
  onCancel: (subscriptionId: string) => void;
}

const regionLabels: Record<string, string> = {
  borda: "Borda",
  intermediaria: "Intermediária",
  centro_premium: "Centro Premium",
};

const SubscriptionList = ({ subscriptions, onCancel }: SubscriptionListProps) => {
  if (subscriptions.length === 0) return null;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Assinaturas Ativas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div>
                <div className="font-medium">
                  {sub.quantity} bloco(s) — {regionLabels[sub.metadata?.region] || sub.metadata?.region || "N/A"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Renova em: {new Date(sub.current_period_end).toLocaleDateString("pt-BR")}
                </div>
                {sub.cancel_at_period_end && (
                  <span className="text-xs text-destructive font-medium">Cancelamento agendado</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  sub.cancel_at_period_end
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary"
                }`}>
                  {sub.cancel_at_period_end ? "Não renovará" : "Renovação automática"}
                </span>
                {!sub.cancel_at_period_end && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onCancel(sub.id)}
                  >
                    <Ban className="w-4 h-4 mr-1" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SubscriptionList;
