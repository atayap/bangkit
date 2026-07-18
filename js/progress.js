/* =========================================================
   BANGKIT — progress.js
   Logika halaman Progres: sosok besar saat ini + galeri 6 tahap.
   ========================================================= */

async function fetchSvg(path) {
  const res = await fetch(path);
  return res.text();
}

async function renderProgressPage() {
  const user = getCurrentUser();
  if (!user) return;
  const totalXp = totalXpFromTasks(user.tasks);
  const { level } = computeLevel(totalXp);
  const currentStage = getStageForLevel(level);

  // sosok besar saat ini
  const heroSvg = document.getElementById("hero-figure-svg");
  heroSvg.innerHTML = await fetchSvg(currentStage.svg);
  document.getElementById("hero-figure-title").textContent = currentStage.name;
  document.getElementById("hero-figure-sub").textContent = `Level ${level} — Tahap ${currentStage.id} dari ${STAGES.length}`;
  document.getElementById("hero-figure-desc").textContent = currentStage.desc;

  // galeri semua tahap
  const gallery = document.getElementById("stage-gallery");
  gallery.innerHTML = "";
  for (const stage of STAGES) {
    const unlocked = level >= stage.minLevel;
    const isCurrent = stage.id === currentStage.id;
    const card = document.createElement("div");
    card.className = "stage-card " + (isCurrent ? "current" : unlocked ? "unlocked" : "locked");
    card.innerHTML = `
      ${!unlocked ? '<div class="lock-icon">✦</div>' : ""}
      <div class="stage-svg-wrap"></div>
      <div class="stage-num">TAHAP ${stage.id}</div>
      <div class="stage-name">${unlocked ? stage.name : "???"}</div>
    `;
    gallery.appendChild(card);
    if (unlocked) {
      const svgText = await fetchSvg(stage.svg);
      card.querySelector(".stage-svg-wrap").innerHTML = svgText;
    } else {
      // tetap tampilkan bentuk siluetnya, tapi digelapkan (efek "belum terungkap")
      const svgText = await fetchSvg(stage.svg);
      card.querySelector(".stage-svg-wrap").innerHTML = svgText;
    }
  }
}

function initProgressPage() {
  requireAuth();
  renderSidebarUser();
  renderProgressPage();
  initTutorial();

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);
}
