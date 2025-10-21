import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { db, now } from './db';

type Preferences = Record<string, any>;

export interface StaticUser {
  id: string;
  name: string;
}

export interface UserRecord extends StaticUser {
  preferences: Preferences;
}

const USERS_FILE = path.join(config.dataRoot, 'users.json');
const DEFAULT_USERS: StaticUser[] = [
  { id: 'A', name: 'A' },
  { id: 'B', name: 'B' }
];

function writeUsersFile(users: StaticUser[]) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function sanitizeUsers(users: unknown): StaticUser[] {
  if (!Array.isArray(users)) {
    throw new Error('Expected an array of users');
  }

  const seen = new Set<string>();
  const sanitized: StaticUser[] = [];

  for (const entry of users) {
    if (!entry || typeof entry !== 'object') continue;
    const id = String((entry as any).id ?? '').trim();
    if (!id || seen.has(id)) continue;
    const rawName = (entry as any).name;
    const name = typeof rawName === 'string' && rawName.trim().length > 0 ? rawName.trim() : id;
    sanitized.push({ id, name });
    seen.add(id);
  }

  if (sanitized.length === 0) {
    throw new Error('No valid users defined');
  }

  return sanitized;
}

function loadUsersFile(): StaticUser[] {
  if (!fs.existsSync(USERS_FILE)) {
    writeUsersFile(DEFAULT_USERS);
    return DEFAULT_USERS;
  }

  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = sanitizeUsers(JSON.parse(raw));
    if (parsed.length === 0) {
      throw new Error('No users available');
    }
    return parsed;
  } catch (err) {
    console.warn(`Failed to read users.json, restoring defaults: ${(err as Error).message}`);
    writeUsersFile(DEFAULT_USERS);
    return DEFAULT_USERS;
  }
}

function syncUsersWithDatabase(users: StaticUser[]) {
  const insert = db.prepare(
    `INSERT INTO users (id, name, preferences, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, updatedAt = excluded.updatedAt`
  );

  const run = db.transaction((list: StaticUser[]) => {
    const timestamp = now();
    const emptyPreferences = JSON.stringify({});
    for (const user of list) {
      insert.run(user.id, user.name, emptyPreferences, timestamp, timestamp);
    }

    if (list.length > 0) {
      const placeholders = list.map(() => '?').join(',');
      db.prepare(`DELETE FROM users WHERE id NOT IN (${placeholders})`).run(...list.map((user) => user.id));
    } else {
      db.prepare('DELETE FROM users').run();
    }
  });

  run(users);
}

function mapPreferences(users: StaticUser[]): UserRecord[] {
  if (users.length === 0) {
    return [];
  }

  const placeholders = users.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT id, preferences FROM users WHERE id IN (${placeholders})`)
    .all(...users.map((user) => user.id));

  const prefs = new Map<string, Preferences>();
  for (const row of rows as Array<{ id: string; preferences?: string }>) {
    try {
      prefs.set(row.id, row.preferences ? JSON.parse(row.preferences) : {});
    } catch {
      prefs.set(row.id, {});
    }
  }

  return users.map((user) => ({
    ...user,
    preferences: prefs.get(user.id) ?? {}
  }));
}

export function initializeStaticUsers(): UserRecord[] {
  const users = loadUsersFile();
  syncUsersWithDatabase(users);
  return mapPreferences(users);
}

export function loadStaticUsers(): UserRecord[] {
  const users = loadUsersFile();
  syncUsersWithDatabase(users);
  return mapPreferences(users);
}
