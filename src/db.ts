import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'expensebot.db');

export const db = new sqlite3.Database(dbPath);

export function initDatabase() {
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `
          CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            amount INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `,
        (err) => {
          if (err) {
            reject(err);
            return;
          }

          resolve();
        },
      );
    });
  });
}

export function addEntry(
  userId: number,
  title: string,
  amount: number,
  type: 'expense' | 'income',
) {
  return new Promise<void>((resolve, reject) => {
    db.run(
      `
        INSERT INTO expenses (user_id, title, amount, type, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `,
      [userId, title, amount, type],
      (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      },
    );
  });
}

export function getEntriesForToday(userId: number): Promise<Array<{ id: number; title: string; amount: number; type: string; created_at: string }>> {
  return new Promise((resolve, reject) => {
    db.all(
      `
        SELECT * FROM expenses
        WHERE user_id = ?
          AND date(created_at) = date('now')
        ORDER BY created_at DESC
      `,
      [userId],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(rows as Array<{ id: number; title: string; amount: number; type: string; created_at: string }>);
      },
    );
  });
}

export function getEntriesForMonth(userId: number): Promise<Array<{ id: number; title: string; amount: number; type: string; created_at: string }>> {
  return new Promise((resolve, reject) => {
    db.all(
      `
        SELECT * FROM expenses
        WHERE user_id = ?
          AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
        ORDER BY created_at DESC
      `,
      [userId],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(rows as Array<{ id: number; title: string; amount: number; type: string; created_at: string }>);
      },
    );
  });
}
