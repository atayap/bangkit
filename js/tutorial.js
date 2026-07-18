/* =========================================================
   BANGKIT — tutorial.js
   Onboarding otomatis untuk pengguna baru + tombol bantuan
   untuk memutar ulang kapan saja.
   ========================================================= */

const TUTORIAL_STEPS = [
  {
    title: "Selamat datang di Bangkit",
    body: "Ini ruang pribadimu untuk melacak produktivitas — bukan sekadar to-do list, tapi sistem level yang menunjukkan pertumbuhanmu dari waktu ke waktu.",
  },
  {
    title: "Tugas jadi XP",
    body: "Setiap tugas yang kamu selesaikan punya kategori: Fisik, Otak, atau Disiplin. Menyelesaikannya memberi XP. XP menumpuk menjadi Level.",
  },
  {
    title: "Halaman Progres",
    body: "Setiap kenaikan level mengubah wujud sosokmu di halaman Progres — dari sosok kurus tanpa aura, sampai sosok berotot, berpikiran tajam, dan beraura penuh. Buka halaman itu sesekali untuk melihat sejauh mana kamu sudah melangkah.",
  },
  {
    title: "Scan Makanan",
    body: "Foto makanan atau cemilanmu di halaman Scan Makanan — AI akan menebak nama dan kandungan gizinya. Salah tebak? Edit dulu sebelum disimpan, baru masuk ke log dan menambah XP kategori Gizi. Butuh API key OpenRouter di halaman Pengaturan untuk memakainya.",
  },
  {
    title: "Soal privasi",
    body: "Semua data (akun, tugas, XP) tersimpan hanya di browser perangkat ini — tidak dikirim ke server manapun. Situs ini dikunci lewat email & password. Ini cukup untuk menjaga privasi dari orang di sekitarmu, meski bukan pengaman tingkat bank. Jaga baik-baik perangkatmu.",
  },
];

function buildTutorialModal() {
  if (document.getElementById("tutorial-overlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay hidden";
  overlay.id = "tutorial-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-step-label">PENGENALAN — <span id="tut-step-num">1</span>/${TUTORIAL_STEPS.length}</div>
      <h2 id="tut-title"></h2>
      <p id="tut-body"></p>
      <div class="modal-dots" id="tut-dots"></div>
      <div class="modal-actions">
        <button class="link-mini" id="tut-skip">Lewati</button>
        <button class="btn btn-sm" id="tut-next">Lanjut</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const dotsWrap = overlay.querySelector("#tut-dots");
  TUTORIAL_STEPS.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "modal-dot";
    dotsWrap.appendChild(d);
  });

  let step = 0;

  function render() {
    const s = TUTORIAL_STEPS[step];
    overlay.querySelector("#tut-title").textContent = s.title;
    overlay.querySelector("#tut-body").textContent = s.body;
    overlay.querySelector("#tut-step-num").textContent = step + 1;
    overlay.querySelectorAll(".modal-dot").forEach((d, i) => d.classList.toggle("active", i === step));
    overlay.querySelector("#tut-next").textContent = step === TUTORIAL_STEPS.length - 1 ? "Mulai" : "Lanjut";
  }

  overlay.querySelector("#tut-next").addEventListener("click", () => {
    if (step === TUTORIAL_STEPS.length - 1) {
      closeTutorial();
    } else {
      step += 1;
      render();
    }
  });
  overlay.querySelector("#tut-skip").addEventListener("click", closeTutorial);

  function closeTutorial() {
    overlay.classList.add("hidden");
    updateCurrentUser(u => { u.tutorialSeen = true; });
  }

  window.openTutorial = () => {
    step = 0;
    render();
    overlay.classList.remove("hidden");
  };
}

function initTutorial() {
  buildTutorialModal();
  const user = getCurrentUser();
  if (user && !user.tutorialSeen) {
    window.openTutorial();
  }
  const hintBtn = document.getElementById("hint-btn");
  if (hintBtn) hintBtn.addEventListener("click", () => window.openTutorial());
}
