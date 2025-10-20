import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { Response } from 'express';

export function resolveLibraryPath(relativePath: string): string {
  const resolved = path.resolve(config.libraryRoot, '.' + path.sep + relativePath);
  if (!resolved.startsWith(config.libraryRoot)) {
    throw new Error('Invalid path');
  }
  return resolved;
}

export function pathToRelative(fullPath: string): string {
  return path.relative(config.libraryRoot, fullPath);
}

export function streamFile(res: Response, fullPath: string, mimeType: string) {
  const stat = fs.statSync(fullPath);
  const range = res.req.headers.range;
  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    let start = parseInt(startStr, 10);
    let end = endStr ? parseInt(endStr, 10) : stat.size - 1;
    if (isNaN(start) || isNaN(end) || start > end) {
      start = 0;
      end = stat.size - 1;
    }
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType
    });
    fs.createReadStream(fullPath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': mimeType
    });
    fs.createReadStream(fullPath).pipe(res);
  }
}

export function readFileSafe(fullPath: string): Buffer {
  if (!fullPath.startsWith(config.libraryRoot)) {
    throw new Error('Attempt to read outside library');
  }
  return fs.readFileSync(fullPath);
}
