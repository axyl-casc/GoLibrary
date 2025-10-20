import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { config, paths } from '../config';

const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  appliedAt INTEGER NOT NULL
)`;

function ensureDirectories() {
  if (!fs.existsSync(config.dataRoot)) {
    fs.mkdirSync(config.dataRoot, { recursive: true });
  }
  if (!fs.existsSync(paths.thumbs)) {
    fs.mkdirSync(paths.thumbs, { recursive: true });
  }
}

ensureDirectories();

export const db = new Database(paths.database);

db.pragma('journal_mode = WAL');

db.exec(MIGRATIONS_TABLE);

function getAppliedMigrations(): Set<string> {
  const rows = db.prepare('SELECT name FROM migrations ORDER BY name').all();
  return new Set(rows.map((row: { name: string }) => row.name));
}

function applyMigration(name: string, sql: string) {
  const now = Date.now();
  const transaction = db.transaction(() => {
    db.exec(sql);
    db.prepare('INSERT INTO migrations (name, appliedAt) VALUES (?, ?)').run(name, now);
  });
  transaction();
}

function runMigrations() {
  const applied = getAppliedMigrations();
  const files = fs
    .readdirSync(paths.migrations)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(paths.migrations, file), 'utf-8');
    applyMigration(file, sql);
  }
}

runMigrations();

export type DbRow<T> = T & Record<string, unknown>;

export function now(): number {
  return Date.now();
}

export function serializeRow<T>(row: T): T {
  return row;
}
