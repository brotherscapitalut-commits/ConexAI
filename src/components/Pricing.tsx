import { motion } from "framer-motion";
import { Check, Sparkles, Zap, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLANS, BlockRegion, MAX_BLOCKS, BLOCK_RANGES, computeCost, formatUsd, validateBlockCount } from "@/lib/stripe";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

const CATEGORIES = [
  "Tecnologia", "Saúde", "Educação", "Alimentação", "Moda",
  "Finanças", "Entretenimento", "Esportes", "Imobiliário", "Serviços", "Outros",
];

const Pricing = () => {
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<BlockRegion | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", website: "", category: "Tecnologia", customCategory: "" });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();

  const handleSelectPlan = async (region: BlockRegion) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: t("checkout.login_first"), description: t("checkout.login_desc") });
      navigate("/auth");
      return;
    }


    let { data: companiesData } = await supabase.from("companies").select("*").eq("owner_id", (user as any).id);
    
    // 🔧 Fallback para o modo local/bypass: se o owner_id fixo não tiver empresas, pegamos a primeira existente
    if (!companiesData || companiesData.length === 0) {
      const { data: firstCompany } = await supabase.from("companies").select("*").order("created_at", { ascending: true }).limit(1);
      if (firstCompany && firstCompany.length > 0) {
        companiesData = firstCompany;
      }
    }

    setCompanies((companiesData as any[]) || []);
    setSelectedRegion(region);
    setQuantity(BLOCK_RANGES[region].min);

    if (companiesData && companiesData.length > 0) {
      setSelectedCompanyId(companiesData[0].id);
      setIsCreatingNew(false);
    } else {
      setIsCreatingNew(true);
      setSelectedCompanyId("");
    }
    setShowDialog(true);
  };

  const handleCheckout = async () => {
    if (!selectedRegion) return;
    setCheckoutLoading(selectedRegion);

    try {
      let companyId = selectedCompanyId;

      if (isCreatingNew) {
        const finalCategory = newCompany.category === "Outros" && newCompany.customCategory
          ? newCompany.customCategory
          : newCompany.category;
        if (!newCompany.name || !newCompany.website) {
          toast({ title: t("checkout.fill_fields"), variant: "destructive" });
          setCheckoutLoading(null);
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        const { data: created, error: createError } = await supabase
          .from("companies")
          .insert({
            name: newCompany.name,
            website: newCompany.website,
            category: finalCategory,
            owner_id: (user as any)!.id,
            logo_initials: newCompany.name.substring(0, 2).toUpperCase(),
          });

        if (createError) throw createError;
        companyId = (created as any)?.id;
      }

      if (!companyId) {
        toast({ title: t("checkout.select_company_err"), variant: "destructive" });
        setCheckoutLoading(null);
        return;
      }
      const blockError = validateBlockCount(selectedRegion, quantity);
      if (blockError) {
        toast({ title: blockError, variant: "destructive" });
        setCheckoutLoading(null);
        return;
      }

      const selectedPlanType = selectedRegion === 'centro_premium' ? 'premium' : selectedRegion === 'intermediaria' ? 'standard' : 'basic';
      const companyObj = companies.find(c => c.id === companyId) || newCompany;

      const checkoutRes = await fetch(`${API}/api/checkout/create-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          planType: selectedPlanType,
          blocksCount: quantity,
          companyName: companyObj.name || "Minha Empresa",
          email: (user as any)?.email || "admin@conexai.app",
          website: companyObj.website || "https://conexai.app",
        }),
      });
      
      const checkoutData = await checkoutRes.json();
      
      if (checkoutRes.ok && checkoutData.url) {
        window.location.href = checkoutData.url;
        return;
      }

      // Fallback if Stripe URL is not returned (e.g. local mock)
      const params = new URLSearchParams({
        plan_region: selectedRegion,
        plan_blocks: String(quantity),
        company_id: companyId,
      });
      toast({
        title: "Plan ready (Bypass)",
        description: "Going to simulator.",
      });
      navigate(`/dashboard?${params.toString()}#simulador`);
    } catch (err: any) {
      toast({ title: t("checkout.error"), description: err.message, variant: "destructive" });
    } finally {
      setCheckoutLoading(null);
      setShowDialog(false);
    }
  };

  const plans = [
    {
      name: t("pricing.basic"),
      price: "",
      unit: "",
      description: t("pricing.basic_desc"),
      icon: Zap,
      region: "borda" as BlockRegion,
      plan: PLANS.borda,
      blocks: t("pricing.blocks_range1"),
      regionLabel: t("pricing.border"),
      features: [
        t("pricing.feat_logo"),
        t("pricing.feat_link"),
        t("pricing.feat_tracking"),
        t("pricing.feat_metrics"),
      ],
      popular: false,
    },
    {
      name: t("pricing.standard"),
      price: "",
      unit: "",
      description: t("pricing.standard_desc"),
      icon: Sparkles,
      region: "intermediaria" as BlockRegion,
      plan: PLANS.intermediaria,
      blocks: t("pricing.blocks_range2"),
      regionLabel: t("pricing.intermediate"),
      features: [
        t("pricing.feat_all_basic"),
        t("pricing.feat_visibility"),
        t("pricing.feat_badge"),
        t("pricing.feat_reports"),
        t("pricing.feat_priority"),
      ],
      popular: true,
    },
    {
      name: t("pricing.premium"),
      price: "",
      unit: "",
      description: t("pricing.premium_desc"),
      icon: Crown,
      region: "centro_premium" as BlockRegion,
      plan: PLANS.centro_premium,
      blocks: t("pricing.blocks_range3"),
      regionLabel: t("pricing.center"),
      features: [
        t("pricing.feat_all_standard"),
        t("pricing.feat_center"),
        t("pricing.feat_badge_premium"),
        t("pricing.feat_campaigns"),
        t("pricing.feat_support"),
        t("pricing.feat_animation"),
      ],
      popular: false,
    },
  ];

  return (
    <>
      <section className="py-20 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 hero-grid-bg opacity-30" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 blur-[100px] rounded-full" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-5">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Mais de 12.000 marcas ativas no mural
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 leading-tight">
              {t("pricing.title1")} <span className="text-gradient">{t("pricing.title2")}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              {t("pricing.subtitle")}
            </p>
            <p className="mt-3 text-sm text-muted-foreground/60">
              monthly subscription + per-block fee • cancel anytime
            </p>
          </motion.div>

          {/* Guarantee badges */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {[
              { emoji: "🔒", text: "Pagamento seguro via Stripe" },
              { emoji: "⚡", text: "Publicação em minutos" },
              { emoji: "🎯", text: "38K+ influenciadores ativos" },
              { emoji: "💬", text: "Suporte especializado" },
            ].map((badge) => (
              <div key={badge.text} className="flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 bg-card/50 text-sm text-muted-foreground backdrop-blur-sm">
                <span>{badge.emoji}</span>
                <span>{badge.text}</span>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, index) => {
              const Icon = plan.icon;
              const isLoading = checkoutLoading === plan.region;
              return (
                <motion.div
                  key={plan.name}
                  className={`relative rounded-2xl flex flex-col overflow-hidden group transition-all duration-300 ${
                    plan.popular
                      ? "ring-1 ring-primary/50 shadow-[0_0_50px_rgba(0,0,0,0.5),0_0_40px_hsl(var(--primary)/0.12)]"
                      : "ring-1 ring-white/5 hover:ring-white/10"
                  }`}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.12 }}
                  style={{
                    background: plan.popular
                      ? "linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--primary)/0.06) 100%)"
                      : "hsl(var(--card))"
                  }}
                >
                  {/* Top glow line */}
                  {plan.popular && (
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-primary to-transparent" />
                  )}

                  <div className="p-8 flex flex-col flex-1">
                    {plan.popular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide shadow-lg">
                        ✦ {t("pricing.popular")}
                      </div>
                    )}

                    {/* Icon + heading */}
                    <div className={`inline-flex p-3 rounded-xl mb-5 w-fit ${plan.popular ? "bg-primary/15 text-primary" : "bg-white/5 text-muted-foreground group-hover:bg-white/8"}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-display font-bold mb-1">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mb-5">{plan.description}</p>

                    {/*
                      Modelo híbrido: a assinatura base paga os serviços
                      inclusos e a taxa por bloco paga o território. Exibimos
                      os dois separados porque somá-los num "a partir de"
                      esconderia justamente a estrutura que diferencia os
                      planos — e o total depende de quantos blocos a marca
                      escolher.
                    */}
                    <div className="mb-4">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-4xl font-display font-bold ${plan.popular ? "text-primary" : ""}`}>
                          {formatUsd(plan.plan.baseMonthlyUsd)}
                        </span>
                        <span className="text-muted-foreground text-sm">/month base</span>
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        + <span className="font-semibold text-foreground">{formatUsd(plan.plan.perBlockMonthlyUsd)}</span> per block / month
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground/70">
                        {plan.plan.minBlocks}–{plan.plan.maxBlocks} blocks ·{" "}
                        {formatUsd(computeCost(plan.region, plan.plan.minBlocks).monthly)} to{" "}
                        {formatUsd(computeCost(plan.region, plan.plan.maxBlocks).monthly)}/mo
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground/60">
                        {plan.plan.articlesPerMonth} article{plan.plan.articlesPerMonth > 1 ? "s" : ""} included / month
                      </p>
                    </div>

                    <div className="inline-flex px-3 py-1.5 rounded-lg bg-white/[0.04] border border-border/40 text-xs mb-5">
                      <span className="font-semibold text-foreground mr-1">{plan.regionLabel}</span>
                      <span className="text-muted-foreground">• {plan.blocks}</span>
                    </div>

                    <div className="border-t border-border/40 mb-6" />

                    <ul className="space-y-3 flex-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-sm">
                          <div className={`w-4 h-4 rounded-full mt-0.5 shrink-0 flex items-center justify-center ${plan.popular ? "bg-primary/20 text-primary" : "bg-white/10 text-muted-foreground"}`}>
                            <Check className="w-2.5 h-2.5" />
                          </div>
                          <span className="text-foreground/80">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className={`mt-8 w-full py-6 font-display font-semibold text-sm rounded-xl btn-shimmer ${
                        plan.popular
                          ? "bg-primary hover:bg-primary/90 shadow-[0_8px_30px_hsl(var(--primary)/0.35)]"
                          : "border-border/60 hover:bg-white/5"
                      }`}
                      variant={plan.popular ? "default" : "outline"}
                      size="lg"
                      disabled={!!checkoutLoading}
                      onClick={() => handleSelectPlan(plan.region)}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {t("pricing.start_now")}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom trust row */}
          <motion.p
            className="text-center text-xs text-muted-foreground/50 mt-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Pagamentos processados por Stripe • Sem taxas ocultas • Cancele a qualquer momento
          </motion.p>
        </div>
      </section>


      <Dialog open={showDialog} onOpenChange={(open) => !checkoutLoading && setShowDialog(open)}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => checkoutLoading && e.preventDefault()} onEscapeKeyDown={(e) => checkoutLoading && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-display">Preparar publicação no mural</DialogTitle>
          </DialogHeader>
          {checkoutLoading && (
            <div className="absolute inset-0 rounded-lg bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Abrindo o simulador...</p>
              <p className="text-xs text-muted-foreground">Não feche esta janela.</p>
            </div>
          )}
          <div className={`space-y-4 ${checkoutLoading ? "pointer-events-none opacity-60" : ""}`}>
            {/* Quantity */}
            <div>
              <label className="text-sm font-medium mb-1 block">{t("checkout.blocks_qty")}</label>
              <Input
                type="number"
                min={1}
                max={selectedRegion ? MAX_BLOCKS[selectedRegion] : 25}
                value={quantity}
                onChange={(e) => {
                  // Cada plano tem faixa própria: o Standard começa em 7 e o
                  // Premium em 13. Limitar só pelo máximo deixaria o usuário
                  // montar uma combinação que o backend recusaria.
                  const range = selectedRegion ? BLOCK_RANGES[selectedRegion] : { min: 1, max: 25 };
                  setQuantity(Math.min(range.max, Math.max(range.min, parseInt(e.target.value) || range.min)));
                }}
              />
              {selectedRegion && (
                <p className="text-xs text-muted-foreground mt-1">
                  {PLANS[selectedRegion].name}: {BLOCK_RANGES[selectedRegion].min}–{BLOCK_RANGES[selectedRegion].max} {t("checkout.blocks_label")}
                </p>
              )}
            </div>

            {/*
              O seletor de "anos contratados" foi removido: a assinatura é
              mensal e recorrente, sem prazo fixo. Pedir ao usuário para
              escolher uma duração numa cobrança que se renova sozinha era
              uma pergunta sem resposta correta — e o total exibido não
              correspondia a nenhuma cobrança real do Stripe.
            */}

            {/* Total — base e taxa por bloco discriminadas */}
            {selectedRegion && (() => {
              const cost = computeCost(selectedRegion, quantity);
              const err = validateBlockCount(selectedRegion, quantity);
              return (
                <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{PLANS[selectedRegion].name} base</span>
                    <span>{formatUsd(cost.base)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{cost.blocks} × {formatUsd(cost.perBlock)} per block</span>
                    <span>{formatUsd(cost.blocksTotal)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1 text-sm font-medium">
                    <span>{t("checkout.total")}</span>
                    <span className="text-primary text-lg font-bold">{formatUsd(cost.monthly)}/mo</span>
                  </div>
                  {err && <p className="text-xs text-destructive pt-1">{err}</p>}
                </div>
              );
            })()}

            {/* Company selection */}
            {companies.length > 0 && !isCreatingNew && (
              <div>
                <label className="text-sm font-medium mb-1 block">{t("checkout.company")}</label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("checkout.select_company")} />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button className="text-xs text-primary hover:underline mt-1" onClick={() => setIsCreatingNew(true)}>
                  {t("checkout.new_company")}
                </button>
              </div>
            )}

            {/* New company form */}
            {isCreatingNew && (
              <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
                <p className="text-sm font-medium">{t("checkout.new_company_title")}</p>
                <Input
                  placeholder={t("checkout.company_name")}
                  value={newCompany.name}
                  onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                />
                <Input
                  placeholder={t("checkout.website")}
                  value={newCompany.website}
                  onChange={(e) => setNewCompany({ ...newCompany, website: e.target.value })}
                />
                <Select value={newCompany.category} onValueChange={(v) => setNewCompany({ ...newCompany, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newCompany.category === "Outros" && (
                  <Input
                    placeholder="Digite a categoria"
                    value={newCompany.customCategory}
                    onChange={(e) => setNewCompany({ ...newCompany, customCategory: e.target.value })}
                  />
                )}
                {companies.length > 0 && (
                  <button className="text-xs text-muted-foreground hover:underline" onClick={() => setIsCreatingNew(false)}>
                    {t("checkout.use_existing")}
                  </button>
                )}
              </div>
            )}

            <Button
              className="w-full font-display font-semibold gap-2"
              onClick={handleCheckout}
              disabled={!!checkoutLoading}
            >
              {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {checkoutLoading ? "Abrindo checkout..." : "Ir para o Pagamento (Stripe)"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Pricing;
