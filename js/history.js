/* =========================================================
   BANGKIT — history.js
   Mengelola Halaman Riwayat Jadwal Seumur Hidup.
   ========================================================= */

function initHistoryPage() {
  requireAuth();
  renderSidebarUser();
  initTutorial();

  const user = getCurrentUser();
  if (!user) return;

  const tasks = user.tasks || [];
  
  // Hitung statistik seumur hidup
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.done).length;
  const rate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const totalEl = document.getElementById("stat-total-tasks");
  const completedEl = document.getElementById("stat-completed-tasks");
  const rateEl = document.getElementById("stat-completion-rate");

  if (totalEl) totalEl.textContent = totalTasks;
  if (completedEl) completedEl.textContent = completedTasks;
  if (rateEl) rateEl.textContent = rate + "%";

  const list = document.getElementById("history-task-list");
  if (!list) return;
  list.innerHTML = "";

  if (totalTasks === 0) {
    list.innerHTML = `<div class="empty-state">Belum ada riwayat tugas yang dibuat seumur hidup.</div>`;
    return;
  }

  // Tampilkan semua riwayat dari yang paling baru
  const sorted = [...tasks].sort((a, b) => b.createdAt - a.createdAt);

  sorted.forEach(task => {
    const d = new Date(task.createdAt);
    const dateStr = d.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    const timeStr = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    });

    const li = document.createElement("li");
    li.className = "task-item" + (task.done ? " done" : "");
    li.style.padding = "16px";
    li.style.flexDirection = "column";
    li.style.alignItems = "stretch";
    li.style.gap = "8px";

    const catName = (typeof CATEGORIES !== "undefined" && CATEGORIES[task.category]) ? CATEGORIES[task.category].short : task.category;

    li.innerHTML = `
      <div style="display:flex; align-items:center; width:100%; gap: 12px;">
        <div class="task-check ${task.done ? "done" : ""}" style="cursor: default;"></div>
        <div class="task-text" style="flex:1; font-size:15px; font-weight:500;">
          ${escapeHtml(task.text)}
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding-left: 32px; font-size: 11px; color: var(--ash); flex-wrap: wrap; gap: 8px;">
        <div style="display:flex; gap:6px; flex-wrap: wrap;">
          ${task.time ? `<span class="task-time-tag" style="margin:0;">⏰ ${escapeHtml(task.time)}</span>` : ""}
          <span class="task-tag" style="margin:0;">${escapeHtml(catName)}</span>
          <span class="task-xp" style="margin:0;">+${task.xp} xp</span>
        </div>
        <div style="font-family: var(--font-mono); opacity: 0.85;">
          ${dateStr} pukul ${timeStr}
        </div>
      </div>
    `;
    list.appendChild(li);
  });
}
