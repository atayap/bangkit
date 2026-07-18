/* =========================================================
   BANGKIT — app.js
   Logika halaman Dashboard: render level hero, atribut, tugas.
   ========================================================= */

function showToast(msg) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.id = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => toast.classList.remove("show"), 2600);
}

function renderSidebarUser() {
  const user = getCurrentUser();
  if (!user) return;
  const { level } = computeLevel(totalXpFromTasks(user.tasks));
  const nameEl = document.getElementById("sidebar-name");
  const lvEl = document.getElementById("sidebar-level");
  if (nameEl) nameEl.textContent = user.name || user.email;
  if (lvEl) lvEl.textContent = "LV " + level;
}

function renderLevelHero() {
  const user = getCurrentUser();
  if (!user) return;
  const totalXp = totalXpFromTasks(user.tasks);
  const { level, xpIntoLevel, xpNeeded } = computeLevel(totalXp);
  const stage = getStageForLevel(level);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("hero-level-num", level);
  set("hero-level-num-2", level);
  set("hero-stage-name", stage.name);
  set("hero-xp-current", xpIntoLevel);
  set("hero-xp-needed", xpNeeded);
  set("stat-total-xp", totalXp);
  set("stat-tasks-done", user.tasks.filter(t => t.done).length);
  set("stat-days", Math.max(1, Math.ceil((Date.now() - user.createdAt) / 86400000)));

  const fill = document.getElementById("hero-xp-fill");
  if (fill) fill.style.width = Math.min(100, (xpIntoLevel / xpNeeded) * 100) + "%";

  renderAttributes(user.tasks);
}

function renderAttributes(tasks) {
  const totals = attributeTotals(tasks);
  const maxRef = Math.max(100, ...Object.values(totals));
  Object.keys(CATEGORIES).forEach(cat => {
    const fill = document.getElementById("attr-fill-" + cat);
    const val = document.getElementById("attr-val-" + cat);
    const v = totals[cat] || 0;
    if (fill) fill.style.width = Math.min(100, (v / maxRef) * 100) + "%";
    if (val) val.textContent = v;
  });
}

function renderTasks() {
  const user = getCurrentUser();
  if (!user) return;
  const list = document.getElementById("task-list");
  if (!list) return;
  list.innerHTML = "";

  if (user.tasks.length === 0) {
    list.innerHTML = `<div class="empty-state">Belum ada tugas. Tambahkan satu di atas — setiap langkah kecil menambah XP.</div>`;
    return;
  }

  // tampilkan yang belum selesai dulu, lalu yang sudah selesai (terbaru dulu)
  const sorted = [...user.tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return b.createdAt - a.createdAt;
  });

  sorted.forEach(task => {
    const li = document.createElement("li");
    li.className = "task-item" + (task.done ? " done" : "");
    li.innerHTML = `
      <div class="task-check ${task.done ? "done" : ""}" data-id="${task.id}"></div>
      <div class="task-text">
        ${escapeHtml(task.text)}
      </div>
      <div class="task-meta">
        ${task.time ? `<div class="task-time-tag">⏰ ${escapeHtml(task.time)}</div>` : ""}
        <div class="task-tag">${CATEGORIES[task.category].short}</div>
        <div class="task-xp">+${task.xp} xp</div>
      </div>
      <button class="task-del" data-id="${task.id}" title="Hapus tugas">×</button>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll(".task-check").forEach(el => {
    el.addEventListener("click", () => toggleTask(el.dataset.id));
  });
  list.querySelectorAll(".task-del").forEach(el => {
    el.addEventListener("click", () => deleteTask(el.dataset.id));
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function addTask(text, category, time) {
  if (!text.trim()) return;
  const xp = XP_BY_CATEGORY[category] || 15;
  updateCurrentUser(u => {
    u.tasks.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: text.trim(),
      category,
      time: time || "",
      xp,
      done: false,
      createdAt: Date.now(),
    });
  });
  renderTasks();
  renderLevelHero();
  renderSidebarUser();
}

function toggleTask(id) {
  const before = computeLevel(totalXpFromTasks(getCurrentUser().tasks)).level;
  updateCurrentUser(u => {
    const t = u.tasks.find(t => t.id === id);
    if (t) t.done = !t.done;
  });
  const after = computeLevel(totalXpFromTasks(getCurrentUser().tasks)).level;

  renderTasks();
  renderLevelHero();
  renderSidebarUser();

  if (after > before) {
    showToast(`✦ NAIK LEVEL — Kini Level ${after}: ${getStageForLevel(after).name}`);
  }
}

function deleteTask(id) {
  updateCurrentUser(u => {
    u.tasks = u.tasks.filter(t => t.id !== id);
  });
  renderTasks();
  renderLevelHero();
  renderSidebarUser();
}

function initDashboard() {
  requireAuth();
  renderSidebarUser();
  renderLevelHero();
  renderTasks();
  initTutorial();

  /* Toggle input kelompok waktu sesuai dropdown tipe */
  const timeTypeSelect = document.getElementById("task-time-type");
  const rangeGroup = document.getElementById("time-range-group");
  const durationGroup = document.getElementById("duration-group");

  if (timeTypeSelect) {
    timeTypeSelect.addEventListener("change", () => {
      const val = timeTypeSelect.value;
      if (val === "range") {
        rangeGroup?.classList.remove("hidden");
        durationGroup?.classList.add("hidden");
      } else if (val === "duration") {
        durationGroup?.classList.remove("hidden");
        rangeGroup?.classList.add("hidden");
      } else {
        rangeGroup?.classList.add("hidden");
        durationGroup?.classList.add("hidden");
      }
    });
  }

  /* Toggle custom duration input field */
  const durationSelect = document.getElementById("task-duration");
  const durationCustomInput = document.getElementById("task-duration-custom");
  if (durationSelect && durationCustomInput) {
    durationSelect.addEventListener("change", () => {
      if (durationSelect.value === "custom") {
        durationCustomInput.style.display = "inline-block";
        durationCustomInput.required = true;
      } else {
        durationCustomInput.style.display = "none";
        durationCustomInput.required = false;
        durationCustomInput.value = "";
      }
    });
  }

  const form = document.getElementById("task-form");
  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const input = document.getElementById("task-input");
      const select = document.getElementById("task-category");
      
      const timeType = timeTypeSelect ? timeTypeSelect.value : "none";
      let timeVal = "";

      if (timeType === "range") {
        const start = document.getElementById("task-start-time")?.value || "";
        const end = document.getElementById("task-end-time")?.value || "";
        if (start && end) {
          timeVal = `⏰ ${start} - ${end}`;
        } else if (start || end) {
          timeVal = `⏰ ${start || end}`;
        }
      } else if (timeType === "duration") {
        if (durationSelect) {
          if (durationSelect.value === "custom") {
            const customVal = durationCustomInput?.value.trim() || "";
            if (customVal) timeVal = `⏱️ ${customVal}`;
          } else {
            timeVal = `⏱️ ${durationSelect.options[durationSelect.selectedIndex].text}`;
          }
        }
      }

      addTask(input.value, select.value, timeVal);

      // Reset form fields
      input.value = "";
      if (document.getElementById("task-start-time")) document.getElementById("task-start-time").value = "";
      if (document.getElementById("task-end-time")) document.getElementById("task-end-time").value = "";
      if (durationSelect) durationSelect.value = "15m";
      if (durationCustomInput) {
        durationCustomInput.value = "";
        durationCustomInput.style.display = "none";
        durationCustomInput.required = false;
      }
      if (timeTypeSelect) {
        timeTypeSelect.value = "none";
        rangeGroup?.classList.add("hidden");
        durationGroup?.classList.add("hidden");
      }
      input.focus();
    });
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);

  /* Event Listener untuk Asisten Jadwal AI */
  const aiForm = document.getElementById("ai-task-form");
  const aiInput = document.getElementById("ai-task-input");
  const aiBtn = document.getElementById("ai-task-btn");
  const aiStatus = document.getElementById("ai-task-status");

  if (aiForm && aiInput && aiBtn && aiStatus) {
    aiForm.addEventListener("submit", async e => {
      e.preventDefault();
      const user = getCurrentUser();
      if (!user.orApiKey) {
        aiStatus.textContent = "Belum ada API key OpenRouter. Masukkan dulu di halaman Setelan.";
        aiStatus.style.color = "#d8b4b4";
        return;
      }

      const promptText = aiInput.value.trim();
      if (!promptText) return;

      aiBtn.disabled = true;
      aiStatus.textContent = "Sedang memproses instruksi dengan AI…";
      aiStatus.style.color = "var(--ash)";

      try {
        const result = await callSchedulerAi(promptText, user.tasks, user.orApiKey);
        if (result && result.action) {
          if (result.action === "add" && result.task) {
            addTask(result.task.text, result.task.category || "disiplin", result.task.time || "");
            aiStatus.textContent = "Tugas berhasil ditambahkan ✓";
          } 
          else if (result.action === "edit" && result.taskId && result.task) {
            updateCurrentUser(u => {
              const t = u.tasks.find(x => x.id === result.taskId);
              if (t) {
                if (result.task.text) t.text = result.task.text;
                if (result.task.category) t.category = result.task.category;
                if (result.task.time !== undefined) t.time = result.task.time;
              }
            });
            renderTasks();
            renderLevelHero();
            renderSidebarUser();
            aiStatus.textContent = "Tugas berhasil diubah/diedit ✓";
          } 
          else if (result.action === "delete" && result.taskId) {
            deleteTask(result.taskId);
            aiStatus.textContent = "Tugas berhasil dihapus ✓";
          } 
          else if (result.action === "complete" && result.taskId) {
            const before = computeLevel(totalXpFromTasks(getCurrentUser().tasks)).level;
            updateCurrentUser(u => {
              const t = u.tasks.find(x => x.id === result.taskId);
              if (t) t.done = (result.done !== undefined) ? result.done : !t.done;
            });
            const after = computeLevel(totalXpFromTasks(getCurrentUser().tasks)).level;
            renderTasks();
            renderLevelHero();
            renderSidebarUser();
            if (after > before) {
              showToast(`✦ NAIK LEVEL — Kini Level ${after}: ${getStageForLevel(after).name}`);
            }
            aiStatus.textContent = "Status tugas berhasil diperbarui ✓";
          } else {
            throw new Error("Aksi tidak kompeten.");
          }

          aiStatus.style.color = "var(--bone-dim)";
          aiInput.value = "";
          setTimeout(() => { aiStatus.textContent = ""; }, 3000);
        } else {
          throw new Error("AI gagal memproses perintah.");
        }
      } catch (err) {
        aiStatus.textContent = err.message || "Gagal memproses instruksi.";
        aiStatus.style.color = "#d8b4b4";
      } finally {
        aiBtn.disabled = false;
      }
    });
  }
}

const AI_ASSISTANT_PROMPT = `Kamu adalah asisten penjadwalan produktivitas pintar. Tugasmu adalah menganalisis kalimat permintaan dari pengguna untuk mengelola daftar tugasnya (tambah, edit/ubah, hapus, atau selesaikan), lalu mengembalikan respon JSON valid.

Kamu akan diberikan daftar tugas yang sedang aktif saat ini. Evaluasi permintaan pengguna berdasarkan daftar tersebut.

Format respon wajib JSON valid (tanpa penjelasan tambahan, tanpa markdown):
{
  "action": "Jenis aksi yang dilakukan: 'add' | 'edit' | 'delete' | 'complete'",
  "taskId": "ID dari tugas yang ditargetkan (hanya wajib diisi untuk aksi 'edit', 'delete', dan 'complete')",
  "task": {
    "text": "Deskripsi tugas singkat dalam Bahasa Indonesia (wajib untuk 'add' dan jika berubah pada 'edit')",
    "category": "Kategori tugas: 'fisik' | 'otak' | 'disiplin' (wajib untuk 'add' dan jika berubah pada 'edit')",
    "time": "Keterangan waktu pengerjaan. Gunakan emoji '⏰ ' jika rentang waktu (cth: '⏰ 08:00 - 10:00'), atau '⏱️ ' jika durasi (cth: '⏱️ 2 Jam'). Kosongkan string '' jika tidak ditentukan."
  },
  "done": true/false (hanya wajib diisi untuk aksi 'complete' — atur ke true untuk menandai selesai/checklist, false untuk membatalkan)
}

Aturan Pencocokan Tugas:
- Untuk aksi 'edit', 'delete', atau 'complete', carilah tugas dari daftar aktif yang paling mirip maknanya atau namanya dengan instruksi pengguna, lalu ambil 'id' nya untuk dimasukkan ke 'taskId'.
- Jika tidak ada tugas yang cocok pada aksi 'edit'/'delete'/'complete', buat fallback ke aksi 'add' (tambah baru).

Daftar Tugas Aktif Saat Ini:
`;

async function callSchedulerAi(promptText, tasks, apiKey) {
  const tasksString = tasks.map(t => `- ID: ${t.id}, Text: "${t.text}", Category: "${t.category}", Time: "${t.time || ''}", Done: ${t.done}`).join("\n");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "Bangkit",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages: [
        { role: "system", content: AI_ASSISTANT_PROMPT + "\n" + (tasksString || "(Belum ada tugas aktif)") },
        { role: "user", content: promptText }
      ]
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    if (res.status === 401) throw new Error("API key ditolak. Silakan cek lagi di halaman Pengaturan.");
    if (res.status === 402) throw new Error("Saldo/kredit OpenRouter kamu tidak cukup.");
    throw new Error(`Gagal (status ${res.status}). ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Respons AI kosong.");
  const text = Array.isArray(content) ? content.map(c => c.text || "").join("") : content;
  
  // parse JSON
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Format respon AI tidak valid.");
  return JSON.parse(match[0]);
}
