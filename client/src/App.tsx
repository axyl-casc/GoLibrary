import { useEffect, useMemo, useState } from 'react';
import Filters from './components/Filters';
import Shelf from './components/Shelf';
import PdfViewer from './components/PdfViewer';
import SgfViewer from './components/SgfViewer';
import HtmlViewer from './components/HtmlViewer';
import UserMenu from './components/UserMenu';
import { addRecent, getFavorites, toggleFavorite } from './api/api';
import { useQueryState } from './state/useQuery';
import { useUser } from './state/useUser';
import { ItemSummary } from './state/types';
import './styles/base.css';

export default function App() {
  const { users, currentUserId, selectUser } = useUser();
  const { query, update } = useQueryState({ sort: 'updatedAt' });
  const [selectedItem, setSelectedItem] = useState<ItemSummary | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (currentUserId) {
      getFavorites(currentUserId).then((items) => setFavorites(new Set(items.map((item) => item.id))));
    }
  }, [currentUserId]);

  useEffect(() => {
    setSelectedItem(null);
  }, [currentUserId]);

  const handleSelectItem = async (item: ItemSummary) => {
    setSelectedItem(item);
    if (currentUserId) {
      await addRecent(currentUserId, item.id);
    }
  };

  const toggleItemFavorite = async (item: ItemSummary) => {
    if (!currentUserId) return;
    const favored = favorites.has(item.id);
    await toggleFavorite(currentUserId, item.id, !favored);
    setFavorites((prev) => {
      const updated = new Set(prev);
      if (favored) {
        updated.delete(item.id);
      } else {
        updated.add(item.id);
      }
      return updated;
    });
  };

  const viewer = useMemo(() => {
    if (!selectedItem || !currentUserId) return null;
    const isFavorite = favorites.has(selectedItem.id);
    const toggleFavoriteWrapper = async (favored: boolean) => {
      await toggleFavorite(currentUserId, selectedItem.id, favored);
      setFavorites((prev) => {
        const updated = new Set(prev);
        if (favored) {
          updated.add(selectedItem.id);
        } else {
          updated.delete(selectedItem.id);
        }
        return updated;
      });
    };

    if (selectedItem.type === 'pdf') {
      return <PdfViewer userId={currentUserId} item={selectedItem} isFavorite={isFavorite} onToggleFavorite={toggleFavoriteWrapper} />;
    }
    if (selectedItem.type === 'sgf') {
      return <SgfViewer userId={currentUserId} item={selectedItem} isFavorite={isFavorite} onToggleFavorite={toggleFavoriteWrapper} />;
    }
    return <HtmlViewer userId={currentUserId} item={selectedItem} isFavorite={isFavorite} onToggleFavorite={toggleFavoriteWrapper} />;
  }, [selectedItem, currentUserId, favorites]);

  return (
    <div className="app">
      <header>
        <h1>Go Library</h1>
        <UserMenu users={users} currentUserId={currentUserId} onSelectUser={selectUser} />
      </header>
      <Filters query={query} onChange={update} />
      <div className="main-content">
        <Shelf
          query={query}
          favorites={favorites}
          onSelect={handleSelectItem}
          onToggleFavorite={toggleItemFavorite}
        />
        {viewer}
      </div>
    </div>
  );
}
