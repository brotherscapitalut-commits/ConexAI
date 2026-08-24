import { useEffect, useRef, useState } from "react";

const DEFAULT_OPTIONS: IntersectionObserverInit = {
  root: null,
  rootMargin: "50px",
  threshold: 0,
};

/**
 * Returns true when the element is in viewport (with optional margin).
 * Use to skip heavy rendering/animations for off-screen items.
 */
export function useInView(options: Partial<IntersectionObserverInit> = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { ...DEFAULT_OPTIONS, ...options }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [options.root, options.rootMargin, options.threshold]);

  return { ref, inView };
}
