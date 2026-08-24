import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Instagram } from "lucide-react";
import { normalizeInstagram, isValidInstagramUsername } from "@/lib/socialValidation";

interface AddCompanyFormProps {
  userId: string;
  onCompanyAdded: () => void;
}

const CATEGORIES = [
  "Tecnologia", "Saúde", "Educação", "Alimentação", "Moda",
  "Beleza", "Esportes", "Finanças", "Imobiliário", "Entretenimento",
  "Automotivo", "Pet", "Viagens", "Serviços", "Outro",
];

const COLORS = [
  "#00d4ff", "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff",
  "#ff6fb7", "#c084fc", "#f97316", "#14b8a6", "#e11d48",
];

const AddCompanyForm = ({ userId, onCompanyAdded }: AddCompanyFormProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    website: "",
    category: "",
    color: COLORS[0],
    logo_initials: "",
    contact_whatsapp: "",
    contact_email: "",
    instagram: "",
    tiktok: "",
    youtube: "",
    description: "",
    product_service: "",
    target_audience: "",
    avg_budget: "",
    region: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category) {
      toast({ title: "Preencha nome e categoria", variant: "destructive" });
      return;
    }
    const website = form.website.trim();
    const hasWebsite = website.length > 0;
    const hasSocial = form.instagram.trim() || form.tiktok.trim() || form.youtube.trim();
    if (!hasWebsite && !hasSocial) {
      toast({ title: "Informe ao menos o site ou uma rede social (Instagram, TikTok ou YouTube)", variant: "destructive" });
      return;
    }
    const instagramNorm = normalizeInstagram(form.instagram);
    if (form.instagram.trim() && !isValidInstagramUsername(instagramNorm)) {
      toast({ title: "Instagram inválido. Use apenas usuário (ex: instagram.com/usuario ou @usuario)", variant: "destructive" });
      return;
    }

    setSaving(true);
    const initials = form.logo_initials || form.name.slice(0, 2).toUpperCase();

    const { error } = await supabase.from("companies").insert({
      owner_id: userId,
      name: form.name.trim(),
      website: website || "https://placeholder.local",
      category: form.category,
      color: form.color,
      logo_initials: initials,
      contact_whatsapp: form.contact_whatsapp.trim() || null,
      contact_email: form.contact_email.trim() || null,
      instagram: instagramNorm || null,
      tiktok: form.tiktok.trim() || null,
      youtube: form.youtube.trim() || null,
      description: form.description.trim() || null,
      product_service: form.product_service.trim() || null,
      target_audience: form.target_audience.trim() || null,
      avg_budget: form.avg_budget.trim() || null,
      region: form.region.trim() || null,
    });

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Empresa cadastrada com sucesso!" });
      setForm({ name: "", website: "", category: "", color: COLORS[0], logo_initials: "", contact_whatsapp: "", contact_email: "", instagram: "", tiktok: "", youtube: "", description: "", product_service: "", target_audience: "", avg_budget: "", region: "" });
      setOpen(false);
      onCompanyAdded();
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="mb-6 gap-2">
        <Plus className="w-4 h-4" /> Cadastrar Nova Empresa
      </Button>
    );
  }

  return (
    <Card className="mb-6 border-primary/30">
      <CardHeader>
        <CardTitle className="text-lg">Nova Empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da empresa *</Label>
              <Input placeholder="Minha Empresa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Website (ou deixe em branco e use redes sociais)</Label>
              <Input placeholder="https://exemplo.com" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Instagram className="w-3.5 h-3.5" /> Instagram</Label>
              <Input placeholder="instagram.com/usuario ou @usuario" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>TikTok</Label>
              <Input placeholder="@usuario ou usuário" value={form.tiktok} onChange={(e) => setForm({ ...form, tiktok: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>YouTube</Label>
              <Input placeholder="URL do canal ou @canal" value={form.youtube} onChange={(e) => setForm({ ...form, youtube: e.target.value })} />
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
              <Label>Iniciais do logo</Label>
              <Input placeholder="AB" maxLength={3} value={form.logo_initials} onChange={(e) => setForm({ ...form, logo_initials: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input placeholder="5511999999999" value={form.contact_whatsapp} onChange={(e) => setForm({ ...form, contact_whatsapp: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email de contato</Label>
              <Input type="email" placeholder="contato@empresa.com" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cor da marca</Label>
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

          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Input placeholder="Breve descrição da empresa" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Produto / Serviço</Label>
              <Input placeholder="Ex: Software de gestão" value={form.product_service} onChange={(e) => setForm({ ...form, product_service: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Público-Alvo</Label>
              <Input placeholder="Ex: PMEs, jovens 18-35" value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Orçamento Médio (opcional)</Label>
              <Input placeholder="Ex: R$ 5.000 - R$ 15.000" value={form.avg_budget} onChange={(e) => setForm({ ...form, avg_budget: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Região</Label>
              <Input placeholder="Ex: São Paulo, SP" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-border p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">Pré-visualização</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: form.color, color: "#fff" }}>
                {form.logo_initials || form.name.slice(0, 2).toUpperCase() || "??"}
              </div>
              <div>
                <span className="font-medium">{form.name || "Nome da Empresa"}</span>
                <p className="text-sm text-muted-foreground">{form.category || "Categoria"}</p>
              </div>
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

export default AddCompanyForm;
