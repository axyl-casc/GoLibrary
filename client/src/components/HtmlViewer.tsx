import { useEffect, useMemo } from 'react';
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
  const frameSrc = useMemo(() => `/api/items/${item.id}/html/`, [item.id]);

  useEffect(() => {
    addRecent(userId, item.id);
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
      <iframe
        className="html-frame"
        src={frameSrc}
        title={item.title}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
    </div>
  );
}
