import fs from 'fs';
import path from 'path';
import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.js';
import { config, paths } from '../config';
import { db, now } from './db';

const PDF_WORKER = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');
GlobalWorkerOptions.workerSrc = PDF_WORKER;

export type ThumbnailVariant = 'cover' | 'grid';

export interface ThumbnailRequest {
  id: number;
  type: 'pdf' | 'sgf' | 'html';
  path: string;
  mtime: number;
  variant: ThumbnailVariant;
  width: number;
  height?: number;
}

function ensureThumbDirectory() {
  if (!fs.existsSync(paths.thumbs)) {
    fs.mkdirSync(paths.thumbs, { recursive: true });
  }
}

ensureThumbDirectory();

function thumbFileName(itemId: number, variant: ThumbnailVariant): string {
  return path.join(paths.thumbs, `${itemId}-${variant}.png`);
}

async function renderPdfThumbnail(request: ThumbnailRequest): Promise<Buffer> {
  const data = new Uint8Array(fs.readFileSync(request.path));
  const document: PDFDocumentProxy = await getDocument({ data }).promise;
  const page = await document.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = request.width / viewport.width;
  const scaledViewport = page.getViewport({ scale });
  const canvas = createCanvas(scaledViewport.width, scaledViewport.height);
  const context = canvas.getContext('2d');

  const renderContext: any = {
    canvasContext: context,
    viewport: scaledViewport
  };
  await page.render(renderContext).promise;
  return canvas.toBuffer('image/png');
}

interface SgfParseResult {
  size: number;
  blackStones: [number, number][];
  whiteStones: [number, number][];
}

function parseSgfMoves(sgf: string): SgfParseResult {
  const sizeMatch = sgf.match(/\bSZ\[(\d+)\]/);
  const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 19;
  const blackStones: [number, number][] = [];
  const whiteStones: [number, number][] = [];

  const moveRegex = /;(B|W)\[([^\]]*)\]/g;
  let match: RegExpExecArray | null;
  while ((match = moveRegex.exec(sgf))) {
    const color = match[1];
    const coord = match[2];
    if (coord === '' || coord === 'tt') continue; // pass
    const x = coord.charCodeAt(0) - 97;
    const y = coord.charCodeAt(1) - 97;
    if (x < 0 || y < 0) continue;
    if (color === 'B') {
      blackStones.push([x, y]);
    } else {
      whiteStones.push([x, y]);
    }
  }

  return { size, blackStones, whiteStones };
}

function drawBoard(ctx: CanvasRenderingContext2D, size: number, width: number) {
  ctx.fillStyle = '#d0a15b';
  ctx.fillRect(0, 0, width, width);
  const padding = width * 0.05;
  const grid = width - padding * 2;
  const step = grid / (size - 1);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = Math.max(1, width * 0.0025);

  for (let i = 0; i < size; i++) {
    const offset = padding + i * step;
    ctx.beginPath();
    ctx.moveTo(padding, offset);
    ctx.lineTo(width - padding, offset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(offset, padding);
    ctx.lineTo(offset, width - padding);
    ctx.stroke();
  }

  const hoshi = [3, size / 2, size - 4].filter((v) => Number.isInteger(v) && v > 0 && v < size - 1) as number[];
  ctx.fillStyle = '#000';
  const radius = Math.max(2, width * 0.01);
  for (const i of hoshi) {
    for (const j of hoshi) {
      const cx = padding + i * step;
      const cy = padding + j * step;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawStones(
  ctx: CanvasRenderingContext2D,
  stones: [number, number][],
  size: number,
  width: number,
  color: 'black' | 'white'
) {
  const padding = width * 0.05;
  const grid = width - padding * 2;
  const step = grid / (size - 1);
  const radius = step * 0.45;
  ctx.fillStyle = color === 'black' ? '#111' : '#eee';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = Math.max(1, width * 0.002);
  for (const [x, y] of stones) {
    const cx = padding + x * step;
    const cy = padding + y * step;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

async function renderSgfThumbnail(request: ThumbnailRequest): Promise<Buffer> {
  const sgf = fs.readFileSync(request.path, 'utf-8');
  const parsed = parseSgfMoves(sgf);
  const width = request.width;
  const canvas = createCanvas(width, width);
  const ctx = canvas.getContext('2d');
  drawBoard(ctx, parsed.size, width);
  drawStones(ctx, parsed.blackStones, parsed.size, width, 'black');
  drawStones(ctx, parsed.whiteStones, parsed.size, width, 'white');
  return canvas.toBuffer('image/png');
}

async function renderHtmlThumbnail(request: ThumbnailRequest): Promise<Buffer> {
  const width = request.width;
  const height = request.height ?? Math.round(width * 1.3);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#2d3b4f';
  ctx.font = `${Math.round(width * 0.2)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('HTML', width / 2, height / 2);
  return canvas.toBuffer('image/png');
}

export async function generateThumbnail(request: ThumbnailRequest): Promise<string> {
  const filePath = thumbFileName(request.id, request.variant);
  const needsUpdate = (() => {
    if (!fs.existsSync(filePath)) return true;
    const stats = fs.statSync(filePath);
    return stats.mtimeMs < request.mtime;
  })();
  if (!needsUpdate) {
    return filePath;
  }

  let buffer: Buffer;
  if (request.type === 'pdf') {
    buffer = await renderPdfThumbnail(request);
  } else if (request.type === 'sgf') {
    buffer = await renderSgfThumbnail(request);
  } else {
    buffer = await renderHtmlThumbnail(request);
  }
  fs.writeFileSync(filePath, buffer);

  db.prepare(
    `INSERT INTO thumbnails (itemId, variant, path, width, height, updatedAt)
     VALUES (@itemId, @variant, @path, @width, @height, @updatedAt)
     ON CONFLICT(itemId, variant) DO UPDATE SET path=excluded.path, updatedAt=excluded.updatedAt`
  ).run({
    itemId: request.id,
    variant: request.variant,
    path: filePath,
    width: request.width,
    height: request.height ?? request.width,
    updatedAt: now()
  });

  return filePath;
}
