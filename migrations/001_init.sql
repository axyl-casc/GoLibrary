PRAGMA journal_mode=WAL;

CREATE TABLE items (
  id INTEGER PRIMARY KEY,
  type TEXT CHECK (type IN ('pdf','sgf','html')) NOT NULL,
  path TEXT UNIQUE NOT NULL,
  title TEXT,
  folder TEXT,
  size INTEGER,
  mtime INTEGER,
  pages INTEGER,
  meta JSON,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE thumbnails (
  id INTEGER PRIMARY KEY,
  itemId INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  variant TEXT CHECK (variant IN ('cover','grid')) NOT NULL,
  path TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  updatedAt INTEGER NOT NULL,
  UNIQUE(itemId, variant)
);
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_folder ON items(folder);
CREATE INDEX idx_items_title ON items(title);
