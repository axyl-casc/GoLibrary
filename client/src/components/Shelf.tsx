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

export default function Shelf({ query, userId, favorites, onSelect, onToggleFavorite }: ShelfProps) {
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<HTMLDivElement | null>(null);

  const queryKey = useMemo(() => {
    const userKey = query.favorites === 'true' ? userId ?? null : null;
    return JSON.stringify({ ...query, __user: userKey });
  }, [query, userId]);

  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
  }, [queryKey]);

  useEffect(() => {
    if (!hasMore || loading) return;
    setLoading(true);
    const params = {
      ...query,
      page,
      limit: 40,
      userId: query.favorites === 'true' ? userId : undefined
    };
    getItems(params)
      .then((results) => {
        setItems((prev) => (page === 1 ? results : [...prev, ...results]));
        if (results.length < 40) {
          setHasMore(false);
        }
      })
      .finally(() => setLoading(false));
  }, [page, query.favorites, queryKey, userId]);

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
