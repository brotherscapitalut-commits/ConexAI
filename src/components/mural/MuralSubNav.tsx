import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type MuralKind = "empresas" | "influencers";

interface MuralSubNavProps {
  active: MuralKind;
  className?: string;
}

const TABS: { kind: MuralKind; to: string; label: string; title: string }[] = [
  { kind: "empresas", to: "/mural", label: "Marcas", title: "Mural de marcas e empresas" },
  { kind: "influencers", to: "/influencers", label: "Criadores", title: "Mural de influenciadores" },
];

/**
 * Alternador entre os dois murais.
 *
 * Vive dentro da Navbar, no fluxo normal do header — antes ele era
 * `absolute top-4` com z-index alto, o que o fazia flutuar por cima da
 * grade e disputar espaço com os blocos dos anunciantes.
 *
 * Visual: pill tab minimalista. O estado ativo é comunicado por uma
 * superfície levemente mais clara e um traço de 1px na base, não por
 * cor saturada e glow — a navegação não deve competir com o conteúdo.
 */
export function MuralSubNav({ active, className }: MuralSubNavProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.03] p-0.5",
        className
      )}
      role="tablist"
      aria-label="Alternar mural"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.kind;
        return (
          <Link
            key={tab.kind}
            to={tab.to}
            title={tab.title}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "relative rounded-full px-3.5 py-1.5 font-ui text-[12px] font-medium tracking-tight",
              "transition-colors duration-200",
              isActive
                ? "bg-white/[0.08] text-white"
                : "text-white/40 hover:text-white/75"
            )}
          >
            {tab.label}
            {isActive && (
              <span
                aria-hidden
                className="absolute inset-x-3.5 -bottom-px h-px bg-gradient-to-r from-transparent via-white/45 to-transparent"
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}

export default MuralSubNav;
