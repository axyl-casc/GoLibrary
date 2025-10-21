import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import { config } from './config';
import { db, now } from './lib/db';
import { initializeStaticUsers, loadStaticUsers } from './lib/staticUsers';
import { scanLibrary } from './lib/indexer';
import { startWatcher } from './lib/watcher';
import { generateThumbnail } from './lib/thumbs';
import { streamFile } from './lib/fileAccess';

const app = express();

if (config.clientOrigin) {
  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: false
    })
  );
}

app.use(express.json());

initializeStaticUsers();

app.get('/api/users', (_req, res) => {
  res.json(loadStaticUsers());
});

const userManagementDisabled = (_req: express.Request, res: express.Response) => {
  res.status(405).json({ error: 'User management is disabled. Update data/users.json to change users.' });
};

app.post('/api/users', userManagementDisabled);
app.patch('/api/users/:id', userManagementDisabled);
app.delete('/api/users/:id', userManagementDisabled);

app.get('/api/items', (req, res) => {
  const {
    type,
    folder,
    q,
    sort = 'updatedAt',
    page = '1',
    limit = '40',
    favorites,
    userId
  } = req.query as Record<string, string>;
  const clauses: string[] = [];
  const whereParams: any[] = [];
  const joinParams: any[] = [];
  let joinClause = '';

  if (favorites === 'true') {
    if (!userId) {
      return res.status(400).json({ error: 'Favorites filter requires userId' });
    }
    joinClause = 'INNER JOIN favorites ON favorites.itemId = items.id AND favorites.userId = ?';
    joinParams.push(userId);
  }

  if (type) {
    clauses.push('type = ?');
    whereParams.push(type);
  }
  if (folder) {
    clauses.push('folder = ?');
    whereParams.push(folder);
  }
  if (q) {
    clauses.push('(title LIKE ? OR path LIKE ?)');
    whereParams.push(`%${q}%`, `%${q}%`);
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 40, 200);
  const offset = (pageNum - 1) * limitNum;

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  let orderBy = 'ORDER BY updatedAt DESC';
  if (sort === 'title') orderBy = 'ORDER BY title COLLATE NOCASE ASC';
  if (sort === 'recent') orderBy = 'ORDER BY createdAt DESC';
  if (sort === 'lastOpened') {
    orderBy = `ORDER BY COALESCE((
      SELECT MAX(ts) FROM recents WHERE recents.itemId = items.id
    ), 0) DESC`;
  }

  const items = db
    .prepare(
      `SELECT items.*, (
        SELECT path FROM thumbnails WHERE itemId = items.id AND variant = 'grid'
      ) as gridThumb
      FROM items
      ${joinClause}
      ${where}
      ${orderBy}
      LIMIT ? OFFSET ?`
    )
    .all(...joinParams, ...whereParams, limitNum, offset);

  res.json(
    items.map((item: any) => ({
      ...item,
      meta: item.meta ? JSON.parse(item.meta) : null
    }))
  );
});

app.get('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const item = db
    .prepare(
      `SELECT items.*, cover.path as coverPath, grid.path as gridPath FROM items
       LEFT JOIN thumbnails cover ON cover.itemId = items.id AND cover.variant = 'cover'
       LEFT JOIN thumbnails grid ON grid.itemId = items.id AND grid.variant = 'grid'
       WHERE items.id = ?`
    )
    .get(id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json({
    ...item,
    meta: item.meta ? JSON.parse(item.meta) : null
  });
});

app.get('/api/items/:id/content', (req, res) => {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const fullPath = path.join(config.libraryRoot, item.path);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Missing file' });
  const type = mime.lookup(fullPath) || 'application/octet-stream';
  if (item.type === 'pdf') {
    streamFile(res, fullPath, type as string);
  } else if (item.type === 'sgf' || item.type === 'html') {
    const data = fs.readFileSync(fullPath, 'utf-8');
    res.type('text/plain').send(data);
  } else {
    res.status(415).end();
  }
});

function serveHtmlAsset(req: express.Request, res: express.Response) {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!item || item.type !== 'html') {
    return res.status(404).json({ error: 'Not found' });
  }

  const itemFullPath = path.join(config.libraryRoot, item.path);
  if (!fs.existsSync(itemFullPath)) {
    return res.status(404).json({ error: 'Missing file' });
  }

  const assetParam = ((req.params as any)[0] as string | undefined) ?? '';
  const requested = assetParam === '' || assetParam === '/' ? path.basename(itemFullPath) : assetParam;
  const baseDir = path.dirname(itemFullPath);
  const resolved = path.resolve(baseDir, requested);

  if (!resolved.startsWith(baseDir)) {
    return res.status(400).json({ error: 'Invalid asset path' });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  const stats = fs.statSync(resolved);
  if (stats.isDirectory()) {
    return res.status(403).json({ error: 'Cannot serve directory' });
  }

  const type = mime.lookup(resolved) || 'application/octet-stream';
  res.type(type as string).sendFile(resolved);
}

app.get('/api/items/:id/html', serveHtmlAsset);
app.get('/api/items/:id/html/*', serveHtmlAsset);

app.get('/api/thumbnails/:itemId', async (req, res) => {
  const { itemId } = req.params;
  const variant = (req.query.variant as string) || 'cover';
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
  if (!item) return res.status(404).end();
  const mtime = item.mtime;
  const fullPath = path.join(config.libraryRoot, item.path);
  try {
    const thumbPath = await generateThumbnail({
      id: item.id,
      type: item.type,
      path: fullPath,
      mtime,
      variant: variant === 'grid' ? 'grid' : 'cover',
      width: variant === 'grid' ? config.gridWidth : config.thumbWidth,
      height: item.type === 'html' ? Math.round(config.gridWidth * 1.3) : undefined
    });
    res.sendFile(path.resolve(thumbPath));
  } catch (err) {
    res.status(500).json({ error: 'Could not render thumbnail' });
  }
});

// Favorites
app.get('/api/users/:uid/favorites', (req, res) => {
  const { uid } = req.params;
  const rows = db
    .prepare(
      `SELECT items.* FROM favorites
       JOIN items ON items.id = favorites.itemId
       WHERE favorites.userId = ?
       ORDER BY favorites.createdAt DESC`
    )
    .all(uid);
  res.json(rows.map((item: any) => ({ ...item, meta: item.meta ? JSON.parse(item.meta) : null })));
});

app.put('/api/users/:uid/favorites/:itemId', (req, res) => {
  const { uid, itemId } = req.params;
  try {
    db.prepare('INSERT OR IGNORE INTO favorites (userId, itemId, createdAt) VALUES (?, ?, ?)').run(uid, itemId, now());
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: 'Failed to add favorite' });
  }
});

app.delete('/api/users/:uid/favorites/:itemId', (req, res) => {
  const { uid, itemId } = req.params;
  db.prepare('DELETE FROM favorites WHERE userId = ? AND itemId = ?').run(uid, itemId);
  res.status(204).end();
});

// PDF positions
app.get('/api/users/:uid/pdf/:itemId/position', (req, res) => {
  const { uid, itemId } = req.params;
  const row = db.prepare('SELECT page FROM pdf_positions WHERE userId = ? AND itemId = ?').get(uid, itemId);
  res.json(row ?? { page: 1 });
});

app.put('/api/users/:uid/pdf/:itemId/position', (req, res) => {
  const { uid, itemId } = req.params;
  const { page } = req.body;
  db.prepare(
    `INSERT INTO pdf_positions (userId, itemId, page, updatedAt)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(userId, itemId) DO UPDATE SET page = excluded.page, updatedAt = excluded.updatedAt`
  ).run(uid, itemId, page, now());
  res.status(204).end();
});

app.get('/api/users/:uid/pdf/:itemId/bookmarks', (req, res) => {
  const { uid, itemId } = req.params;
  const rows = db
    .prepare('SELECT id, page, note, createdAt FROM pdf_bookmarks WHERE userId = ? AND itemId = ? ORDER BY createdAt DESC')
    .all(uid, itemId);
  res.json(rows);
});

app.post('/api/users/:uid/pdf/:itemId/bookmarks', (req, res) => {
  const { uid, itemId } = req.params;
  const { page, note } = req.body;
  const result = db
    .prepare('INSERT INTO pdf_bookmarks (userId, itemId, page, note, createdAt) VALUES (?, ?, ?, ?, ?)')
    .run(uid, itemId, page, note ?? null, now());
  res.status(201).json({ id: result.lastInsertRowid, page, note: note ?? null });
});

app.delete('/api/users/:uid/pdf/bookmarks/:bookmarkId', (req, res) => {
  const { uid, bookmarkId } = req.params;
  db.prepare('DELETE FROM pdf_bookmarks WHERE id = ? AND userId = ?').run(bookmarkId, uid);
  res.status(204).end();
});

// SGF positions and node favorites
app.get('/api/users/:uid/sgf/:itemId/position', (req, res) => {
  const { uid, itemId } = req.params;
  const row = db.prepare('SELECT nodeIndex FROM sgf_positions WHERE userId = ? AND itemId = ?').get(uid, itemId);
  res.json(row ?? { nodeIndex: 0 });
});

app.put('/api/users/:uid/sgf/:itemId/position', (req, res) => {
  const { uid, itemId } = req.params;
  const { nodeIndex } = req.body;
  db.prepare(
    `INSERT INTO sgf_positions (userId, itemId, nodeIndex, updatedAt)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(userId, itemId) DO UPDATE SET nodeIndex = excluded.nodeIndex, updatedAt = excluded.updatedAt`
  ).run(uid, itemId, nodeIndex, now());
  res.status(204).end();
});

app.get('/api/users/:uid/sgf/:itemId/node-favs', (req, res) => {
  const { uid, itemId } = req.params;
  const rows = db
    .prepare('SELECT nodeIndex FROM sgf_node_favorites WHERE userId = ? AND itemId = ? ORDER BY nodeIndex ASC')
    .all(uid, itemId);
  res.json(rows.map((row: any) => row.nodeIndex));
});

app.put('/api/users/:uid/sgf/:itemId/node-favs/:nodeIndex', (req, res) => {
  const { uid, itemId, nodeIndex } = req.params;
  db.prepare(
    'INSERT OR IGNORE INTO sgf_node_favorites (userId, itemId, nodeIndex, createdAt) VALUES (?, ?, ?, ?)'
  ).run(uid, itemId, nodeIndex, now());
  res.status(204).end();
});

app.delete('/api/users/:uid/sgf/:itemId/node-favs/:nodeIndex', (req, res) => {
  const { uid, itemId, nodeIndex } = req.params;
  db.prepare('DELETE FROM sgf_node_favorites WHERE userId = ? AND itemId = ? AND nodeIndex = ?').run(uid, itemId, nodeIndex);
  res.status(204).end();
});

// Recents
app.get('/api/users/:uid/recents', (req, res) => {
  const { uid } = req.params;
  const limit = parseInt((req.query.limit as string) ?? '50', 10);
  const rows = db
    .prepare(
      `SELECT recents.itemId, recents.ts, items.title, items.type FROM recents
       JOIN items ON items.id = recents.itemId
       WHERE recents.userId = ?
       ORDER BY recents.ts DESC
       LIMIT ?`
    )
    .all(uid, limit);
  res.json(rows);
});

app.post('/api/users/:uid/recents', (req, res) => {
  const { uid } = req.params;
  const { itemId } = req.body;
  db.prepare(
    `INSERT INTO recents (userId, itemId, ts)
     VALUES (?, ?, ?)`
  ).run(uid, itemId, now());
  res.status(201).end();
});

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

async function bootstrap() {
  await scanLibrary();
  startWatcher();
  app.listen(config.port, config.host, () => {
    console.log(`Server listening on ${config.host}:${config.port}`);
  });
}

bootstrap();
