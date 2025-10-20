export type ItemType = 'pdf' | 'sgf' | 'html';

export interface ItemSummary {
  id: number;
  type: ItemType;
  title: string;
  path: string;
  folder?: string;
  size?: number;
  mtime?: number;
  pages?: number;
  gridThumb?: string;
  meta?: Record<string, any> | null;
}

export interface User {
  id: string;
  name: string;
  preferences?: Record<string, any>;
}

export interface PdfBookmark {
  id: number;
  page: number;
  note?: string | null;
  createdAt: number;
}

export interface RecentItem {
  itemId: number;
  ts: number;
  title: string;
  type: ItemType;
}
