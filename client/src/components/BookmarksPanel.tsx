import { useEffect, useState } from 'react';
import { addPdfBookmark, deletePdfBookmark, getPdfBookmarks } from '../api/api';
import { PdfBookmark } from '../state/types';
import '../styles/viewers.css';

interface BookmarksPanelProps {
  userId: string;
  itemId: number;
  onNavigate: (page: number) => void;
  currentPage: number;
}

export default function BookmarksPanel({ userId, itemId, onNavigate, currentPage }: BookmarksPanelProps) {
  const [bookmarks, setBookmarks] = useState<PdfBookmark[]>([]);
  const [note, setNote] = useState('');

  const load = () => {
    getPdfBookmarks(userId, itemId).then(setBookmarks);
  };

  useEffect(() => {
    load();
  }, [userId, itemId]);

  const handleAdd = async () => {
    await addPdfBookmark(userId, itemId, currentPage, note);
    setNote('');
    load();
  };

  const handleDelete = async (id: number) => {
    await deletePdfBookmark(userId, id);
    load();
  };

  return (
    <aside className="bookmark-panel">
      <h4>Bookmarks</h4>
      <div className="bookmark-form">
        <span>Page {currentPage}</span>
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note (optional)" />
        <button onClick={handleAdd}>Add bookmark</button>
      </div>
      <ul>
        {bookmarks.map((bookmark) => (
          <li key={bookmark.id}>
            <button onClick={() => onNavigate(bookmark.page)}>Page {bookmark.page}</button>
            {bookmark.note && <span className="note">{bookmark.note}</span>}
            <button className="danger" onClick={() => handleDelete(bookmark.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
