import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  ExternalLink,
  Mail,
  Phone,
  Globe,
  MapPin,
  Users,
  DollarSign,
  Trophy,
  Tag,
  Blocks,
  MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ContactButton from "@/components/ContactButton";

const CompanyProfile = () => {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clickCount, setClickCount] = useState(0);
  const [blockCount, setBlockCount] = useState(0);
  const [rankPosition, setRankPosition] = useState<number | null>(null);
  const [categoryRank, setCategoryRank] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await supabase.from("companies").select("*").eq("id", id).single();
      if (data) {
        setCompany(data);

        const { count: clicks } = await supabase
          .from("clicks")
          .select("*", { count: "exact", head: true })
          .eq("company_id", id);
        setClickCount(clicks || 0);

        const { count: blocks } = await supabase
          .from("blocks")
          .select("*", { count: "exact", head: true })
          .eq("company_id", id);
        setBlockCount(blocks || 0);

        const { data: allCompanies } = await supabase
          .from("companies")
          .select("id, category")
          .eq("moderation_status", "approved");

        if (allCompanies) {
          const clickCounts: { id: string; category: string; clicks: number }[] = [];
          for (const c of allCompanies) {
            const { count } = await supabase
              .from("clicks")
              .select("*", { count: "exact", head: true })
              .eq("company_id", c.id);
            clickCounts.push({ id: c.id, category: c.category, clicks: count || 0 });
          }
          clickCounts.sort((a, b) => b.clicks - a.clicks);
          const generalPos = clickCounts.findIndex((c) => c.id === id) + 1;
          setRankPosition(generalPos > 0 ? generalPos : null);

          const sameCat = clickCounts.filter((c) => c.category === data.category);
          const catPos = sameCat.findIndex((c) => c.id === id) + 1;
          setCategoryRank(catPos > 0 ? catPos : null);
        }
      }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gold-gradient">
        <div className="container mx-auto px-6 py-8 max-w-3xl">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="h-48 w-full rounded-2xl mb-6" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gold-gradient flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold mb-2">Empresa não encontrada</h1>
          <Link to="/">
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gold-gradient">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <Blocks className="w-5 h-5 text-primary" />
            <span className="font-display font-bold">ConeXai</span>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        <Card className="mb-6 overflow-hidden">
          <div
            className="h-24 w-full"
            style={{ background: `linear-gradient(135deg, ${company.color}, ${company.color}88)` }}
          />
          <CardContent className="pt-0 -mt-10">
            <div className="flex items-end gap-4 mb-4">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold border-4 border-background shadow-lg shrink-0"
                style={{ backgroundColor: company.color, color: "#fff" }}
              >
                {company.logo_url ? (
                  <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  company.logo_initials
                )}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <h1 className="text-2xl font-display font-bold truncate">{company.name}</h1>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <Badge variant="secondary">{company.category}</Badge>
                  {company.moderation_status === "approved" && (
                    <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Verificado</Badge>
                  )}
                </div>
              </div>
            </div>

            {company.description && <p className="text-muted-foreground mb-4">{company.description}</p>}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <MousePointerClick className="w-4 h-4 mx-auto mb-1 text-primary" />
                <div className="font-bold text-lg">{clickCount.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Cliques</div>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <Blocks className="w-4 h-4 mx-auto mb-1 text-primary" />
                <div className="font-bold text-lg">{blockCount}</div>
                <div className="text-xs text-muted-foreground">Blocos</div>
              </div>
              {rankPosition && (
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <Trophy className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <div className="font-bold text-lg">#{rankPosition}</div>
                  <div className="text-xs text-muted-foreground">Ranking Geral</div>
                </div>
              )}
              {categoryRank && (
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <Tag className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <div className="font-bold text-lg">#{categoryRank}</div>
                  <div className="text-xs text-muted-foreground">Na Categoria</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {company.product_service && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Produto / Serviço</h3>
                <p className="text-sm">{company.product_service}</p>
              </CardContent>
            </Card>
          )}
          {company.target_audience && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Público-Alvo
                </h3>
                <p className="text-sm">{company.target_audience}</p>
              </CardContent>
            </Card>
          )}
          {company.avg_budget && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Orçamento Médio
                </h3>
                <p className="text-sm">{company.avg_budget}</p>
              </CardContent>
            </Card>
          )}
          {company.region && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Região
                </h3>
                <p className="text-sm">{company.region}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Contact with tracking */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-display font-semibold mb-3">Contato</h3>
            <div className="flex flex-wrap gap-2">
              {company.website && (
                <ContactButton
                  href={company.website}
                  icon={<Globe className="w-4 h-4" />}
                  label="Website"
                  contactType="website"
                  companyId={id}
                />
              )}
              {company.contact_email && (
                <ContactButton
                  href={`mailto:${company.contact_email}`}
                  icon={<Mail className="w-4 h-4" />}
                  label="E-mail"
                  contactType="email"
                  companyId={id}
                  external={false}
                />
              )}
              {company.contact_whatsapp && (
                <ContactButton
                  href={`https://wa.me/${company.contact_whatsapp}`}
                  icon={<Phone className="w-4 h-4" />}
                  label="WhatsApp"
                  contactType="whatsapp"
                  companyId={id}
                />
              )}
              {company.instagram && (
                <ContactButton
                  href={`https://instagram.com/${company.instagram}`}
                  icon={<ExternalLink className="w-4 h-4" />}
                  label="Instagram"
                  contactType="instagram"
                  companyId={id}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompanyProfile;
