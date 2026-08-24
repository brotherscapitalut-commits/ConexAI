import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, UserPlus } from "lucide-react";

interface AddInfluencerFormProps {
  userId: string;
  onAdded: () => void;
}

const CATEGORIES = [
  "Música", "Comédia", "Lifestyle", "Fitness", "Games",
  "Beleza", "Culinária", "Tecnologia", "Dança", "Arte",
  "Moda", "Viagens", "Educação", "Saúde", "Finanças",
];

const COLORS = [
  "#e11d48", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899",
  "#10b981", "#f97316", "#6366f1", "#14b8a6", "#84cc16",
];

const AddInfluencerForm = ({ userId, onAdded }: AddInfluencerFormProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    category: "",
    niche: "",
    bio: "",
    followers_count: "",
    avg_engagement: "",
    portfolio_url: "",
    instagram: "",
    tiktok: "",
    youtube: "",
    twitter: "",
    contact_email: "",
    contact_whatsapp: "",
    website: "",
    region: "",
    color: COLORS[0],
    logo_initials: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category) {
      toast({ title: "Preencha nome e categoria", variant: "destructive" });
      return;
    }

    setSaving(true);
    const initials = form.logo_initials || form.name.slice(0, 2).toUpperCase();

    const { error } = await supabase.from("influencers").insert({
      owner_id: userId,
      name: form.name.trim(),
      category: form.category,
      niche: form.niche.trim() || null,
      bio: form.bio.trim() || null,
      followers_count: form.followers_count ? parseInt(form.followers_count) : 0,
      avg_engagement: form.avg_engagement ? parseFloat(form.avg_engagement) : 0,
      portfolio_url: form.portfolio_url.trim() || null,
      instagram: form.instagram.trim() || null,
      tiktok: form.tiktok.trim() || null,
      youtube: form.youtube.trim() || null,
      twitter: form.twitter.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_whatsapp: form.contact_whatsapp.trim() || null,
      website: form.website.trim() || null,
      region: form.region.trim() || null,
      color: form.color,
      logo_initials: initials,
    });

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil de influencer cadastrado!" });
      setForm({
        name: "", category: "", niche: "", bio: "", followers_count: "",
        avg_engagement: "", portfolio_url: "", instagram: "", tiktok: "",
        youtube: "", twitter: "", contact_email: "", contact_whatsapp: "",
        website: "", region: "", color: COLORS[0], logo_initials: "",
      });
      setOpen(false);
      onAdded();
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline" className="mb-6 gap-2">
        <UserPlus className="w-4 h-4" /> Cadastrar Perfil de Influencer
      </Button>
    );
  }

  return (
    <Card className="mb-6 border-primary/30">
      <CardHeader>
        <CardTitle className="text-lg">Novo Perfil de Influencer</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Seu nome artístico" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nicho</Label>
              <Input placeholder="Ex: Receitas veganas" value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Região</Label>
              <Input placeholder="Ex: São Paulo, SP" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Número de Seguidores</Label>
              <Input type="number" placeholder="Ex: 150000" value={form.followers_count} onChange={(e) => setForm({ ...form, followers_count: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Engajamento Médio (%)</Label>
              <Input type="number" step="0.01" placeholder="Ex: 3.5" value={form.avg_engagement} onChange={(e) => setForm({ ...form, avg_engagement: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input placeholder="@seuuser" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>TikTok</Label>
              <Input placeholder="@seuuser" value={form.tiktok} onChange={(e) => setForm({ ...form, tiktok: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>YouTube</Label>
              <Input placeholder="@seucanal" value={form.youtube} onChange={(e) => setForm({ ...form, youtube: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>X / Twitter</Label>
              <Input placeholder="@seuuser" value={form.twitter} onChange={(e) => setForm({ ...form, twitter: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Portfólio (URL)</Label>
              <Input placeholder="https://seumediakit.com" value={form.portfolio_url} onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input placeholder="https://seusite.com" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail de contato</Label>
              <Input type="email" placeholder="contato@email.com" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input placeholder="5511999999999" value={form.contact_whatsapp} onChange={(e) => setForm({ ...form, contact_whatsapp: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Iniciais</Label>
              <Input placeholder="AB" maxLength={3} value={form.logo_initials} onChange={(e) => setForm({ ...form, logo_initials: e.target.value.toUpperCase() })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea placeholder="Conte um pouco sobre você e seu trabalho..." value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Cor do perfil</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Cadastrar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AddInfluencerForm;
