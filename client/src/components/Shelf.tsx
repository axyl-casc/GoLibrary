import { useEffect, useMemo, useRef, useState } from 'react';
import { getItems } from '../api/api';
import { ItemSummary } from '../state/types';
import { QueryState } from '../state/useQuery';
import ItemCard from './ItemCard';
import '../styles/shelf.css';

interface ShelfProps {
  query: QueryState;
  userId?: string;
  favorites: Set<number>;
  onSelect: (item: ItemSummary) => void;
  onToggleFavorite: (item: ItemSummary) => void;
}

const PAGE_SIZE = 40;

export default function Shelf({ query, userId, favorites, onSelect, onToggleFavorite }: ShelfProps) {
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const queryKey = useMemo(() => {
    const userKey = query.favorites === 'true' ? userId ?? null : null;
    return JSON.stringify({ ...query, __user: userKey });
  }, [query, userId]);

  const observerRef = useRef<HTMLDivElement | null>(null);
  const activeRequestRef = useRef<{ id: number; key: string; page: number } | null>(null);
  const requestIdRef = useRef(0);
  const lastQueryKeyRef = useRef(queryKey);

  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
  }, [queryKey]);

  useEffect(() => {
    const isNewQuery = lastQueryKeyRef.current !== queryKey;
    const currentPage = isNewQuery ? 1 : page;

    if (isNewQuery) {
      activeRequestRef.current = null;
      setLoading(false);
    }

    lastQueryKeyRef.current = queryKey;

    if (!hasMore) return;

    if (
      activeRequestRef.current &&
      activeRequestRef.current.key === queryKey &&
      activeRequestRef.current.page === currentPage
    ) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    activeRequestRef.current = { id: requestId, key: queryKey, page: currentPage };
    setLoading(true);

    const params = {
      ...query,
      page: currentPage,
      limit: PAGE_SIZE,
      userId: query.favorites === 'true' ? userId : undefined
    };

    getItems(params)
      .then((results) => {
        if (activeRequestRef.current?.id !== requestId) {
          return;
        }
        setItems((prev) => (currentPage === 1 ? results : [...prev, ...results]));
        if (results.length < PAGE_SIZE) {
          setHasMore(false);
        }
      })
      .finally(() => {
        if (activeRequestRef.current?.id === requestId) {
          activeRequestRef.current = null;
          setLoading(false);
        }
      });
  }, [hasMore, page, queryKey, userId]);

  useEffect(() => {
    const sentinel = observerRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        setPage((prev) => prev + 1);
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  return (
    <div className="shelf">
      <div className="shelf-grid">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            isFavorite={favorites.has(item.id)}
            onOpen={() => onSelect(item)}
            onToggleFavorite={() => onToggleFavorite(item)}
          />
        ))}
      </div>
      <div ref={observerRef} className="shelf-sentinel">
        {loading ? 'Loading…' : hasMore ? 'Scroll for more' : 'End of shelf'}
      </div>
    </div>
  );
}
