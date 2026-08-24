import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { MuralBrand } from "@/lib/mural/types";
import { loadBrands as loadBrandsFromLoader, invalidateCache } from "@/lib/mural/MuralDataLoader";

type LoadBrandsOptions = { sortByBids?: boolean };

interface MuralCacheState {
  brands: MuralBrand[] | null;
  loading: boolean;
  error: string | null;
}

interface MuralCacheContextValue extends MuralCacheState {
  loadBrands: (options?: LoadBrandsOptions) => Promise<MuralBrand[]>;
  invalidate: () => void;
}

const defaultState: MuralCacheState = { brands: null, loading: false, error: null };

const MuralCacheContext = createContext<MuralCacheContextValue | null>(null);

export function MuralCacheProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MuralCacheState>(defaultState);

  const loadBrands = useCallback(async (options?: LoadBrandsOptions) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loadBrandsFromLoader(options);
      setState({ brands: data, loading: false, error: null });
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao carregar mural";
      setState((s) => ({ ...s, loading: false, error: message }));
      return [];
    }
  }, []);

  const invalidate = useCallback(() => {
    invalidateCache();
    setState(defaultState);
  }, []);

  const value: MuralCacheContextValue = {
    ...state,
    loadBrands,
    invalidate,
  };

  return (
    <MuralCacheContext.Provider value={value}>
      {children}
    </MuralCacheContext.Provider>
  );
}

export function useMuralCache() {
  const ctx = useContext(MuralCacheContext);
  if (!ctx) {
    throw new Error("useMuralCache must be used within MuralCacheProvider");
  }
  return ctx;
}

export function useMuralCacheOptional() {
  return useContext(MuralCacheContext);
}
