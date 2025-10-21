import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker?url';
import { addRecent, getPdfPosition, savePdfPosition } from '../api/api';
import { ItemSummary } from '../state/types';
import FavoritesToggle from './FavoritesToggle';
import BookmarksPanel from './BookmarksPanel';
import '../styles/viewers.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfViewerProps {
  userId: string;
  item: ItemSummary;
  isFavorite: boolean;
  onToggleFavorite: (favored: boolean) => void;
}

export default function PdfViewer({ userId, item, isFavorite, onToggleFavorite }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [autoFit, setAutoFit] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const pdf = await pdfjsLib.getDocument({ url: `/api/items/${item.id}/content` }).promise;
      if (cancelled) return;
      setDoc(pdf);
      setPageCount(pdf.numPages);
      setAutoFit(true);
      setScale(1);
      const { page } = await getPdfPosition(userId, item.id);
      setPageNumber(page ?? 1);
      await addRecent(userId, item.id);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [item.id, userId]);

  const fitPageToWindow = useCallback(
    async (pageOverride?: pdfjsLib.PDFPageProxy) => {
      if (!doc || !containerRef.current) return null;
      const page = pageOverride ?? (await doc.getPage(pageNumber));
      const viewport = page.getViewport({ scale: 1 });
      const container = containerRef.current;
      const toolbarHeight = toolbarRef.current?.offsetHeight ?? 0;
      const { top } = container.getBoundingClientRect();
      const availableHeight = Math.max(window.innerHeight - top - toolbarHeight - 24, 200);
      const availableWidth = container.clientWidth;
      if (!availableWidth || !availableHeight) return null;
      const widthScale = availableWidth / viewport.width;
      const heightScale = availableHeight / viewport.height;
      const nextScale = Math.max(Math.min(widthScale, heightScale), 0.5);
      if (Math.abs(nextScale - scale) > 0.001) {
        setScale(nextScale);
      }
      return nextScale;
    },
    [doc, pageNumber, scale]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !doc || loading) return;
    const renderPage = async () => {
      const page = await doc.getPage(pageNumber);
      let renderScale = scale;
      if (autoFit) {
        const fittedScale = await fitPageToWindow(page);
        if (fittedScale) {
          renderScale = fittedScale;
        }
      }
      const renderViewport = page.getViewport({ scale: renderScale });
      const context = canvas.getContext('2d');
      canvas.height = renderViewport.height;
      canvas.width = renderViewport.width;
      await page.render({ canvasContext: context as CanvasRenderingContext2D, viewport: renderViewport }).promise;
      await savePdfPosition(userId, item.id, pageNumber);
    };
    renderPage();
  }, [autoFit, doc, fitPageToWindow, pageNumber, scale, item.id, userId, loading]);

  useEffect(() => {
    if (!autoFit) return;
    const handleResize = () => {
      void fitPageToWindow();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [autoFit, fitPageToWindow]);

  useEffect(() => {
    if (!autoFit || !containerRef.current) return;
    const observer = new ResizeObserver(() => {
      void fitPageToWindow();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [autoFit, fitPageToWindow]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previousPage();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextPage();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const nextPage = () => setPageNumber((prev) => Math.min(prev + 1, pageCount));
  const previousPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const zoomIn = () => {
    setAutoFit(false);
    setScale((prev) => prev * 1.2);
  };
  const zoomOut = () => {
    setAutoFit(false);
    setScale((prev) => Math.max(prev / 1.2, 0.5));
  };
  const fitWidth = () => {
    setAutoFit(true);
    void fitPageToWindow();
  };

  return (
    <div className="viewer pdf-viewer" ref={containerRef}>
      <div className="viewer-toolbar" ref={toolbarRef}>
        <button onClick={previousPage} disabled={pageNumber === 1}>
          Previous
        </button>
        <span>
          Page {pageNumber} / {pageCount}
        </span>
        <button onClick={nextPage} disabled={pageNumber === pageCount}>
          Next
        </button>
        <button onClick={zoomOut}>-</button>
        <button onClick={zoomIn}>+</button>
        <button onClick={fitWidth}>Fit</button>
        <label>
          Go to
          <input
            type="number"
            min={1}
            max={pageCount}
            value={pageNumber}
            onChange={(event) => setPageNumber(Math.min(Math.max(Number(event.target.value), 1), pageCount))}
          />
        </label>
        <FavoritesToggle
          favored={isFavorite}
          onToggle={(event) => {
            event.stopPropagation();
            onToggleFavorite(!isFavorite);
          }}
        />
      </div>
      {loading ? <div className="viewer-placeholder">Loading PDF…</div> : <canvas ref={canvasRef} />}
      <BookmarksPanel userId={userId} itemId={item.id} currentPage={pageNumber} onNavigate={setPageNumber} />
    </div>
  );
}
