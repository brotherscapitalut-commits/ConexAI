import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard } from "lucide-react";

interface PaymentHistoryProps {
  payments: any[];
}

const PaymentHistory = ({ payments }: PaymentHistoryProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg flex items-center gap-2">
        <CreditCard className="w-4 h-4" />
        Histórico de Pagamentos
      </CardTitle>
    </CardHeader>
    <CardContent>
      {payments.length > 0 ? (
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border text-sm">
              <div>
                <span className="font-medium">{p.blocks_count} blocos</span>
                <span className="text-muted-foreground ml-2">({p.region})</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.status === "completed" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {p.status === "completed" ? "Pago" : p.status === "pending" ? "Pendente" : p.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-muted-foreground">Nenhum pagamento registrado</div>
      )}
    </CardContent>
  </Card>
);

export default PaymentHistory;
