import path from 'path';

const rootDir = process.cwd();

export interface AppConfig {
  libraryRoot: string;
  dataRoot: string;
  thumbWidth: number;
  gridWidth: number;
  concurrencyThumbs: number;
  enableHtmlThumbnails: boolean;
  port: number;
  clientOrigin?: string;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

export const config: AppConfig = {
  libraryRoot: path.resolve(process.env.LIBRARY_ROOT ?? path.join(rootDir, 'library')),
  dataRoot: path.resolve(process.env.DATA_ROOT ?? path.join(rootDir, 'data')),
  thumbWidth: intFromEnv('THUMB_WIDTH', 400),
  gridWidth: intFromEnv('GRID_WIDTH', 260),
  concurrencyThumbs: intFromEnv('CONCURRENCY_THUMBS', 2),
  enableHtmlThumbnails: (process.env.ENABLE_HTML_THUMBNAILS ?? 'false').toLowerCase() === 'true',
  port: intFromEnv('PORT', 4000),
  clientOrigin: process.env.CLIENT_ORIGIN
};

export const paths = {
  thumbs: path.join(config.dataRoot, 'thumbs'),
  database: path.join(config.dataRoot, 'library.db'),
  migrations: path.resolve(rootDir, 'migrations')
};
