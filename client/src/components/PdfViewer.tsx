import { useEffect, useRef, useState } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const pdf = await pdfjsLib.getDocument({ url: `/api/items/${item.id}/content` }).promise;
      if (cancelled) return;
      setDoc(pdf);
      setPageCount(pdf.numPages);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !doc) return;
    const renderPage = async () => {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context as CanvasRenderingContext2D, viewport }).promise;
      await savePdfPosition(userId, item.id, pageNumber);
    };
    renderPage();
  }, [doc, pageNumber, scale, item.id, userId]);

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
  const zoomIn = () => setScale((prev) => prev * 1.2);
  const zoomOut = () => setScale((prev) => Math.max(prev / 1.2, 0.5));
  const fitWidth = () => setScale(1.2);

  return (
    <div className="viewer pdf-viewer">
      <div className="viewer-toolbar">
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
