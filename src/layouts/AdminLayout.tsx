import { NavLink, Outlet } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";

/**
 * Abas superiores do painel.
 *
 * Atalhos para as áreas de uso mais frequente, que na barra lateral ficam
 * misturadas com telas de configuração raramente acessadas. São links de
 * verdade (`NavLink`), então continuam funcionando com Ctrl+clique, abrem em
 * nova aba e mantêm o estado ativo sincronizado com a URL — algo que abas
 * baseadas em estado local perderiam.
 *
 * `end` no item raiz impede que ele fique aceso em todas as sub-rotas.
 */
// As abas superiores foram movidas para dentro do AdminPanel.tsx como sub-abas.

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />

      {/* `min-w-0` evita que uma tabela larga estique o main e empurre a
          sidebar para fora da tela — um item flex não encolhe abaixo da
          largura do próprio conteúdo sem isso. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* A navegação superior antiga foi removida para evitar conflito com as abas do AdminPanel */}

        <main className="min-w-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
