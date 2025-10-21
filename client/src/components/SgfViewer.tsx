import { useCallback, useEffect, useRef, useState } from 'react';
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
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const panelsContainerRef = useRef<HTMLDivElement | null>(null);
  const viewerRootRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [editor, setEditor] = useState<any>(null);
  const [nodeIndex, setNodeIndex] = useState(0);
  const [nodeFavorites, setNodeFavorites] = useState<Set<number>>(new Set());
  const [autoplay, setAutoplay] = useState(false);

  const updateBoardSize = useCallback(() => {
    const container = containerRef.current;
    const board = boardContainerRef.current;
    const panels = panelsContainerRef.current;
    const viewerRoot = viewerRootRef.current;
    if (!container || !board || !viewerRoot) return;
    const viewportHeight = window.innerHeight;
    const viewerTop = viewerRoot.getBoundingClientRect().top;
    const toolbarHeight = toolbarRef.current?.offsetHeight ?? 0;
    const availableHeight = Math.max(viewportHeight - viewerTop - toolbarHeight - 48, 240);
    const containerWidth = container.getBoundingClientRect().width;
    const size = Math.min(containerWidth, availableHeight);
    board.style.width = `${size}px`;
    board.style.height = `${size}px`;
    if (panels) {
      panels.style.width = `${size}px`;
    }
  }, []);

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
    let cancelled = false;

    const load = async () => {
      if (!containerRef.current || cancelled) return;
      containerRef.current.innerHTML = '';
      containerRef.current.classList.add('besogo-container');
      containerRef.current.classList.add('besogo-custom-container');
      containerRef.current.style.justifyContent = 'center';
      containerRef.current.style.alignItems = 'center';
      containerRef.current.style.flexDirection = 'column';
      containerRef.current.style.gap = '12px';
      boardContainerRef.current = null;
      panelsContainerRef.current = null;
      const response = await fetch(`/api/items/${item.id}/content`);
      if (cancelled) return;
      const sgfText = await response.text();
      if (cancelled) return;
      const { besogo } = window;
      const newEditor = besogo.makeEditor(19, 19);
      newEditor.setTool('navOnly');
      const boardDiv = document.createElement('div');
      boardDiv.className = 'besogo-board';
      if (cancelled) return;
      containerRef.current.appendChild(boardDiv);
      boardContainerRef.current = boardDiv;
      const panelsDiv = document.createElement('div');
      panelsDiv.className = 'besogo-panels';
      if (cancelled) return;
      containerRef.current.appendChild(panelsDiv);
      panelsContainerRef.current = panelsDiv;
      if (cancelled) return;
      besogo.makeBoardDisplay(boardDiv, newEditor);
      besogo.makeControlPanel(panelsDiv, newEditor);
      updateBoardSize();
      if (cancelled) return;
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
      if (cancelled) return;
      setEditor(newEditor);
      await addRecent(userId, item.id);
      if (cancelled) return;
      const saved = await getSgfPosition(userId, item.id);
      if (cancelled) return;
      moveToNodeInternal(newEditor, saved?.nodeIndex ?? 0);
      setNodeIndex(saved?.nodeIndex ?? 0);
      const favorites = await getSgfNodeFavorites(userId, item.id);
      if (cancelled) return;
      setNodeFavorites(new Set(favorites));
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [item.id, updateBoardSize, userId]);

  useEffect(() => {
    if (!editor) return;
    updateBoardSize();
    window.addEventListener('resize', updateBoardSize);
    return () => {
      window.removeEventListener('resize', updateBoardSize);
    };
  }, [editor, updateBoardSize]);

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
    <div className="viewer sgf-viewer" ref={viewerRootRef}>
      <div className="viewer-toolbar" ref={toolbarRef}>
        <span>Move {nodeIndex}</span>
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
