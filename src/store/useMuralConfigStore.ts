import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ZoneBounds } from '@/lib/mural/types';

export interface MuralConfigState {
  gridCols: number;
  gridRows: number;
  premiumZone: ZoneBounds;
  intermediateZone: ZoneBounds;
  scarcityMultiplier: number;
  
  // Actions
  updateGridSize: (cols: number, rows: number) => void;
  updatePremiumZone: (bounds: ZoneBounds) => void;
  updateIntermediateZone: (bounds: ZoneBounds) => void;
  updateScarcityMultiplier: (mult: number) => void;
  resetToDefaults: () => void;
}

const DEFAULT_STATE = {
  gridCols: 100,
  gridRows: 50,
  // Premium Center: 20x20 blocks
  premiumZone: { x1: 40, x2: 60, y1: 15, y2: 35 },
  // Intermediate Zone: 50x34 blocks
  intermediateZone: { x1: 25, x2: 75, y1: 8, y2: 42 },
  scarcityMultiplier: 2.5,
};

export const useMuralConfigStore = create<MuralConfigState>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,
      updateGridSize: (cols, rows) => set({ gridCols: cols, gridRows: rows }),
      updatePremiumZone: (bounds) => set({ premiumZone: bounds }),
      updateIntermediateZone: (bounds) => set({ intermediateZone: bounds }),
      updateScarcityMultiplier: (mult) => set({ scarcityMultiplier: mult }),
      resetToDefaults: () => set(DEFAULT_STATE),
    }),
    {
      name: 'conexai-mural-config',
    }
  )
);
