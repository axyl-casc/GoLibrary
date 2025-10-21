import { useEffect, useMemo, useState } from 'react';
import Filters from './components/Filters';
import Shelf from './components/Shelf';
import PdfViewer from './components/PdfViewer';
import SgfViewer from './components/SgfViewer';
import SgfPuzzleViewer from './components/SgfPuzzleViewer';
import HtmlViewer from './components/HtmlViewer';
import UserMenu from './components/UserMenu';
import SgfModeDialog from './components/SgfModeDialog';
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
  const [sgfMode, setSgfMode] = useState<'review' | 'puzzle' | null>(null);
  const [pendingSgfItem, setPendingSgfItem] = useState<ItemSummary | null>(null);
  const [showSgfModeDialog, setShowSgfModeDialog] = useState(false);

  useEffect(() => {
    if (currentUserId) {
      getFavorites(currentUserId).then((items) => setFavorites(new Set(items.map((item) => item.id))));
    }
  }, [currentUserId]);

  useEffect(() => {
    setSelectedItem(null);
    setPendingSgfItem(null);
    setSgfMode(null);
    setShowSgfModeDialog(false);
  }, [currentUserId]);

  const handleSelectItem = async (item: ItemSummary) => {
    if (item.type === 'sgf') {
      setPendingSgfItem(item);
      setSelectedItem(null);
      setSgfMode(null);
      setShowSgfModeDialog(true);
      return;
    }

    setPendingSgfItem(null);
    setSgfMode(null);
    setSelectedItem(item);
    if (currentUserId) {
      await addRecent(currentUserId, item.id);
    }
  };

  const handleSgfModeSelect = (mode: 'review' | 'puzzle') => {
    if (!pendingSgfItem) return;
    setSelectedItem(pendingSgfItem);
    setSgfMode(mode);
    setPendingSgfItem(null);
    setShowSgfModeDialog(false);
  };

  const handleSgfModeCancel = () => {
    setPendingSgfItem(null);
    setSgfMode(null);
    setSelectedItem(null);
    setShowSgfModeDialog(false);
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
      if (sgfMode === 'puzzle') {
        return (
          <SgfPuzzleViewer
            userId={currentUserId}
            item={selectedItem}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavoriteWrapper}
          />
        );
      }
      return (
        <SgfViewer
          userId={currentUserId}
          item={selectedItem}
          isFavorite={isFavorite}
          onToggleFavorite={toggleFavoriteWrapper}
        />
      );
    }
    return <HtmlViewer userId={currentUserId} item={selectedItem} isFavorite={isFavorite} onToggleFavorite={toggleFavoriteWrapper} />;
  }, [selectedItem, currentUserId, favorites, sgfMode]);

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
      {showSgfModeDialog && pendingSgfItem && (
        <SgfModeDialog
          itemTitle={pendingSgfItem.title}
          onSelect={handleSgfModeSelect}
          onCancel={handleSgfModeCancel}
        />
      )}
    </div>
  );
}
