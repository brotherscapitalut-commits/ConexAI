import { Rocket } from "lucide-react";

interface DashboardEmptyStateProps {
  title: string;
  description?: string;
  className?: string;
}

/** Empty state gamificado com ícone de foguete para seções sem dados. */
export default function DashboardEmptyState({ title, description, className = "" }: DashboardEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 backdrop-blur-sm py-12 px-6 text-center ${className}`}
    >
      <div className="p-4 rounded-2xl bg-primary/10 ring-2 ring-primary/20 mb-4">
        <Rocket className="w-10 h-10 text-primary" />
      </div>
      <h3 className="font-display font-semibold text-foreground text-lg mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
    </div>
  );
}
