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
  const { level } = computeLevel(totalXpFromUser(user));
  const nameEl = document.getElementById("sidebar-name");
  const lvEl = document.getElementById("sidebar-level");
  if (nameEl) nameEl.textContent = user.name || user.email;
  if (lvEl) lvEl.textContent = "LV " + level;
}

function renderLevelHero() {
  const user = getCurrentUser();
  if (!user) return;
  const totalXp = totalXpFromUser(user);
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

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function startLiveClock() {
  const dayEl = document.getElementById("live-day");
  const dateEl = document.getElementById("live-date");
  const timeEl = document.getElementById("live-time");
  if (!dayEl || !dateEl || !timeEl) return;

  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  function update() {
    const now = new Date();
    dayEl.textContent = days[now.getDay()];
    dateEl.textContent = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    timeEl.textContent = `${h}:${m}:${s}`;
  }

  update();
  setInterval(update, 1000);
}

function renderTasks() {
  const user = getCurrentUser();
  if (!user) return;
  const list = document.getElementById("task-list");
  if (!list) return;
  list.innerHTML = "";

  const today = new Date();
  const todaysTasks = (user.tasks || []).filter(task => {
    return isSameDay(new Date(task.createdAt), today);
  });

  if (todaysTasks.length === 0) {
    list.innerHTML = `<div class="empty-state">Belum ada tugas hari ini. Tambahkan satu di atas — setiap langkah kecil menambah XP.</div>`;
    return;
  }

  // tampilkan yang belum selesai dulu, lalu yang sudah selesai (terbaru dulu)
  const sorted = [...todaysTasks].sort((a, b) => {
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
  startLiveClock();

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

}

