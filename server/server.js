import express from "express";
import cors from "cors";
import multer from "multer";
import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";
import { openDb } from "./db.js";

const app = express();
const db = openDb();

app.use(cors());
app.use(express.json());

// serve frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "..", "public")));

// upload handler (memory)
const upload = multer({ storage: multer.memoryStorage() });

/** Helpers */
const norm = (s) => String(s).trim().toUpperCase();

/**
 * Upload Excel and import into SQLite
 * Expects headers: GRADE, STD, PRICE (case-insensitive, spaces ignored)
 * Imports first sheet only.
 * Replaces existing DB rows (DELETE + INSERT).
 */
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    // rows as objects using first row as headers
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    // Normalize headers and build cleaned rows
    const cleaned = rawRows
      .map((r) => {
        const upper = {};
        for (const k of Object.keys(r)) upper[norm(k)] = r[k];

        const grade = String(upper["GRADE"] ?? "").trim();
        const std = String(upper["STD"] ?? "").trim();

        // price might be "1,200" or "1200"
        const priceStr = String(upper["PRICE"] ?? "").replace(/,/g, "").trim();
        const price = Number(priceStr);

        return { grade, std, price };
      })
      .filter((x) => x.grade && x.std && Number.isFinite(x.price));

    if (!cleaned.length) {
      return res.status(400).json({
        error: "No valid rows found. Need columns: GRADE, STD, PRICE"
      });
    }

    // Replace DB contents
    db.exec("DELETE FROM prices;");

    const ins = db.prepare("INSERT INTO prices (grade, std, price) VALUES (?, ?, ?)");
    const tx = db.transaction(() => {
      cleaned.forEach((r) => ins.run(r.grade, r.std, r.price));
    });
    tx();

    res.json({ ok: true, imported: cleaned.length });
  } catch (e) {
    res.status(500).json({ error: "Failed to read Excel", details: String(e?.message || e) });
  }
});

// list grades (for suggestions)
app.get("/api/grades", (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();
  const rows = q
    ? db
        .prepare("SELECT DISTINCT grade FROM prices WHERE LOWER(grade) LIKE ? ORDER BY grade")
        .all(`%${q}%`)
    : db.prepare("SELECT DISTINCT grade FROM prices ORDER BY grade").all();

  res.json(rows.map((r) => r.grade));
});

// get results by grade
app.get("/api/prices", (req, res) => {
  const grade = (req.query.grade || "").trim();
  if (!grade) return res.status(400).json({ error: "grade is required" });

  const rows = db
    .prepare("SELECT std, price FROM prices WHERE grade = ? ORDER BY std")
    .all(grade);

  res.json(rows);
});

// add/update a single row (optional admin endpoint)
app.post("/api/prices", (req, res) => {
  const { grade, std, price } = req.body || {};
  if (!grade || !std || typeof price !== "number") {
    return res.status(400).json({ error: "grade, std, price(number) required" });
  }

  const existing = db.prepare("SELECT id FROM prices WHERE grade = ? AND std = ?").get(grade, std);

  if (existing) {
    db.prepare("UPDATE prices SET price = ? WHERE id = ?").run(price, existing.id);
    return res.json({ ok: true, updated: true });
  }

  db.prepare("INSERT INTO prices (grade, std, price) VALUES (?, ?, ?)").run(grade, std, price);
  res.json({ ok: true, created: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
