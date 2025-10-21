import { useEffect, useMemo, useState } from 'react';
import Filters from './components/Filters';
import Shelf from './components/Shelf';
import PdfViewer from './components/PdfViewer';
import SgfViewer from './components/SgfViewer';
import SgfPuzzleViewer from './components/SgfPuzzleViewer';
import HtmlViewer from './components/HtmlViewer';
import UserMenu from './components/UserMenu';
import SgfModeDialog from './components/SgfModeDialog';
import { getFavorites, getItem, toggleFavorite } from './api/api';
import { useQueryState } from './state/useQuery';
import { useUser } from './state/useUser';
import { ItemSummary } from './state/types';
import './styles/base.css';

export default function App() {
  const { users, currentUserId, selectUser } = useUser();
  const { query, update } = useQueryState({ sort: 'updatedAt' });
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [pendingSgfItem, setPendingSgfItem] = useState<ItemSummary | null>(null);
  const [showSgfModeDialog, setShowSgfModeDialog] = useState(false);
  const searchParams = new URLSearchParams(window.location.search);
  const viewerIdParam = searchParams.get('viewerId');
  const viewerModeParam = searchParams.get('viewerMode');
  const viewerId = viewerIdParam ? Number(viewerIdParam) : null;
  const viewerModeFromParams = viewerModeParam === 'puzzle' ? 'puzzle' : viewerModeParam === 'review' ? 'review' : null;
  const isViewerTab = viewerId !== null && !Number.isNaN(viewerId);
  const [viewerItem, setViewerItem] = useState<ItemSummary | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUserId) {
      getFavorites(currentUserId).then((items) => setFavorites(new Set(items.map((item) => item.id))));
    }
  }, [currentUserId]);

  useEffect(() => {
    setPendingSgfItem(null);
    setShowSgfModeDialog(false);
  }, [currentUserId]);

  useEffect(() => {
    if (!isViewerTab || viewerId === null) {
      setViewerItem(null);
      setViewerError(null);
      setViewerLoading(false);
      return;
    }

    setViewerLoading(true);
    setViewerError(null);
    getItem(viewerId)
      .then((item) => {
        setViewerItem(item);
      })
      .catch((error) => {
        setViewerError(error instanceof Error ? error.message : 'Failed to load item');
        setViewerItem(null);
      })
      .finally(() => setViewerLoading(false));
  }, [isViewerTab, viewerId]);

  const handleSelectItem = (item: ItemSummary) => {
    if (item.type === 'sgf') {
      setPendingSgfItem(item);
      setShowSgfModeDialog(true);
      return;
    }

    setPendingSgfItem(null);
    const url = new URL(window.location.href);
    url.searchParams.set('viewerId', String(item.id));
    url.searchParams.delete('viewerMode');
    window.open(url.toString(), '_blank', 'noopener');
  };

  const handleSgfModeSelect = (mode: 'review' | 'puzzle') => {
    if (!pendingSgfItem) return;
    const url = new URL(window.location.href);
    url.searchParams.set('viewerId', String(pendingSgfItem.id));
    url.searchParams.set('viewerMode', mode);
    window.open(url.toString(), '_blank', 'noopener');
    setPendingSgfItem(null);
    setShowSgfModeDialog(false);
  };

  const handleSgfModeCancel = () => {
    setPendingSgfItem(null);
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

  const activeItem = isViewerTab ? viewerItem : null;
  const activeSgfMode = isViewerTab ? viewerModeFromParams : null;

  const viewer = useMemo(() => {
    if (!activeItem || !currentUserId) return null;
    const isFavorite = favorites.has(activeItem.id);
    const toggleFavoriteWrapper = async (favored: boolean) => {
      await toggleFavorite(currentUserId, activeItem.id, favored);
      setFavorites((prev) => {
        const updated = new Set(prev);
        if (favored) {
          updated.add(activeItem.id);
        } else {
          updated.delete(activeItem.id);
        }
        return updated;
      });
    };

    if (activeItem.type === 'pdf') {
      return <PdfViewer userId={currentUserId} item={activeItem} isFavorite={isFavorite} onToggleFavorite={toggleFavoriteWrapper} />;
    }
    if (activeItem.type === 'sgf') {
      if (activeSgfMode === 'puzzle') {
        return (
          <SgfPuzzleViewer
            userId={currentUserId}
            item={activeItem}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavoriteWrapper}
          />
        );
      }
      return (
        <SgfViewer
          userId={currentUserId}
          item={activeItem}
          isFavorite={isFavorite}
          onToggleFavorite={toggleFavoriteWrapper}
        />
      );
    }
    return <HtmlViewer userId={currentUserId} item={activeItem} isFavorite={isFavorite} onToggleFavorite={toggleFavoriteWrapper} />;
  }, [activeItem, currentUserId, favorites, activeSgfMode]);

  const openViewerPrompt = showSgfModeDialog && pendingSgfItem;

  const renderViewerSection = () => {
    if (!isViewerTab) {
      return null;
    }

    if (!currentUserId) {
      return <div className="viewer-placeholder">Select a user to view items.</div>;
    }

    if (viewerLoading) {
      return <div className="viewer-placeholder">Loading item…</div>;
    }

    if (viewerError) {
      return <div className="viewer-placeholder error">{viewerError}</div>;
    }

    if (!viewer) {
      return <div className="viewer-placeholder">Item not available.</div>;
    }

    return viewer;
  };

  return (
    <div className="app">
      <header>
        <h1>Go Library</h1>
        <UserMenu users={users} currentUserId={currentUserId} onSelectUser={selectUser} />
      </header>
      {!isViewerTab && (
        <>
          <Filters query={query} onChange={update} />
          <div className="main-content">
            <Shelf
              query={query}
              favorites={favorites}
              onSelect={handleSelectItem}
              onToggleFavorite={toggleItemFavorite}
            />
          </div>
        </>
      )}
      {isViewerTab && <div className="viewer-page">{renderViewerSection()}</div>}
      {openViewerPrompt && (
        <SgfModeDialog
          itemTitle={pendingSgfItem.title}
          onSelect={handleSgfModeSelect}
          onCancel={handleSgfModeCancel}
        />
      )}
    </div>
  );
}
