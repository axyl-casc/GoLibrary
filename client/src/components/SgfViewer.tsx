import { useEffect, useRef, useState } from 'react';
import 'besogo/besogo.all.js';
import 'besogo/css/besogo.css';
import 'besogo/css/board-wood.css';
import { addRecent, getSgfNodeFavorites, getSgfPosition, saveSgfPosition, toggleSgfNodeFavorite } from '../api/api';
import { ItemSummary } from '../state/types';
import FavoritesToggle from './FavoritesToggle';
import '../styles/viewers.css';

declare global {
  interface Window {
    besogo: any;
  }
}

interface SgfViewerProps {
  userId: string;
  item: ItemSummary;
  isFavorite: boolean;
  onToggleFavorite: (favored: boolean) => void;
}

export default function SgfViewer({ userId, item, isFavorite, onToggleFavorite }: SgfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [editor, setEditor] = useState<any>(null);
  const [nodeIndex, setNodeIndex] = useState(0);
  const [nodeFavorites, setNodeFavorites] = useState<Set<number>>(new Set());
  const [autoplay, setAutoplay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemIdRef = useRef(item.id);
  const userIdRef = useRef(userId);
  const restoringRef = useRef(false);

  useEffect(() => {
    itemIdRef.current = item.id;
  }, [item.id]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (autoplay && editor) {
      interval = setInterval(() => {
        if (editor.getCurrent().children.length === 0) {
          setAutoplay(false);
          return;
        }
        editor.nextNode(1);
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoplay, editor]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!containerRef.current || cancelled) return;
      setLoading(true);
      setError(null);
      setAutoplay(false);
      setNodeFavorites(new Set());
      setNodeIndex(0);
      const response = await fetch(`/api/items/${item.id}/content`);
      if (!response.ok) {
        throw new Error(`Failed to load SGF (${response.status})`);
      }
      if (cancelled) return;
      const sgfText = await response.text();
      if (cancelled) return;
      const container = containerRef.current;
      if (!container) return;
      const containerWithEditor = container as HTMLDivElement & { besogoEditor?: any };
      const { besogo } = window;
      if (!besogo) {
        throw new Error('BesoGo is not available in the window scope');
      }
      if (!container.classList.contains('besogo-container') || !containerWithEditor.besogoEditor) {
        container.innerHTML = '';
        besogo.create(container, {
          panels: 'control+names+comment+tree',
          tool: 'navOnly',
        });
      }
      const newEditor = containerWithEditor.besogoEditor;
      if (!newEditor) {
        throw new Error('Failed to initialize BesoGo viewer');
      }
      const parsed = besogo.parseSgf(sgfText);
      besogo.loadSgf(parsed, newEditor);
      newEditor.setTool('navOnly');
      setEditor(newEditor);
      await addRecent(userId, item.id);
      if (cancelled) return;
      const saved = await getSgfPosition(userId, item.id);
      if (cancelled) return;
      restoringRef.current = true;
      moveToNodeInternal(newEditor, saved?.nodeIndex ?? 0);
      setNodeIndex(saved?.nodeIndex ?? 0);
      restoringRef.current = false;
      const favorites = await getSgfNodeFavorites(userId, item.id);
      if (cancelled) return;
      setNodeFavorites(new Set(favorites));
      if (cancelled) return;
      setLoading(false);
    };
    load().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [item.id, userId]);

  useEffect(() => {
    if (!editor) return;
    let disposed = false;

    const listener = (msg: any) => {
      if (disposed || !msg.navChange) {
        return;
      }
      const current = editor.getCurrent();
      const moveNumber = current.moveNumber || 0;
      setNodeIndex(moveNumber);
      if (!restoringRef.current) {
        saveSgfPosition(userIdRef.current, itemIdRef.current, moveNumber).catch(() => {
          /* ignore persistence errors */
        });
      }
    };

    editor.addListener(listener);

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        editor.prevNode(1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        editor.nextNode(1);
      }
    };

    window.addEventListener('keydown', handler);

    return () => {
      disposed = true;
      window.removeEventListener('keydown', handler);
    };
  }, [editor]);

  function moveToNodeInternal(ed: any, target: number) {
    while (ed.getCurrent().parent) {
      ed.prevNode(1);
    }
    let steps = 0;
    while (steps < target && ed.getCurrent().children.length > 0) {
      ed.nextNode(1);
      steps++;
    }
  }

  const toggleNodeFavorite = async () => {
    const favored = nodeFavorites.has(nodeIndex);
    await toggleSgfNodeFavorite(userId, item.id, nodeIndex, !favored);
    const updated = await getSgfNodeFavorites(userId, item.id);
    setNodeFavorites(new Set(updated));
  };

  return (
    <div className="viewer sgf-viewer">
      <div className="viewer-toolbar">
        <span>Move {nodeIndex}</span>
        <button disabled={!editor} onClick={() => setAutoplay((prev) => !prev)}>{autoplay ? 'Stop' : 'Autoplay'}</button>
        <FavoritesToggle
          favored={isFavorite}
          onToggle={(event) => {
            event.stopPropagation();
            onToggleFavorite(!isFavorite);
          }}
        />
        <button className={nodeFavorites.has(nodeIndex) ? 'favored' : ''} onClick={toggleNodeFavorite}>
          {nodeFavorites.has(nodeIndex) ? '★ Node' : '☆ Node'}
        </button>
      </div>
      <div className="sgf-board">
        <div className="besogo-viewer" ref={containerRef} />
        {loading && !error && <div className="viewer-loading">Loading game…</div>}
        {error && <div className="viewer-error">{error}</div>}
      </div>
    </div>
  );
}
