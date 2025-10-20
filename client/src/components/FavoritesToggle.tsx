import { MouseEvent } from 'react';
import '../styles/favorites.css';

interface FavoritesToggleProps {
  favored: boolean;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
}

export default function FavoritesToggle({ favored, onToggle }: FavoritesToggleProps) {
  return (
    <button className={`favorite-toggle ${favored ? 'favored' : ''}`} onClick={onToggle} aria-label="Toggle favorite">
      {favored ? '★' : '☆'}
    </button>
  );
}
