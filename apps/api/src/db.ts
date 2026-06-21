import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const databasePath = resolve(process.cwd(), 'data/debts.sqlite');

mkdirSync(dirname(databasePath), { recursive: true });

export const database = new Database(databasePath);

database.pragma('journal_mode = WAL');

database.exec(`
  CREATE TABLE IF NOT EXISTS debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debtor TEXT NOT NULL,
    creditor TEXT NOT NULL,
    amount INTEGER NOT NULL,
    note TEXT,
    settled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
