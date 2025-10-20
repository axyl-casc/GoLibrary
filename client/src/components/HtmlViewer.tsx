import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { addRecent } from '../api/api';
import { ItemSummary } from '../state/types';
import FavoritesToggle from './FavoritesToggle';
import '../styles/viewers.css';

interface HtmlViewerProps {
  userId: string;
  item: ItemSummary;
  isFavorite: boolean;
  onToggleFavorite: (favored: boolean) => void;
}

export default function HtmlViewer({ userId, item, isFavorite, onToggleFavorite }: HtmlViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/items/${item.id}/content`);
      const html = await response.text();
      if (containerRef.current) {
        containerRef.current.innerHTML = DOMPurify.sanitize(html);
      }
      await addRecent(userId, item.id);
    };
    load();
  }, [item.id, userId]);

  return (
    <div className="viewer html-viewer">
      <div className="viewer-toolbar">
        <FavoritesToggle
          favored={isFavorite}
          onToggle={(event) => {
            event.stopPropagation();
            onToggleFavorite(!isFavorite);
          }}
        />
      </div>
      <div className="html-content" ref={containerRef} />
    </div>
  );
}
