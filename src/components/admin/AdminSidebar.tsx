import { NavLink } from "react-router-dom";
import { LayoutDashboard, DollarSign, Users, UserCircle, Server, LayoutGrid, Sparkles, Activity, Zap, Rocket, Building2 } from "lucide-react";

/**
 * Itens da barra lateral.
 *
 * `end` marca rotas que só devem ficar ativas em correspondência exata. Sem
 * isso, `/admin` acenderia junto com todas as suas sub-rotas.
 */
const navItems = [
  { to: "/admin-master", label: "Sumário Executivo", icon: LayoutDashboard },
  { to: "/admin", label: "Hub de Gestão", icon: LayoutGrid },
  { to: "/admin/system", label: "Sistema & APIs", icon: Server },
  { to: "/admin/ai-lab", label: "AI Lab", icon: Sparkles },
  { to: "/admin/nexus", label: "Nexus Hub", icon: Zap },
];

export default function AdminSidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-border/60 bg-card/40 backdrop-blur-sm flex flex-col">
      <nav className="p-3 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
