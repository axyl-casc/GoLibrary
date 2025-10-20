import { useCallback, useMemo, useState } from 'react';

export interface QueryState {
  type?: string;
  folder?: string;
  q?: string;
  sort?: string;
}

export function useQueryState(initial: QueryState = {}) {
  const [query, setQuery] = useState<QueryState>(initial);

  const update = useCallback((patch: Partial<QueryState>) => {
    setQuery((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setQuery(initial), [initial]);

  return useMemo(
    () => ({
      query,
      update,
      reset
    }),
    [query, update, reset]
  );
}
