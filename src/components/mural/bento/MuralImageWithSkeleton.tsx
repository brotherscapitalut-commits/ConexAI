import { useState, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type LoadState = "loading" | "loaded" | "error";

interface MuralImageWithSkeletonProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallback: ReactNode;
}

/** Avatar / logo com skeleton até carregar. */
export function MuralImageWithSkeleton({
  src,
  alt,
  className,
  imgClassName,
  fallback,
}: MuralImageWithSkeletonProps) {
  const [state, setState] = useState<LoadState>(() => (!src?.trim() ? "error" : "loading"));

  useEffect(() => {
    if (!src?.trim()) {
      setState("error");
      return;
    }
    setState("loading");
  }, [src]);

  if (!src?.trim() || state === "error") {
    return <div className={cn("relative overflow-hidden", className)}>{fallback}</div>;
  }

  return (
    <div className={cn("relative overflow-hidden bg-white/[0.03]", className)}>
      {state === "loading" && (
        <Skeleton className="absolute inset-0 z-[1] h-full w-full rounded-[inherit] border-0 bg-white/[0.08]" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn(
          "relative z-[2] h-full w-full object-cover transition-opacity duration-500 ease-out",
          state === "loaded" ? "opacity-100" : "opacity-0",
          imgClassName,
        )}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />
    </div>
  );
}
