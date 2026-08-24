/**
 * Centro de notificações (sino) + pop-ups para lances recebidos.
 * Regra de ouro: exibir sempre apenas o valor líquido (oferta - 30% plataforma).
 * Nunca mostrar porcentagem da plataforma ao usuário.
 */
import { useState, useEffect, useRef } from "react";
import { Bell, Mail } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { localDb } from "@/lib/localDbClient";

const API = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:3001";

export interface NotificationItem {
  id: string;
  type: "bid_received" | "campaign_created" | "proposal" | "generic";
  title: string;
  description?: string;
  valorLiquido?: number;
  createdAt: Date;
  read?: boolean;
}

interface NotificationsCenterProps {
  companyIds: string[];
  /** Notificações já existentes (ex.: campaign_created) para exibir no centro */
  existingItems?: NotificationItem[];
  onNewBid?: () => void;
}

function getAuthHeader(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("local_db_token");
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export default function NotificationsCenter({
  companyIds,
  existingItems = [],
  onNewBid,
}: NotificationsCenterProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>(existingItems);
  const [lastBidIds, setLastBidIds] = useState<Set<string>>(new Set());
  const [emailNotifyBids, setEmailNotifyBids] = useState(true);
  const { toast } = useToast();
  const initialFetch = useRef(false);

  useEffect(() => {
    fetch(`${API}/api/auth/email-notify-bids`, { headers: getAuthHeader() })
      .then((r) => r.json())
      .then((json) => {
        if (json?.data?.email_notify_bids !== undefined) setEmailNotifyBids(json.data.email_notify_bids);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setItems((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      existingItems.forEach((e) => byId.set(e.id, e));
      return Array.from(byId.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, [existingItems]);

  useEffect(() => {
    if (!companyIds.length) return;

    const fetchBids = async () => {
      const { data } = await localDb
        .from("position_bids" as any)
        .select("id, to_brand_id, amount, status, created_at")
        .in("to_brand_id", companyIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      const rows = (data ?? []) as { id: string; to_brand_id: string; amount: number; status: string; created_at: string }[];
      const pendingIds = new Set(rows.map((r) => r.id));

      if (!initialFetch.current) {
        initialFetch.current = true;
        setLastBidIds(pendingIds);
        rows.forEach((r) => {
          const valorLiquido = r.amount * 0.7;
          setItems((prev) => {
            if (prev.some((p) => p.id === `bid-${r.id}`)) return prev;
            return [
              {
                id: `bid-${r.id}`,
                type: "bid_received",
                title: "Nova oferta recebida",
                description: `Valor que você recebe: R$ ${valorLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                valorLiquido,
                createdAt: new Date(r.created_at),
                read: false,
              },
              ...prev.slice(0, 29),
            ];
          });
        });
        return;
      }

      const newBids = rows.filter((r) => !lastBidIds.has(r.id));
      setLastBidIds(pendingIds);

      for (const r of newBids) {
        const valorLiquido = r.amount * 0.7;
        toast({
          title: "Nova oferta!",
          description: `Você recebeu uma oferta de R$ ${valorLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}!`,
        });
        setItems((prev) => [
          {
            id: `bid-${r.id}`,
            type: "bid_received",
            title: "Nova oferta recebida",
            description: `Valor que você recebe: R$ ${valorLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            valorLiquido,
            createdAt: new Date(r.created_at),
            read: false,
          },
          ...prev.filter((p) => p.id !== `bid-${r.id}`).slice(0, 29),
        ]);
        onNewBid?.();
        try {
          await fetch(`${API}/api/notify-bid-email`, {
            method: "POST",
            headers: getAuthHeader(),
            body: JSON.stringify({ bid_id: r.id, to_brand_id: r.to_brand_id, amount: r.amount }),
          });
        } catch (_) {}
      }
    };

    fetchBids();
    const interval = setInterval(fetchBids, 25000);
    return () => clearInterval(interval);
  }, [companyIds.join(","), toast, onNewBid]);

  const unreadCount = items.filter((i) => !i.read).length;
  const displayList = items.slice(0, 10);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
          title="Notificações"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 rounded-xl border border-white/10 bg-card shadow-xl z-[200]" align="end">
        <div className="p-3 border-b border-white/10">
          <h3 className="font-display font-semibold text-foreground text-sm">Notificações</h3>
        </div>
        <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer" htmlFor="email-notify-bids">
            <Mail className="w-3.5 h-3.5" />
            Desejo receber avisos de lances por e-mail
          </label>
          <button
            id="email-notify-bids"
            type="button"
            role="switch"
            aria-checked={emailNotifyBids}
            onClick={() => {
              const next = !emailNotifyBids;
              setEmailNotifyBids(next);
              fetch(`${API}/api/auth/email-notify-bids`, {
                method: "PATCH",
                headers: getAuthHeader(),
                body: JSON.stringify({ email_notify_bids: next }),
              })
                .then((r) => r.json())
                .then(() => {
                  toast({ title: next ? "E-mails ativados" : "E-mails desativados", description: next ? "Você receberá avisos de ofertas por e-mail." : "Você não receberá mais avisos de ofertas por e-mail." });
                })
                .catch(() => {
                  fetch(`${API}/api/auth/email-notify-bids`, { headers: getAuthHeader() })
                    .then((r) => r.json())
                    .then((json) => { if (json?.data?.email_notify_bids !== undefined) setEmailNotifyBids(json.data.email_notify_bids); });
                });
            }}
            className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${emailNotifyBids ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${emailNotifyBids ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          {displayList.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4">Nenhuma notificação recente.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {displayList.map((n) => (
                <li
                  key={n.id}
                  className="px-3 py-2.5 hover:bg-white/5 transition-colors cursor-default"
                  onClick={() => setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)))}
                >
                  <p className="font-medium text-foreground text-sm">{n.title}</p>
                  {n.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {n.createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
