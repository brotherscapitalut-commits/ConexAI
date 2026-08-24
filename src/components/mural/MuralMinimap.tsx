import { forwardRef } from "react";

interface MuralMinimapProps {
  className?: string;
}

const MuralMinimap = forwardRef<HTMLCanvasElement, MuralMinimapProps>(({ className }, ref) => {
  return (
    <canvas
      ref={ref}
      className={className ?? "absolute top-3 right-3 z-20 w-[156px] h-[156px] rounded-lg border border-border shadow-lg pointer-events-none"}
      width={156}
      height={156}
    />
  );
});

MuralMinimap.displayName = "MuralMinimap";

export default MuralMinimap;

