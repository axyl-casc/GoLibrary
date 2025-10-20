import chokidar from 'chokidar';
import path from 'path';
import { config } from '../config';
import { scanLibrary } from './indexer';

export function startWatcher() {
  const watcher = chokidar.watch(config.libraryRoot, {
    ignored: (filePath) => path.basename(filePath).startsWith('.'),
    ignoreInitial: true,
    persistent: true
  });

  const debouncedScan = debounce(async () => {
    try {
      await scanLibrary();
    } catch (err) {
      console.error('Rescan failed', err);
    }
  }, 1000);

  watcher.on('add', debouncedScan);
  watcher.on('change', debouncedScan);
  watcher.on('unlink', debouncedScan);
  watcher.on('unlinkDir', debouncedScan);

  return watcher;
}

function debounce(fn: () => void | Promise<void>, delay: number) {
  let timeout: NodeJS.Timeout | undefined;
  return () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn();
    }, delay);
  };
}
