import { openDb } from "./db.js";

const db = openDb();

db.exec("DELETE FROM prices;");

const rows = [
  { grade: "BOPF", std: "STD1", price: 1200 },
  { grade: "BOPF", std: "STD2", price: 1250 },
  { grade: "OP", std: "STD1", price: 1500 }
];

const ins = db.prepare("INSERT INTO prices (grade, std, price) VALUES (?, ?, ?)");
const tx = db.transaction(() => rows.forEach(r => ins.run(r.grade, r.std, r.price)));
tx();

console.log("Seeded:", rows.length, "rows");