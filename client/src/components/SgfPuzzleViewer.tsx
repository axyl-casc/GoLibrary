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
  const widgetRef = useRef<any | null>(null);
  const [status, setStatus] = useState<PuzzleStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const statusRef = useRef<PuzzleStatus>('idle');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

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

        const evaluatePuzzleStatus = (result?: 'correct' | 'incorrect') => {
          if (cancelled) {
            return;
          }

          const widget = widgetRef.current;
          if (!widget || !widget.controller) {
            if (result && statusRef.current !== result) {
              setStatus(result);
            }
            return;
          }

          try {
            const controller = widget.controller;
            const flattened =
              typeof controller.flattenedState === 'function' ? controller.flattenedState() : null;
            const commentValue =
              flattened && typeof flattened.comment === 'function' ? flattened.comment() : '';
            const comment = typeof commentValue === 'string' ? commentValue : '';
            const normalizedComment = comment.toLowerCase();
            const hasCorrectWord =
              /\bcorrect\b/.test(normalizedComment) && !/\balmost\s+correct\b/.test(normalizedComment);

            if (hasCorrectWord) {
              if (statusRef.current !== 'correct') {
                setStatus('correct');
              }
              return;
            }

            if (result === 'correct') {
              if (statusRef.current !== 'correct') {
                setStatus('correct');
              }
              return;
            }

            const movetree = controller.movetree;
            const currentNode = movetree && typeof movetree.node === 'function' ? movetree.node() : null;
            const numChildren =
              currentNode && typeof currentNode.numChildren === 'function'
                ? currentNode.numChildren()
                : undefined;

            if (typeof numChildren === 'number') {
              if (numChildren === 0) {
                if (statusRef.current !== 'incorrect') {
                  setStatus('incorrect');
                }
              } else if (numChildren > 0 && statusRef.current === 'incorrect') {
                setStatus('idle');
              }
            } else if (result === 'incorrect' && statusRef.current !== 'incorrect') {
              setStatus('incorrect');
            }
          } catch (evaluationError) {
            console.warn('Failed to evaluate puzzle status', evaluationError);
            if (result && statusRef.current !== result) {
              setStatus(result);
            }
          }
        };

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
                evaluatePuzzleStatus('correct');
              }
            },
            problemIncorrect: () => {
              if (!cancelled) {
                evaluatePuzzleStatus('incorrect');
              }
            },
          },
        });
        widgetRef.current = currentWidget;
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
        try {
          currentWidget.destroy();
        } catch (destroyError) {
          // Glift can throw if its DOM has already been removed (e.g. StrictMode double-invokes effects).
          console.warn('Failed to destroy Glift widget', destroyError);
        }
      }
      widgetRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
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
      <div className="sgf-board puzzle-board">
        <div className="puzzle-board-inner" id={containerId} ref={containerRef} />
        {loading && !error && <div className="viewer-loading">Loading puzzle…</div>}
        {error && <div className="viewer-error">{error}</div>}
      </div>
    </div>
  );
}
