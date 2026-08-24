import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { I18nProvider } from "@/lib/i18n";
import SeoHead from "@/components/SeoHead";
import MaintenanceGate from "@/components/MaintenanceGate";
import AdminMasterGuard from "@/components/admin/AdminMasterGuard";
import AdminQuickJump from "@/components/admin/AdminQuickJump";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import RouteFallback from "@/components/RouteFallback";
import WelcomeConeXaiModal from "./components/WelcomeConeXaiModal";
import { MuralCacheProvider } from "./context/MuralCacheContext";

// 🔥 Importa o hook corrigido (BYPASS + LocalDB)
import { useUserProfile } from "@/hooks/useUserProfile";

// ─────────────────────────────────────────────────────────────────────────────
// Code splitting por rota
//
// Todas as 40 rotas eram importadas estaticamente, o que colocava o painel
// administrativo inteiro (com recharts, tabelas e formulários) no mesmo bundle
// que a home — um visitante anônimo baixava o código do admin antes de ver o
// primeiro pixel do mural.
//
// A LANDING é a rota de entrada e por isso tem import ESTÁTICO: transformá-la
// em chunk separado adicionaria um ida-e-volta de rede antes da primeira
// renderização — bundle menor em troca de first paint mais lento, o oposto do
// objetivo. O mural (`/mural`) virou lazy: ele carrega o canvas e o motor de
// render, peso que um visitante que só leu a landing não precisa baixar.
// ─────────────────────────────────────────────────────────────────────────────
import LandingPage from "./pages/LandingPage";

// ── Rotas públicas ──
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const RankingPage = lazy(() => import("./pages/RankingPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const InfluencersPage = lazy(() => import("./pages/InfluencersPage"));
const GuiaPage = lazy(() => import("./pages/GuiaPage"));
const TermosPage = lazy(() => import("./pages/TermosPage"));
const CompanyProfile = lazy(() => import("./pages/CompanyProfile"));
const InfluencerProfile = lazy(() => import("./pages/InfluencerProfile"));
const CampaignPublicPage = lazy(() => import("./pages/CampaignPublicPage"));
const PublicInfluencerCard = lazy(() => import("./pages/PublicInfluencerCard"));
const NotFound = lazy(() => import("./pages/NotFound"));

// ── Área logada ──
const Dashboard = lazy(() => import("./pages/Dashboard"));
const InfluencerDashboard = lazy(() => import("./pages/InfluencerDashboard"));

// ── Administração (só carrega para quem realmente acessa) ──
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AdminMaster = lazy(() => import("./pages/AdminMaster"));
const AdminSystemPage = lazy(() => import("./pages/admin/AdminSystemPage"));
const AdminAILabPage = lazy(() => import("./pages/admin/AdminAILabPage"));
const AdminNexusPage = lazy(() => import("./pages/admin/AdminNexusPage"));

const queryClient = new QueryClient();

const App = () => {
  const { user } = useUserProfile();

  // Apenas loga o usuário carregado pelo BYPASS
  useEffect(() => {
    if (user) {
      console.log("Perfil carregado (BYPASS):", user.id);
    }
  }, [user]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <SeoHead />
            <MaintenanceGate>
              <MuralCacheProvider>
                <WelcomeConeXaiModal />
                <AdminQuickJump />
                <ErrorBoundary>
                  {/*
                    Um único Suspense envolvendo as Routes. Colocar um por rota
                    daria controle mais fino do fallback, mas aqui todas as
                    telas usam o mesmo placeholder — e um só limite evita que
                    a troca de rota desmonte a árvore mais do que o necessário.
                  */}
                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                      {/*
                        A raiz é a landing de conversão; o mural interativo
                        vive em /mural. Antes era o inverso, com /mural
                        redirecionando para /. A troca exigiu atualizar a
                        canônica do MuralSeo em Index.tsx — duas URLs
                        anunciando ser a mesma página competem entre si na
                        busca e dividem a autoridade.
                      */}
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/mural" element={<Index />} />
                      {/* Atalho de conversão usado pelos CTAs da landing. */}
                      <Route path="/claim" element={<Navigate to="/precos" replace />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/dashboard/influencer" element={<InfluencerDashboard />} />
                      <Route path="/dashboard/influencer/ganhos" element={<Navigate to="/dashboard/influencer" replace />} />
                      <Route path="/portal-influencer" element={<Navigate to="/dashboard/influencer" replace />} />
                      <Route path="/portal-empresa" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/ranking" element={<RankingPage />} />
                      <Route path="/precos" element={<PricingPage />} />
                      <Route path="/influencers" element={<InfluencersPage />} />

                      <Route path="/admin" element={<AdminMasterGuard><AdminLayout /></AdminMasterGuard>}>
                        <Route index element={<AdminPanel />} />
                        <Route path="system" element={<AdminSystemPage />} />
                        <Route path="ai-lab" element={<AdminAILabPage />} />
                        <Route path="nexus" element={<AdminNexusPage />} />
                      </Route>

                      <Route path="/admin-master" element={<AdminMasterGuard><AdminMaster /></AdminMasterGuard>} />
                      <Route path="/p/:username" element={<PublicInfluencerCard />} />
                      <Route path="/guia" element={<GuiaPage />} />
                      <Route path="/termos" element={<TermosPage />} />
                      <Route path="/empresa/:id" element={<CompanyProfile />} />
                      <Route path="/influencer/:id" element={<InfluencerProfile />} />
                      <Route path="/campanha/:id" element={<CampaignPublicPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </MuralCacheProvider>
            </MaintenanceGate>
          </BrowserRouter>
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
};

export default App;
