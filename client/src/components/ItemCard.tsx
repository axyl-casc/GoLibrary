import { ItemSummary } from '../state/types';
import FavoritesToggle from './FavoritesToggle';

interface ItemCardProps {
  item: ItemSummary;
  isFavorite: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
}

export default function ItemCard({ item, isFavorite, onOpen, onToggleFavorite }: ItemCardProps) {
  return (
    <div className="item-card" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="item-thumb">
        <img src={`/api/thumbnails/${item.id}?variant=grid`} alt={item.title} loading="lazy" />
        <FavoritesToggle
          favored={isFavorite}
          onToggle={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
        />
        <span className={`type-badge type-${item.type}`}>{item.type.toUpperCase()}</span>
      </div>
      <div className="item-info">
        <h3>{item.title}</h3>
        {item.folder && <p className="item-folder">{item.folder}</p>}
      </div>
    </div>
  );
}
