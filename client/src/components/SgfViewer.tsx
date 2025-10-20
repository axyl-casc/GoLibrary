import { useEffect, useRef, useState } from 'react';
import 'besogo/besogo.all.js';
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
    if (!editor) return;
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
    return () => window.removeEventListener('keydown', handler);
  }, [editor]);

  useEffect(() => {
    const load = async () => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';
      const response = await fetch(`/api/items/${item.id}/content`);
      const sgfText = await response.text();
      const { besogo } = window;
      const newEditor = besogo.makeEditor(19, 19);
      newEditor.setTool('navOnly');
      besogo.makeBoardDisplay(containerRef.current, newEditor);
      const parsed = besogo.parseSgf(sgfText);
      besogo.loadSgf(parsed, newEditor);
      newEditor.addListener(async (msg: any) => {
        if (msg.navChange) {
          const current = newEditor.getCurrent();
          const moveNumber = current.moveNumber || 0;
          setNodeIndex(moveNumber);
          await saveSgfPosition(userId, item.id, moveNumber);
        }
      });
      setEditor(newEditor);
      await addRecent(userId, item.id);
      const saved = await getSgfPosition(userId, item.id);
      moveToNodeInternal(newEditor, saved?.nodeIndex ?? 0);
      setNodeIndex(saved?.nodeIndex ?? 0);
      const favorites = await getSgfNodeFavorites(userId, item.id);
      setNodeFavorites(new Set(favorites));
    };
    load();
  }, [item.id, userId]);

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

  const goFirst = () => {
    if (!editor) return;
    moveToNodeInternal(editor, 0);
    setNodeIndex(0);
  };

  const goPrev = () => {
    if (!editor) return;
    editor.prevNode(1);
  };

  const goNext = () => {
    if (!editor) return;
    editor.nextNode(1);
  };

  const goLast = () => {
    if (!editor) return;
    let steps = 0;
    while (editor.getCurrent().children.length > 0 && steps < 1000) {
      editor.nextNode(1);
      steps++;
    }
  };

  const toggleNodeFavorite = async () => {
    const favored = nodeFavorites.has(nodeIndex);
    await toggleSgfNodeFavorite(userId, item.id, nodeIndex, !favored);
    const updated = await getSgfNodeFavorites(userId, item.id);
    setNodeFavorites(new Set(updated));
  };

  return (
    <div className="viewer sgf-viewer">
      <div className="viewer-toolbar">
        <button onClick={goFirst}>⏮</button>
        <button onClick={goPrev}>◀</button>
        <span>Move {nodeIndex}</span>
        <button onClick={goNext}>▶</button>
        <button onClick={goLast}>⏭</button>
        <button onClick={() => setAutoplay((prev) => !prev)}>{autoplay ? 'Stop' : 'Autoplay'}</button>
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
      <div className="sgf-board" ref={containerRef} />
    </div>
  );
}
