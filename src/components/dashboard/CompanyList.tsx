import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, MessageCircle, Eye, Pencil, AlertTriangle, Save, X, Instagram } from "lucide-react";
import { normalizeInstagram, isValidInstagramUsername } from "@/lib/socialValidation";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface CompanyListProps {
  companies: any[];
  user: any;
  onDataReload: () => void;
}

const CompanyList = ({ companies, user, onDataReload }: CompanyListProps) => {
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const { toast } = useToast();

  const startEditing = (company: any) => {
    setEditingCompany(company.id);
    setEditForm({
      name: company.name,
      website: company.website || "",
      category: company.category,
      color: company.color,
      logo_initials: company.logo_initials,
      contact_whatsapp: company.contact_whatsapp || "",
      contact_email: company.contact_email || "",
      instagram: company.instagram || "",
      tiktok: company.tiktok || "",
      youtube: company.youtube || "",
    });
  };

  const saveEdit = async (companyId: string) => {
    const instagramNorm = normalizeInstagram(editForm.instagram || "");
    if (editForm.instagram && !isValidInstagramUsername(instagramNorm)) {
      toast({ title: "Instagram inválido. Use usuário (ex: instagram.com/usuario ou @usuario)", variant: "destructive" });
      return;
    }
    const toSave = { ...editForm, instagram: instagramNorm || null };
    const { error } = await supabase.from("companies").update(toSave).eq("id", companyId);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Empresa atualizada!" });
      setEditingCompany(null);
      onDataReload();
    }
  };

  const daysUntilExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <Card className="mb-8">
      <CardHeader><CardTitle className="text-lg">Suas Empresas</CardTitle></CardHeader>
      <CardContent>
        {companies.length > 0 ? (
          <div className="space-y-4">
            {companies.map((company) => {
              const days = daysUntilExpiry(company.expires_at);
              const isExpiring = days !== null && days <= 7;
              const isEditing = editingCompany === company.id;

              return (
                <div key={company.id} className="rounded-lg border border-border p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input placeholder="Nome" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                        <Input placeholder="Website" value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} />
                        <Input placeholder="Categoria" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
                        <Input placeholder="Cor (hex)" value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} />
                        <Input placeholder="WhatsApp" value={editForm.contact_whatsapp} onChange={(e) => setEditForm({ ...editForm, contact_whatsapp: e.target.value })} />
                        <Input placeholder="Email de contato" value={editForm.contact_email} onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })} />
                        <Input placeholder="Instagram (ex: @usuario)" value={editForm.instagram} onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })} />
                        <Input placeholder="TikTok" value={editForm.tiktok} onChange={(e) => setEditForm({ ...editForm, tiktok: e.target.value })} />
                        <Input placeholder="YouTube (URL ou @canal)" value={editForm.youtube} onChange={(e) => setEditForm({ ...editForm, youtube: e.target.value })} className="sm:col-span-2" />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(company.id)} className="gap-1"><Save className="w-3.5 h-3.5" />Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingCompany(null)}><X className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: company.color, color: "#fff" }}>
                        {company.logo_initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{company.name}</span>
                          {isExpiring && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              {days! <= 0 ? "Expirado" : `${days}d restantes`}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{company.category}</div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {company.expires_at && (
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Expira: {new Date(company.expires_at).toLocaleDateString("pt-BR")}</span>
                          )}
                          {company.instagram && (
                            <a href={`https://instagram.com/${company.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                              <Instagram className="w-3 h-3" />Instagram
                            </a>
                          )}
                          {company.tiktok && (
                            <a href={`https://tiktok.com/@${company.tiktok.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">TikTok</a>
                          )}
                          {company.contact_whatsapp && (
                            <a href={`https://wa.me/${company.contact_whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                              <MessageCircle className="w-3 h-3" />WhatsApp
                            </a>
                          )}
                          {company.contact_email && (
                            <a href={`mailto:${company.contact_email}`} className="flex items-center gap-1 text-primary hover:underline">
                              <Eye className="w-3 h-3" />{company.contact_email}
                            </a>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => startEditing(company)} className="shrink-0">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma empresa cadastrada ainda.</p>
            <Link to="/precos"><Button className="mt-4" size="sm">Comprar blocos</Button></Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyList;
