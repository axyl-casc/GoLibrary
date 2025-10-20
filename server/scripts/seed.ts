import { db, now } from '../lib/db';

db.prepare(
  `INSERT OR IGNORE INTO users (id, name, preferences, createdAt, updatedAt)
   VALUES ('default', 'Default', '{}', ?, ?)`
).run(now(), now());

console.log('Seed complete');
