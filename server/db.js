import Database from "better-sqlite3";

export function openDb() {
  const db = new Database("data.sqlite");

  db.exec(`
    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      grade TEXT NOT NULL,
      std   TEXT NOT NULL,

      price REAL,

      bulk REAL,
      kg10 REAL,
      kg5  REAL,

      carton_1kg   REAL,
      carton_500g  REAL,
      carton_250g  REAL,
      carton_100g  REAL
    );

    CREATE INDEX IF NOT EXISTS idx_prices_grade ON prices(grade);
    CREATE INDEX IF NOT EXISTS idx_prices_grade_std ON prices(grade, std);
  `);

  return db;
}
