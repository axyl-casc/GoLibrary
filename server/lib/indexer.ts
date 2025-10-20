import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { db, now } from './db';
import { generateThumbnail } from './thumbs';

type ItemType = 'pdf' | 'sgf' | 'html';

const SUPPORTED_EXT: Map<string, ItemType> = new Map([
  ['.pdf', 'pdf'],
  ['.sgf', 'sgf'],
  ['.html', 'html']
]);

function readPdfMetadata(filePath: string): { title?: string; pages?: number } {
  try {
    const data = fs.readFileSync(filePath);
    const str = data.toString('utf-8');
    const titleMatch = str.match(/\/Title \(([^\)]+)\)/);
    const pagesMatch = str.match(/\/Count (\d+)/);
    return {
      title: titleMatch ? titleMatch[1] : undefined,
      pages: pagesMatch ? parseInt(pagesMatch[1], 10) : undefined
    };
  } catch (err) {
    return {};
  }
}

function readSgfMetadata(filePath: string): { title?: string; meta: Record<string, string> } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const props = ['PB', 'PW', 'KM', 'DT', 'EV'];
  const meta: Record<string, string> = {};
  for (const prop of props) {
    const match = content.match(new RegExp(`${prop}\\[([^\\]]*)\\]`));
    if (match) {
      meta[prop] = match[1];
    }
  }
  const title = meta.EV || `${meta.PB ?? 'Black'} vs ${meta.PW ?? 'White'}`;
  return { title, meta };
}

function readHtmlMetadata(filePath: string): { title?: string } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/<title>([^<]*)<\/title>/i);
  return { title: match ? match[1].trim() : undefined };
}

async function walk(dir: string, results: string[] = []): Promise<string[]> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, results);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXT.has(ext)) {
        results.push(full);
      }
    }
  }
  return results;
}

export async function scanLibrary(): Promise<void> {
  if (!fs.existsSync(config.libraryRoot)) {
    fs.mkdirSync(config.libraryRoot, { recursive: true });
  }
  const files = await walk(config.libraryRoot, []);
  const seen = new Set<string>();

  const insert = db.prepare(
    `INSERT INTO items (type, path, title, folder, size, mtime, pages, meta, createdAt, updatedAt)
     VALUES (@type, @path, @title, @folder, @size, @mtime, @pages, @meta, @createdAt, @updatedAt)
     ON CONFLICT(path) DO UPDATE SET
       title=excluded.title,
       folder=excluded.folder,
       size=excluded.size,
       mtime=excluded.mtime,
       pages=excluded.pages,
       meta=excluded.meta,
       updatedAt=excluded.updatedAt
     RETURNING id`
  );

  const existingRows = db.prepare('SELECT id, path FROM items').all();
  const existingPaths = new Map<string, number>(existingRows.map((row: any) => [row.path, row.id]));

  for (const fullPath of files) {
    const relativePath = path.relative(config.libraryRoot, fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const type = SUPPORTED_EXT.get(ext) as ItemType;
    const stats = fs.statSync(fullPath);
    const folder = path.dirname(relativePath);
    const baseTitle = path.basename(relativePath, ext);

    let title: string | undefined;
    let pages: number | undefined;
    let meta: any = undefined;

    try {
      if (type === 'pdf') {
        const pdfMeta = readPdfMetadata(fullPath);
        title = pdfMeta.title ?? baseTitle;
        pages = pdfMeta.pages;
      } else if (type === 'sgf') {
        const sgfMeta = readSgfMetadata(fullPath);
        title = sgfMeta.title ?? baseTitle;
        meta = sgfMeta.meta;
      } else {
        const htmlMeta = readHtmlMetadata(fullPath);
        title = htmlMeta.title ?? baseTitle;
      }
    } catch (err) {
      title = baseTitle;
    }

    const payload = {
      type,
      path: relativePath,
      title,
      folder: folder === '.' ? '' : folder,
      size: stats.size,
      mtime: stats.mtimeMs,
      pages,
      meta: meta ? JSON.stringify(meta) : null,
      createdAt: now(),
      updatedAt: now()
    };

    const row = insert.get(payload) as { id: number };
    seen.add(relativePath);

    const width = config.thumbWidth;
    const height = type === 'html' ? Math.round(config.thumbWidth * 1.3) : undefined;

    await generateThumbnail({
      id: row.id,
      type,
      path: fullPath,
      mtime: stats.mtimeMs,
      variant: 'cover',
      width,
      height
    });
    await generateThumbnail({
      id: row.id,
      type,
      path: fullPath,
      mtime: stats.mtimeMs,
      variant: 'grid',
      width: config.gridWidth,
      height: type === 'html' ? Math.round(config.gridWidth * 1.3) : undefined
    });
  }

  for (const [existingPath, id] of existingPaths.entries()) {
    if (!seen.has(existingPath)) {
      db.prepare('DELETE FROM items WHERE id = ?').run(id);
    }
  }
}
