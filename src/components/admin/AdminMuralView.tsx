import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:3001";

function getAuthHeader(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("local_db_token");
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, ZoomIn, ZoomOut, Info, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const GRID_COLS = 100;
const GRID_ROWS = 50;

interface BlockData {
  x: number;
  y: number;
  status: string;
  company_id: string | null;
  region: string;
  reserved_until: string | null;
}

interface CompanyData {
  id: string;
  name: string;
  color: string;
  logo_initials: string;
  category: string;
  expires_at: string | null;
}

const AdminMuralView = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<BlockData[]>([]);
  const [companies, setCompanies] = useState<Map<string, CompanyData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredBlock, setHoveredBlock] = useState<{ block: BlockData; company?: CompanyData } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [baseCellSize, setBaseCellSize] = useState(8);
  const [selectedFilter, setSelectedFilter] = useState<"all" | "occupied" | "free" | "expiring">("all");
  const [editDaysCompany, setEditDaysCompany] = useState<CompanyData | null>(null);
  const [editDaysValue, setEditDaysValue] = useState("");
  const [editDaysSaving, setEditDaysSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const updateCellSize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      setBaseCellSize(Math.min(w / GRID_COLS, h / GRID_ROWS));
    };
    updateCellSize();
    window.addEventListener("resize", updateCellSize);
    return () => window.removeEventListener("resize", updateCellSize);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [blocksRes, companiesRes] = await Promise.all([
        fetch(`${API}/api/rest/blocks?select=x,y,status,company_id,region,reserved_until`, { headers: getAuthHeader() }).then((r) => r.json()),
        fetch(`${API}/api/rest/companies?select=id,name,color,logo_initials,category,expires_at`, { headers: getAuthHeader() }).then((r) => r.json()),
      ]);

      if (blocksRes.data) setBlocks(Array.isArray(blocksRes.data) ? blocksRes.data : []);
      if (companiesRes.data) {
        const map = new Map<string, CompanyData>();
        (Array.isArray(companiesRes.data) ? companiesRes.data : []).forEach((c: CompanyData) => map.set(c.id, c));
        setCompanies(map);
      }
    } catch (_e) {
      setBlocks([]);
      setCompanies(new Map());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const blockMap = useMemo(() => {
    const map = new Map<string, BlockData>();
    blocks.forEach((b) => map.set(`${b.x},${b.y}`, b));
    return map;
  }, [blocks]);

  const stats = useMemo(() => {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const occupied = blocks.filter((b) => b.status === "occupied").length;
    const reserved = blocks.filter((b) => b.status === "reserved").length;
    const free = blocks.filter((b) => b.status === "free").length;

    const expiringCompanyIds = new Set<string>();
    companies.forEach((c) => {
      if (c.expires_at && new Date(c.expires_at).getTime() - now < thirtyDays && new Date(c.expires_at).getTime() > now) {
        expiringCompanyIds.add(c.id);
      }
    });

    const expiring = blocks.filter((b) => b.company_id && expiringCompanyIds.has(b.company_id)).length;

    return { total: blocks.length, occupied, reserved, free, expiring, expiringCompanyIds };
  }, [blocks, companies]);

  const getDaysRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const openEditDays = (company: CompanyData) => {
    const days = getDaysRemaining(company.expires_at);
    setEditDaysCompany(company);
    setEditDaysValue(days !== null ? String(days) : "30");
  };

  const saveEditDays = async () => {
    if (!editDaysCompany) return;
    const days = parseInt(editDaysValue, 10);
    if (isNaN(days) || days < 0) {
      toast({ title: "Informe um número de dias válido.", variant: "destructive" });
      return;
    }
    setEditDaysSaving(true);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(`${API}/api/rest/companies?id=eq.${editDaysCompany.id}`, {
      method: "PATCH",
      headers: getAuthHeader(),
      body: JSON.stringify({ expires_at: expiresAt }),
    });
    const result = await res.json().catch(() => ({}));
    setEditDaysSaving(false);
    setEditDaysCompany(null);
    if (result.error) {
      toast({ title: "Erro ao atualizar", description: result.error.message ?? "Tente novamente.", variant: "destructive" });
      return;
    }
    toast({ title: "Dias restantes atualizados." });
    loadData();
  };

  const getBlockColor = (block: BlockData | undefined, x: number, y: number) => {
    if (!block) {
      const isPremium = x >= 35 && x <= 65 && y >= 15 && y <= 35;
      const isIntermediate = !isPremium && x >= 20 && x <= 80 && y >= 8 && y <= 42;
      return isPremium ? "hsl(45 50% 72% / 0.3)" : isIntermediate ? "hsl(46 55% 75% / 0.2)" : "hsl(48 40% 80% / 0.15)";
    }

    if (block.status === "free") return "hsl(120 40% 70% / 0.3)";

    if (block.company_id) {
      const company = companies.get(block.company_id);
      if (company) {
        if (selectedFilter === "expiring" && stats.expiringCompanyIds.has(block.company_id)) {
          return "hsl(0 80% 55%)";
        }
        return company.color;
      }
    }

    if (block.status === "reserved") return "hsl(45 90% 55% / 0.6)";
    return "hsl(210 70% 55% / 0.6)";
  };

  const isBlockVisible = (block: BlockData | undefined) => {
    if (selectedFilter === "all") return true;
    if (!block) return selectedFilter === "free";
    if (selectedFilter === "occupied") return block.status === "occupied";
    if (selectedFilter === "free") return block.status === "free";
    if (selectedFilter === "expiring") return block.company_id ? stats.expiringCompanyIds.has(block.company_id) : false;
    return true;
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: panOffset.x, panY: panOffset.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  };
  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.5, Math.min(6, z + (e.deltaY > 0 ? -0.15 : 0.15))));
  }, []);

  const cellSize = baseCellSize * zoom;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando mural...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Blocos", value: stats.total, color: "text-foreground", filter: "all" as const },
          { label: "Ocupados", value: stats.occupied, color: "text-primary", filter: "occupied" as const },
          { label: "Livres", value: stats.free, color: "text-green-500", filter: "free" as const },
          { label: "Reservados", value: stats.reserved, color: "text-yellow-500", filter: "all" as const },
          { label: "Expirando (30d)", value: stats.expiring, color: "text-destructive", filter: "expiring" as const },
        ].map((s) => (
          <Card
            key={s.label}
            className={`cursor-pointer transition-all ${selectedFilter === s.filter ? "ring-2 ring-primary" : ""}`}
            onClick={() => setSelectedFilter(s.filter)}
          >
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-display font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(6, z + 0.5))}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <Button variant="outline" size="sm" onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}>
          Resetar
        </Button>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-1" />Atualizar
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { color: "bg-primary", label: "Ocupado" },
          { color: "bg-green-500/30", label: "Livre" },
          { color: "bg-yellow-500/60", label: "Reservado" },
          { color: "bg-destructive", label: "Expirando" },
          { color: "bg-muted", label: "Sem registro" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${l.color}`} />
            <span className="text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Mural Grid */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="relative overflow-hidden cursor-grab active:cursor-grabbing"
            style={{ height: "60vh" }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { setIsDragging(false); setHoveredBlock(null); }}
          >
            <motion.div
              className="absolute"
              animate={{ x: panOffset.x, y: panOffset.y }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            >
              <div
                className="grid gap-[1px]"
                style={{ gridTemplateColumns: `repeat(${GRID_COLS}, ${cellSize}px)` }}
              >
                {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, i) => {
                  const x = i % GRID_COLS;
                  const y = Math.floor(i / GRID_COLS);
                  const key = `${x},${y}`;
                  const block = blockMap.get(key);
                  const company = block?.company_id ? companies.get(block.company_id) : undefined;
                  const visible = isBlockVisible(block);
                  const days = company ? getDaysRemaining(company.expires_at) : null;
                  const isExpiring = days !== null && days <= 30;

                  return (
                    <div
                      key={key}
                      className="rounded-[1px] flex items-center justify-center overflow-hidden transition-opacity duration-200"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: getBlockColor(block, x, y),
                        opacity: visible ? 1 : 0.15,
                        border: isExpiring && block?.status === "occupied" ? "1px solid hsl(0 80% 50%)" : "none",
                        fontSize: cellSize > 14 ? "7px" : cellSize > 8 ? "5px" : "0px",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: block ? "pointer" : "default",
                      }}
                      onMouseEnter={(e) => {
                        if (block && !isDragging) {
                          setHoveredBlock({ block, company });
                          setTooltipPos({ x: e.clientX, y: e.clientY });
                        }
                      }}
                      onMouseLeave={() => setHoveredBlock(null)}
                    >
                      {company && cellSize > 10 ? company.logo_initials : ""}
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Tooltip */}
            <AnimatePresence>
              {hoveredBlock && !isDragging && (
                <motion.div
                  className="fixed z-50 pointer-events-none px-4 py-3 rounded-xl border border-border bg-popover shadow-2xl max-w-xs"
                  style={{ left: tooltipPos.x + 16, top: tooltipPos.y - 10 }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.12 }}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Posição: ({hoveredBlock.block.x}, {hoveredBlock.block.y})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={hoveredBlock.block.status === "occupied" ? "default" : hoveredBlock.block.status === "reserved" ? "secondary" : "outline"} className="text-xs">
                        {hoveredBlock.block.status === "occupied" ? "Ocupado" : hoveredBlock.block.status === "reserved" ? "Reservado" : "Livre"}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">{hoveredBlock.block.region}</Badge>
                    </div>
                    {hoveredBlock.company && (
                      <>
                        <div className="flex items-center gap-2 mt-2">
                          <div
                            className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold text-white"
                            style={{ backgroundColor: hoveredBlock.company.color }}
                          >
                            {hoveredBlock.company.logo_initials}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{hoveredBlock.company.name}</p>
                            <p className="text-xs text-muted-foreground">{hoveredBlock.company.category}</p>
                          </div>
                        </div>
                        {hoveredBlock.company.expires_at && (
                          <div className="text-xs mt-1">
                            {(() => {
                              const days = getDaysRemaining(hoveredBlock.company.expires_at);
                              if (days === null) return null;
                              if (days === 0) return <span className="text-destructive font-medium">Expirado!</span>;
                              if (days <= 30) return <span className="text-destructive font-medium">Expira em {days} dias</span>;
                              return <span className="text-muted-foreground">Expira em {days} dias ({new Date(hoveredBlock.company.expires_at).toLocaleDateString("pt-BR")})</span>;
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Companies with blocks - table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Empresas no Mural</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const companyBlocks = new Map<string, number>();
            blocks.filter((b) => b.company_id && b.status === "occupied").forEach((b) => {
              companyBlocks.set(b.company_id!, (companyBlocks.get(b.company_id!) || 0) + 1);
            });

            const entries = Array.from(companyBlocks.entries())
              .map(([id, count]) => ({ company: companies.get(id), count }))
              .filter((e) => e.company)
              .sort((a, b) => {
                const daysA = getDaysRemaining(a.company!.expires_at) ?? 9999;
                const daysB = getDaysRemaining(b.company!.expires_at) ?? 9999;
                return daysA - daysB;
              });

            if (entries.length === 0) {
              return <p className="text-sm text-muted-foreground">Nenhuma empresa ativa no mural.</p>;
            }

            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Empresa</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Categoria</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">Blocos</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Expira em</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(({ company, count }) => {
                      const days = getDaysRemaining(company!.expires_at);
                      return (
                        <tr key={company!.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white"
                                style={{ backgroundColor: company!.color }}
                              >
                                {company!.logo_initials}
                              </div>
                              <span className="font-medium">{company!.name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{company!.category}</td>
                          <td className="py-2 px-3 text-center font-medium">{count}</td>
                          <td className="py-2 px-3">
                            {days !== null ? (
                              <span className={days <= 30 ? "text-destructive font-medium" : "text-muted-foreground"}>
                                {days === 0 ? "Expirado" : `${days} dias`}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant={days !== null && days <= 7 ? "destructive" : days !== null && days <= 30 ? "secondary" : "default"}
                              className="text-xs"
                            >
                              {days !== null && days <= 7 ? "Crítico" : days !== null && days <= 30 ? "Atenção" : "Ativo"}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openEditDays(company!)}>
                              <Pencil className="w-3 h-3" />
                              Editar dias
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Modal Editar dias restantes */}
      <Dialog open={!!editDaysCompany} onOpenChange={(open) => !open && setEditDaysCompany(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Editar dias restantes</DialogTitle>
          </DialogHeader>
          {editDaysCompany && (
            <>
              <p className="text-sm text-muted-foreground">
                Empresa: <strong>{editDaysCompany.name}</strong>
              </p>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Dias restantes</label>
                <Input
                  type="number"
                  min={0}
                  value={editDaysValue}
                  onChange={(e) => setEditDaysValue(e.target.value)}
                  placeholder="Ex: 30"
                />
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDaysCompany(null)}>Cancelar</Button>
            <Button onClick={saveEditDays} disabled={editDaysSaving}>
              {editDaysSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMuralView;
