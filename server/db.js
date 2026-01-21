import Database from "better-sqlite3";

export function openDb() {
  const db = new Database("data.sqlite");

  db.exec(`
    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grade TEXT NOT NULL,
      std TEXT NOT NULL,
      price REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_prices_grade ON prices(grade);
  `);

  return db;
}