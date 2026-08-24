import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ExternalLink, FileText, Link2, Lock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConeXaiLogo } from "@/components/ConeXaiLogo";

interface CampaignPublic {
  id: string;
  company_id: string;
  owner_id: string;
  amount: number;
  status: string;
  title: string | null;
  description: string | null;
  campaign_link: string | null;
  is_public: boolean;
  attachment_urls: string[] | null;
  created_at: string;
}

export default function CampaignPublicPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: camp, error } = await supabase
        .from("campaigns")
        .select("id, company_id, owner_id, amount, status, title, description, campaign_link, is_public, attachment_urls, created_at")
        .eq("id", id)
        .single();
      if (error || !camp) {
        setCampaign(null);
        setLoading(false);
        return;
      }
      const row = camp as Record<string, unknown>;
      const isPublic = row.is_public !== false;
      const { data: { user } } = await supabase.auth.getUser();
      const isOwner = user && (user.id === row.owner_id);
      if (!isPublic && !isOwner) {
        setForbidden(true);
        setCampaign(null);
        setLoading(false);
        return;
      }
      setCampaign({
        id: row.id as string,
        company_id: row.company_id as string,
        owner_id: row.owner_id as string,
        amount: Number(row.amount ?? 0),
        status: (row.status as string) ?? "draft",
        title: (row.title as string) ?? null,
        description: (row.description as string) ?? null,
        campaign_link: (row.campaign_link as string) ?? null,
        is_public: isPublic,
        attachment_urls: Array.isArray(row.attachment_urls) ? (row.attachment_urls as string[]) : null,
        created_at: row.created_at as string,
      });
      const { data: company } = await supabase.from("companies").select("name").eq("id", row.company_id).single();
      setCompanyName((company as { name?: string } | null)?.name ?? null);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="container max-w-2xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-40 w-full rounded-xl mb-4" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-display font-bold mb-2">Campanha privada</h1>
            <p className="text-muted-foreground mb-6">Apenas o dono da campanha e administradores podem ver os detalhes.</p>
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Voltar ao início
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-display font-bold mb-2">Campanha não encontrada</h1>
            <Link to="/">
              <Button variant="outline" className="gap-2 mt-4">
                <ArrowLeft className="w-4 h-4" />
                Voltar ao início
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const attachments = campaign.attachment_urls ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <ConeXaiLogo textClassName="font-display font-bold" showText />
          </Link>
          <span className="w-8" />
        </div>
      </header>

      <div className="container max-w-2xl mx-auto px-4 py-8">
        <Card className="overflow-hidden">
          <CardContent className="p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                {campaign.title || "Campanha"}
              </h1>
              {companyName && (
                <p className="text-sm text-muted-foreground mt-1">Por {companyName}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">
                  R$ {Number(campaign.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-muted-foreground text-sm">valor fixo</span>
              </div>
            </div>

            {campaign.description && (
              <div>
                <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Descrição
                </h2>
                <p className="text-muted-foreground whitespace-pre-wrap">{campaign.description}</p>
              </div>
            )}

            {campaign.campaign_link && (
              <div>
                <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  Link da campanha
                </h2>
                <a
                  href={campaign.campaign_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline break-all"
                >
                  {campaign.campaign_link}
                  <ExternalLink className="w-4 h-4 shrink-0" />
                </a>
              </div>
            )}

            {attachments.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Anexos
                </h2>
                <ul className="space-y-2">
                  {attachments.map((url, i) => (
                    <li key={i}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-primary hover:underline"
                      >
                        {url.split("/").pop() || `Anexo ${i + 1}`}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Interessado? Entre em contato com a empresa pelo dashboard ou pelo mural.
              </p>
              <Link to="/">
                <Button className="mt-3 gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Ver mural
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
