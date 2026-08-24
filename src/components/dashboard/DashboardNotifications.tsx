import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface DashboardNotificationItem {
  id: string;
  type: "campaign_created" | "proposal_received" | "offer_accepted" | "generic";
  title: string;
  description?: string;
  createdAt: Date;
}

interface DashboardNotificationsProps {
  items: DashboardNotificationItem[];
  maxItems?: number;
  className?: string;
}

/** Seção de notificações recentes com ícone Bell (Lucide). */
export default function DashboardNotifications({
  items,
  maxItems = 5,
  className = "",
}: DashboardNotificationsProps) {
  const list = items.slice(0, maxItems);

  return (
    <Card className={`rounded-2xl border-white/10 bg-white/5 backdrop-blur-md overflow-hidden ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-foreground text-sm">Notificações recentes</h3>
        </div>
        {list.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Nenhuma notificação recente.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((n) => (
              <li
                key={n.id}
                className="text-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 flex flex-col gap-0.5"
              >
                <span className="font-medium text-foreground">{n.title}</span>
                {n.description && <span className="text-muted-foreground">{n.description}</span>}
                <span className="text-[10px] text-muted-foreground">
                  {n.createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

