import { useEffect, useState } from "react";

/**
 * Debounce a rapidly-changing value (e.g. search input) before it reaches
 * an expensive consumer such as a query key.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
