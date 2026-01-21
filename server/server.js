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

// Serve frontend from ../public (repo has public/ at root, server/ for backend)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const upload = multer({ storage: multer.memoryStorage() });

// Normalize header keys: trim + uppercase
const norm = (s) => String(s).trim().toUpperCase();
const num = (v) => {
  const t = String(v ?? "").replace(/,/g, "").trim();
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

// Upload Excel and import (first sheet)
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const cleaned = rawRows
      .map((r) => {
        const upper = {};
        for (const k of Object.keys(r)) upper[norm(k)] = r[k];

        const grade = String(upper["GRADE"] ?? "").trim();
        const std   = String(upper["STD"] ?? "").trim();

        // Excel headers (some have trailing spaces) become clean after norm()
        return {
          grade,
          std,
          price: num(upper["PRICE"]),

          bulk: num(upper["BULK"]),
          kg10: num(upper["10KG"]),
          kg5:  num(upper["5KG"]),

          carton_1kg:  num(upper["1KG CARTON"]),
          carton_500g: num(upper["500G CARTON"]),
          carton_250g: num(upper["250G CARTON"]),
          carton_100g: num(upper["100G CARTON"])
        };
      })
      .filter((x) => x.grade && x.std);

    if (!cleaned.length) {
      return res.status(400).json({ error: "No valid rows found. Need at least GRADE and STD." });
    }

    // Replace DB contents
    db.exec("DELETE FROM prices;");

    const ins = db.prepare(`
      INSERT INTO prices
      (grade, std, price, bulk, kg10, kg5, carton_1kg, carton_500g, carton_250g, carton_100g)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      cleaned.forEach((r) =>
        ins.run(
          r.grade, r.std, r.price, r.bulk, r.kg10, r.kg5,
          r.carton_1kg, r.carton_500g, r.carton_250g, r.carton_100g
        )
      );
    });
    tx();

    res.json({ ok: true, imported: cleaned.length });
  } catch (e) {
    res.status(500).json({ error: "Failed to read Excel", details: String(e?.message || e) });
  }
});

// Grade suggestions
app.get("/api/grades", (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();
  const rows = q
    ? db.prepare("SELECT DISTINCT grade FROM prices WHERE LOWER(grade) LIKE ? ORDER BY grade").all(`%${q}%`)
    : db.prepare("SELECT DISTINCT grade FROM prices ORDER BY grade").all();

  res.json(rows.map((r) => r.grade));
});

// Results by grade (returns ALL tiers)
app.get("/api/prices", (req, res) => {
  const grade = (req.query.grade || "").trim();
  if (!grade) return res.status(400).json({ error: "grade is required" });

  const rows = db.prepare(`
    SELECT
      std,
      bulk, kg10, kg5,
      carton_1kg, carton_500g, carton_250g, carton_100g
    FROM prices
    WHERE grade = ?
    ORDER BY std
  `).all(grade);

  res.json(rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
