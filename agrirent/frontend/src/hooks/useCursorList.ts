import { useState, useCallback, useEffect } from 'react';

export interface CursorFetcher<T> {
  (cursor?: string): Promise<{ items: T[]; nextCursor?: string | null; hasMore?: boolean }>;
}

export function useCursorList<T>(fetcher: CursorFetcher<T>, autoFetch: boolean = true) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPage = useCallback(
    async (cursorParam?: string, reset: boolean = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetcher(cursorParam);
        setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
        setNextCursor(res.nextCursor);
        setHasMore(Boolean(res.nextCursor && res.hasMore !== false));
      } catch (err: any) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [fetcher]
  );

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore && nextCursor) {
      fetchPage(nextCursor, false);
    }
  }, [fetchPage, hasMore, isLoading, nextCursor]);

  const refresh = useCallback(() => {
    fetchPage(undefined, true);
  }, [fetchPage]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [autoFetch, refresh]);

  return {
    items,
    nextCursor,
    hasMore,
    isLoading,
    error,
    loadMore,
    refresh,
  };
}
