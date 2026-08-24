import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Blocks, User } from "lucide-react";
import { LOCAL_API_URL } from "@/lib/localApi";

interface InfluencerCardData {
  id: string;
  name: string;
  bio: string;
  category: string;
  public_username: string;
}

export default function PublicInfluencerCard() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<InfluencerCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) {
      setError("Username ausente");
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`${LOCAL_API_URL}/api/public/influencer/${encodeURIComponent(username)}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error.message || "Influencer não encontrado");
          setData(null);
        } else {
          setData(json.data ?? null);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erro ao carregar");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [username]);

  useEffect(() => {
    if (!data) return;
    const title = `${data.name} — ${data.category} | ConeXai`;
    const description = data.bio ? `${data.bio.slice(0, 160)}...` : `Perfil de ${data.name}, ${data.category}. Contrate via ConeXai.`;
    document.title = title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", description);
    return () => {
      document.title = "ConeXai - O Maior Mural Digital do Mundo";
    };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-border">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">{error ?? "Influencer não encontrado."}</p>
              <Link to="/" className="block mt-4">
                <Button variant="outline" className="w-full">Ir para o Mural</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full border-border shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center gap-2">
              <Blocks className="w-6 h-6 text-primary" />
              <span className="font-display font-bold text-foreground">ConeXai</span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-display font-bold text-foreground">{data.name}</h1>
                  <p className="text-sm text-muted-foreground">{data.category}</p>
                </div>
              </div>
              {data.bio && (
                <p className="text-sm text-foreground/90 leading-relaxed">{data.bio}</p>
              )}
              <Link to="/" className="block">
                <Button className="w-full gap-2" size="lg">
                  <Blocks className="w-4 h-4" />
                  Contratar via ConeXai
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
