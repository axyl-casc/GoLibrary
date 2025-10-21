import { useEffect, useMemo, useRef, useState } from 'react';
import { addRecent } from '../api/api';
import { ItemSummary } from '../state/types';
import FavoritesToggle from './FavoritesToggle';
import '../styles/viewers.css';

declare global {
  interface Window {
    glift: any;
  }
}

type PuzzleStatus = 'idle' | 'correct' | 'incorrect';

interface SgfPuzzleViewerProps {
  userId: string;
  item: ItemSummary;
  isFavorite: boolean;
  onToggleFavorite: (favored: boolean) => void;
}

let gliftLoader: Promise<void> | null = null;

function ensureGliftScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (window.glift) {
    return Promise.resolve();
  }
  if (!gliftLoader) {
    gliftLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/glift.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = (event) => {
        gliftLoader = null;
        reject(new Error(`Failed to load Glift: ${event instanceof ErrorEvent ? event.message : 'unknown error'}`));
      };
      document.body.appendChild(script);
    });
  }
  return gliftLoader;
}

export default function SgfPuzzleViewer({ userId, item, isFavorite, onToggleFavorite }: SgfPuzzleViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<PuzzleStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const containerId = useMemo(() => `glift-viewer-${item.id}-${Math.random().toString(36).slice(2)}`, [item.id]);

  useEffect(() => {
    setStatus('idle');
    setError(null);
    setLoading(true);

    let cancelled = false;
    let currentWidget: any = null;

    const load = async () => {
      try {
        await ensureGliftScript();
        if (cancelled || !containerRef.current) return;

        const response = await fetch(`/api/items/${item.id}/content`);
        if (!response.ok) {
          throw new Error(`Failed to load SGF (${response.status})`);
        }
        const sgfText = await response.text();
        if (cancelled || !containerRef.current) return;

        await addRecent(userId, item.id);

        const { glift } = window;
        if (!glift) {
          throw new Error('Glift is not available in the window scope');
        }

        containerRef.current.innerHTML = '';

        currentWidget = glift.create({
          divId: containerId,
          sgf: {
            sgfString: sgfText,
            widgetType: glift.enums.widgetTypes.STANDARD_PROBLEM,
          },
          display: {
            disableZoomForMobile: true,
          },
          hooks: {
            problemCorrect: () => {
              if (!cancelled) {
                setStatus('correct');
              }
            },
            problemIncorrect: () => {
              if (!cancelled) {
                setStatus('incorrect');
              }
            },
          },
        });
        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      if (currentWidget && typeof currentWidget.destroy === 'function') {
        currentWidget.destroy();
      }
    };
  }, [containerId, item.id, userId]);

  return (
    <div className="viewer sgf-viewer puzzle-mode">
      <div className="viewer-toolbar">
        <span className="viewer-title">Puzzle Mode</span>
        <FavoritesToggle
          favored={isFavorite}
          onToggle={(event) => {
            event.stopPropagation();
            onToggleFavorite(!isFavorite);
          }}
        />
        <span className={`puzzle-status status-${status}`}>
          {status === 'correct' && '✓ Correct'}
          {status === 'incorrect' && '✗ Incorrect'}
          {status === 'idle' && 'Solve the problem'}
        </span>
      </div>
      <div className="sgf-board puzzle-board" id={containerId} ref={containerRef}>
        {loading && !error && <div className="viewer-loading">Loading puzzle…</div>}
        {error && <div className="viewer-error">{error}</div>}
      </div>
    </div>
  );
}
