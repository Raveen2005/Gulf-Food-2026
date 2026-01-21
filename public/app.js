const searchInput = document.getElementById("gradeSearch");
const suggestions = document.getElementById("suggestions");
const searchBtn = document.getElementById("searchBtn");
const resultsBody = document.getElementById("resultsBody");
const resultTitle = document.getElementById("resultTitle");

const excelFile = document.getElementById("excelFile");
const uploadBtn = document.getElementById("uploadBtn");
const uploadMsg = document.getElementById("uploadMsg");

let timer = null;

async function fetchGrades(q) {
  const res = await fetch(`/api/grades?q=${encodeURIComponent(q)}`);
  return res.json();
}

async function fetchPrices(grade) {
  const res = await fetch(`/api/prices?grade=${encodeURIComponent(grade)}`);
  return res.json();
}

function showSuggestions(items) {
  suggestions.innerHTML = "";
  if (!items.length) {
    suggestions.style.display = "none";
    return;
  }
  items.slice(0, 10).forEach(g => {
    const d = document.createElement("div");
    d.textContent = g;
    d.onclick = () => {
      searchInput.value = g;
      suggestions.style.display = "none";
      runSearch();
    };
    suggestions.appendChild(d);
  });
  suggestions.style.display = "block";
}

function fmt(v) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(6); // matches your excel style
}

async function runSearch() {
  const grade = searchInput.value.trim();
  if (!grade) return;

  resultTitle.textContent = `Results for: ${grade}`;
  resultsBody.innerHTML = `<tr><td colspan="8" class="muted">Loading...</td></tr>`;

  const rows = await fetchPrices(grade);
  if (rows.error) {
    resultsBody.innerHTML = `<tr><td colspan="8">${escapeHtml(rows.error)}</td></tr>`;
    return;
  }
  if (!rows.length) {
    resultsBody.innerHTML = `<tr><td colspan="8" class="muted">No rows for this grade.</td></tr>`;
    return;
  }

  resultsBody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(String(r.std))}</td>
      <td>${escapeHtml(fmt(r.bulk))}</td>
      <td>${escapeHtml(fmt(r.kg10))}</td>
      <td>${escapeHtml(fmt(r.kg5))}</td>
      <td>${escapeHtml(fmt(r.carton_1kg))}</td>
      <td>${escapeHtml(fmt(r.carton_500g))}</td>
      <td>${escapeHtml(fmt(r.carton_250g))}</td>
      <td>${escapeHtml(fmt(r.carton_100g))}</td>
    </tr>
  `).join("");
}

async function uploadExcel() {
  const file = excelFile.files[0];
  if (!file) {
    uploadMsg.textContent = "Pick an Excel file first.";
    return;
  }

  uploadMsg.textContent = "Uploading & importing...";
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();

  if (!res.ok) {
    uploadMsg.textContent = data.error || "Upload failed";
    return;
  }

  uploadMsg.textContent = `Imported ${data.imported} rows ✅`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

searchInput.addEventListener("input", () => {
  clearTimeout(timer);
  const q = searchInput.value.trim();
  if (!q) { suggestions.style.display = "none"; return; }

  timer = setTimeout(async () => {
    const items = await fetchGrades(q);
    showSuggestions(items);
  }, 200);
});

searchBtn.addEventListener("click", runSearch);
uploadBtn.addEventListener("click", uploadExcel);

document.addEventListener("click", (e) => {
  if (!suggestions.contains(e.target) && e.target !== searchInput) {
    suggestions.style.display = "none";
  }
});
