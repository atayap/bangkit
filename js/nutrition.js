/* =========================================================
   BANGKIT — nutrition.js
   Scan foto makanan lewat OpenRouter, hasilnya bisa diedit
   manual sebelum disimpan ke log gizi harian.

   PENTING SOAL API KEY:
   Key disimpan di localStorage milik akun (lihat settings.html),
   TIDAK PERNAH ditulis ke file kode ini. Situs ini hosting statis
   (GitHub Pages) tanpa server, jadi panggilan ke OpenRouter
   dilakukan langsung dari browser pengguna dengan key miliknya
   sendiri — bukan key yang ditanam di kode.
   ========================================================= */

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/auto";

const SCAN_PROMPT = `Kamu adalah asisten gizi. Lihat gambar makanan/cemilan ini dan perkirakan isinya.
Balas HANYA dengan JSON valid, tanpa teks lain, tanpa markdown, persis format ini:
{
  "nama_makanan": "string, nama makanan dalam Bahasa Indonesia",
  "porsi": "string, deskripsi porsi/takaran yang terlihat, contoh: '1 piring sedang (~250g)'",
  "kalori": angka (kkal, total untuk porsi tersebut),
  "lemak_g": angka (gram),
  "karbohidrat_g": angka (gram),
  "protein_g": angka (gram),
  "catatan": "string singkat, opsional, misal asumsi yang kamu ambil"
}
Jika ada beberapa makanan dalam satu foto, gabungkan jadi satu estimasi total.
Jika gambar tidak jelas, tetap beri estimasi terbaikmu dan jelaskan asumsinya di catatan.`;

/* Resize gambar via canvas sebelum dikirim — lebih hemat kuota localStorage */
function resizeImageFile(file, maxDim = 800, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round(height * (maxDim / width));
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round(width * (maxDim / height));
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* Ambil blok JSON pertama dari teks */
function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model tidak mengembalikan JSON yang bisa dibaca.");
  return JSON.parse(match[0]);
}

/* Panggil OpenRouter dengan model spesifik (Gemma 4 31B Free sebagai default) */
async function callFoodVision(dataUrl, apiKey, model) {
  const selectedModel = model || DEFAULT_MODEL;

  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "Bangkit",
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: SCAN_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new Error("API key ditolak. Cek lagi API key di halaman Pengaturan.");
    }
    if (res.status === 402) {
      throw new Error(`Saldo/kredit OpenRouter kamu tidak cukup untuk model ini. Coba pakai model gratis seperti ${DEFAULT_MODEL} di halaman Setelan.`);
    }
    throw new Error(`Gagal memanggil OpenRouter (status ${res.status}). ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Respons AI kosong. Coba foto ulang.");
  const text = Array.isArray(content) ? content.map(c => c.text || "").join("") : content;
  return extractJson(text);
}

/* ================= UI halaman scan ================= */

let currentImageDataUrl = null;

function initScanPage() {
  requireAuth();
  renderSidebarUser();
  initTutorial();
  renderTodayLog();

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);

  const fileInput = document.getElementById("food-file-input");
  const preview = document.getElementById("food-preview");
  const detectBtn = document.getElementById("detect-btn");
  const statusEl = document.getElementById("scan-status");

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    statusEl.textContent = "";
    currentImageDataUrl = await resizeImageFile(file);
    preview.src = currentImageDataUrl;
    preview.style.display = "block";
    document.getElementById("result-form").classList.add("hidden");
    detectBtn.disabled = false;
  });

  detectBtn.addEventListener("click", async () => {
    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
      statusEl.textContent = "Belum ada API key terpusat. Hubungi admin untuk menyetel API key di api-config.js.";
      statusEl.classList.add("scan-status-error");
      return;
    }
    if (!currentImageDataUrl) return;

    detectBtn.disabled = true;
    statusEl.classList.remove("scan-status-error");
    statusEl.textContent = "Menganalisis foto…";

    try {
      const result = await callFoodVision(currentImageDataUrl, apiKey, getOpenRouterModel());
      fillResultForm(result);
      statusEl.textContent = "Terdeteksi ✓ Cek dan perbaiki dulu kalau ada yang salah sebelum disimpan.";
      document.getElementById("result-form").classList.remove("hidden");
    } catch (err) {
      statusEl.textContent = err.message || "Terjadi kesalahan.";
      statusEl.classList.add("scan-status-error");
    } finally {
      detectBtn.disabled = false;
    }
  });

  document.getElementById("save-food-btn").addEventListener("click", saveFoodEntry);
}

function fillResultForm(result) {
  document.getElementById("f-nama").value = result.nama_makanan || "";
  document.getElementById("f-porsi").value = result.porsi || "";
  document.getElementById("f-kalori").value = round1(result.kalori);
  document.getElementById("f-lemak").value = round1(result.lemak_g);
  document.getElementById("f-karbo").value = round1(result.karbohidrat_g);
  document.getElementById("f-protein").value = round1(result.protein_g);
  document.getElementById("f-catatan").value = result.catatan || "";
}

function round1(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : "";
}

function saveFoodEntry() {
  const nama = document.getElementById("f-nama").value.trim();
  if (!nama) {
    document.getElementById("scan-status").textContent = "Nama makanan tidak boleh kosong.";
    return;
  }
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
    image: currentImageDataUrl,
    nama,
    porsi: document.getElementById("f-porsi").value.trim(),
    kalori: Number(document.getElementById("f-kalori").value) || 0,
    lemak: Number(document.getElementById("f-lemak").value) || 0,
    karbo: Number(document.getElementById("f-karbo").value) || 0,
    protein: Number(document.getElementById("f-protein").value) || 0,
    catatan: document.getElementById("f-catatan").value.trim(),
  };

  updateCurrentUser(u => {
    if (!u.nutritionLog) u.nutritionLog = [];
    u.nutritionLog.push(entry);
    u.tasks.push({
      id: entry.id + "-task",
      text: "Catat makan: " + nama,
      category: "gizi",
      xp: XP_BY_CATEGORY.gizi,
      done: true,
      createdAt: Date.now(),
    });
  });

  showToast("Tersimpan ke log gizi — +" + XP_BY_CATEGORY.gizi + " XP");
  resetScanForm();
  renderTodayLog();
  renderSidebarUser();
}

function resetScanForm() {
  currentImageDataUrl = null;
  document.getElementById("food-file-input").value = "";
  document.getElementById("food-preview").style.display = "none";
  document.getElementById("result-form").classList.add("hidden");
  document.getElementById("detect-btn").disabled = true;
  document.getElementById("scan-status").textContent = "";
  ["f-nama","f-porsi","f-kalori","f-lemak","f-karbo","f-protein","f-catatan"].forEach(id => {
    document.getElementById(id).value = "";
  });
}

function isToday(ts) {
  const d = new Date(ts), now = new Date();
  return d.toDateString() === now.toDateString();
}

function renderTodayLog() {
  const user = getCurrentUser();
  const log = (user.nutritionLog || []).filter(e => isToday(e.timestamp)).sort((a,b) => b.timestamp - a.timestamp);
  const listEl = document.getElementById("today-log-list");
  const totalEl = document.getElementById("today-log-total");

  const totalKalori = log.reduce((s, e) => s + (e.kalori || 0), 0);
  totalEl.textContent = totalKalori.toFixed(0) + " kkal hari ini";

  listEl.innerHTML = "";
  if (log.length === 0) {
    listEl.innerHTML = `<div class="empty-state">Belum ada catatan makan hari ini.</div>`;
    return;
  }
  log.forEach(entry => {
    const div = document.createElement("div");
    div.className = "food-log-item";
    const time = new Date(entry.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    div.innerHTML = `
      <img src="${entry.image}" alt="">
      <div class="food-log-info">
        <div class="food-log-name">${escapeHtml(entry.nama)}</div>
        <div class="food-log-sub">${escapeHtml(entry.porsi || "")} · ${time}</div>
      </div>
      <div class="food-log-kcal">${Math.round(entry.kalori)} kkal</div>
      <button class="task-del" data-id="${entry.id}" title="Hapus catatan">×</button>
    `;
    listEl.appendChild(div);
  });
  listEl.querySelectorAll(".task-del").forEach(btn => {
    btn.addEventListener("click", () => deleteFoodEntry(btn.dataset.id));
  });
}

function deleteFoodEntry(id) {
  updateCurrentUser(u => {
    u.nutritionLog = (u.nutritionLog || []).filter(e => e.id !== id);
  });
  renderTodayLog();
}
