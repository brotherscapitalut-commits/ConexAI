import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Instagram, Globe, ExternalLink } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ContactEvent {
  id: string;
  from_user_id: string;
  to_company_id: string | null;
  to_influencer_id: string | null;
  contact_type: string;
  created_at: string;
  target_name?: string;
}

interface ContactEventsLogProps {
  userId: string;
  isAdmin?: boolean;
}

const ICONS: Record<string, React.ReactNode> = {
  whatsapp: <Phone className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  instagram: <Instagram className="w-3.5 h-3.5" />,
  website: <Globe className="w-3.5 h-3.5" />,
  tiktok: <ExternalLink className="w-3.5 h-3.5" />,
};

const TYPE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  instagram: "Instagram",
  website: "Website",
  tiktok: "TikTok",
};

const ContactEventsLog = ({ userId, isAdmin = false }: ContactEventsLogProps) => {
  const [events, setEvents] = useState<ContactEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    loadEvents();
  }, [userId]);

  const loadEvents = async () => {
    setLoading(true);
    let query = supabase
      .from("contact_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!isAdmin) {
      query = query.eq("from_user_id", userId);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      const companyIds = data.filter(e => e.to_company_id).map(e => e.to_company_id!);
      const influencerIds = data.filter(e => e.to_influencer_id).map(e => e.to_influencer_id!);

      const [{ data: companies }, { data: influencers }] = await Promise.all([
        companyIds.length > 0 ? supabase.from("companies").select("id, name").in("id", companyIds) : { data: [] },
        influencerIds.length > 0 ? supabase.from("influencers").select("id, name").in("id", influencerIds) : { data: [] },
      ]);

      const nameMap = new Map<string, string>();
      (companies || []).forEach(c => nameMap.set(c.id, c.name));
      (influencers || []).forEach(i => nameMap.set(i.id, i.name));

      setEvents(data.map(e => ({
        ...e,
        target_name: nameMap.get(e.to_company_id || e.to_influencer_id || "") || "—",
      })));
    } else {
      setEvents([]);
    }
    setLoading(false);
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <Phone className="w-5 h-5 text-primary" />
          {t("dash.contacts_done")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("dash.no_contacts_yet")}</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {events.map(event => (
              <div key={event.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30 hover:bg-muted/30 transition-colors">
                <div className="text-muted-foreground">
                  {ICONS[event.contact_type] || <ExternalLink className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{event.target_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleDateString("pt-BR")} às{" "}
                    {new Date(event.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {TYPE_LABELS[event.contact_type] || event.contact_type}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContactEventsLog;
