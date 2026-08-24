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
  Trophy,
  Tag,
  Blocks,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ContactButton from "@/components/ContactButton";

const InfluencerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const [influencer, setInfluencer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rankPosition, setRankPosition] = useState<number | null>(null);
  const [categoryRank, setCategoryRank] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await supabase.from("influencers").select("*").eq("id", id).single();
      if (data) {
        setInfluencer(data);

        const { data: all } = await supabase
          .from("influencers")
          .select("id, category, followers_count")
          .eq("moderation_status", "approved")
          .order("followers_count", { ascending: false });

        if (all) {
          const generalPos = all.findIndex((i) => i.id === id) + 1;
          setRankPosition(generalPos > 0 ? generalPos : null);

          const sameCat = all.filter((i) => i.category === data.category);
          const catPos = sameCat.findIndex((i) => i.id === id) + 1;
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

  if (!influencer) {
    return (
      <div className="min-h-screen bg-gold-gradient flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold mb-2">Influencer não encontrado</h1>
          <Link to="/">
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>
      </div>
    );
  }

  const formatFollowers = (count: number) => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return count.toString();
  };

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
            style={{ background: `linear-gradient(135deg, ${influencer.color}, ${influencer.color}88)` }}
          />
          <CardContent className="pt-0 -mt-10">
            <div className="flex items-end gap-4 mb-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 border-background shadow-lg shrink-0 overflow-hidden"
                style={{ backgroundColor: influencer.color, color: "#fff" }}
              >
                {influencer.photo_url ? (
                  <img src={influencer.photo_url} alt={influencer.name} className="w-full h-full object-cover" />
                ) : (
                  influencer.logo_initials
                )}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <h1 className="text-2xl font-display font-bold truncate">{influencer.name}</h1>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <Badge variant="secondary">{influencer.category}</Badge>
                  {influencer.niche && <Badge variant="outline">{influencer.niche}</Badge>}
                  {influencer.moderation_status === "approved" && (
                    <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Verificado</Badge>
                  )}
                </div>
              </div>
            </div>

            {influencer.bio && <p className="text-muted-foreground mb-4">{influencer.bio}</p>}

            <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-3">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <Users className="w-4 h-4 mx-auto mb-1 text-primary" />
                <div className="font-bold text-lg">{formatFollowers(influencer.followers_count || 0)}</div>
                <div className="text-xs text-muted-foreground">Seguidores (informado pelo criador)</div>
              </div>
              {rankPosition != null && (
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <Trophy className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <div className="font-bold text-lg">#{rankPosition}</div>
                  <div className="text-xs text-muted-foreground">Ranking geral</div>
                </div>
              )}
              {categoryRank != null && (
                <div className="rounded-xl bg-muted/50 p-3 text-center">
                  <Tag className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <div className="font-bold text-lg">#{categoryRank}</div>
                  <div className="text-xs text-muted-foreground">Na categoria</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {influencer.region && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Região
                </h3>
                <p className="text-sm">{influencer.region}</p>
              </CardContent>
            </Card>
          )}
          {influencer.portfolio_url && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" /> Portfólio
                </h3>
                <a
                  href={influencer.portfolio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Ver portfólio →
                </a>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Contact & Social with tracking */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-display font-semibold mb-3">Contato e Redes Sociais</h3>
            <div className="flex flex-wrap gap-2">
              {influencer.contact_email && (
                <ContactButton
                  href={`mailto:${influencer.contact_email}`}
                  icon={<Mail className="w-4 h-4" />}
                  label="E-mail"
                  contactType="email"
                  influencerId={id}
                  external={false}
                />
              )}
              {influencer.contact_whatsapp && (
                <ContactButton
                  href={`https://wa.me/${influencer.contact_whatsapp}`}
                  icon={<Phone className="w-4 h-4" />}
                  label="WhatsApp"
                  contactType="whatsapp"
                  influencerId={id}
                />
              )}
              {influencer.website && (
                <ContactButton
                  href={influencer.website}
                  icon={<Globe className="w-4 h-4" />}
                  label="Website"
                  contactType="website"
                  influencerId={id}
                />
              )}
              {influencer.instagram && (
                <ContactButton
                  href={`https://instagram.com/${influencer.instagram}`}
                  icon={<ExternalLink className="w-4 h-4" />}
                  label="Instagram"
                  contactType="instagram"
                  influencerId={id}
                />
              )}
              {influencer.tiktok && (
                <ContactButton
                  href={`https://tiktok.com/@${influencer.tiktok}`}
                  icon={<ExternalLink className="w-4 h-4" />}
                  label="TikTok"
                  contactType="tiktok"
                  influencerId={id}
                />
              )}
              {influencer.youtube && (
                <ContactButton
                  href={`https://youtube.com/@${influencer.youtube}`}
                  icon={<ExternalLink className="w-4 h-4" />}
                  label="YouTube"
                  contactType="youtube"
                  influencerId={id}
                />
              )}
              {influencer.twitter && (
                <ContactButton
                  href={`https://x.com/${influencer.twitter}`}
                  icon={<ExternalLink className="w-4 h-4" />}
                  label="X / Twitter"
                  contactType="twitter"
                  influencerId={id}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InfluencerProfile;
