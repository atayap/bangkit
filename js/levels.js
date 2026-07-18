/* =========================================================
   BANGKIT — levels.js
   Sistem level, XP, dan definisi 6 tahap evolusi visual.
   ========================================================= */

const STAGES = [
  { id: 1, minLevel: 1,  maxLevel: 2,  name: "Yang Tertidur",
    desc: "Belum sadar potensi. Garis tubuh pudar, tanpa aura, tanpa arah. Titik nol dari segalanya.",
    svg: "assets/svg/stage1.svg" },
  { id: 2, minLevel: 3,  maxLevel: 4,  name: "Yang Bangun",
    desc: "Mulai bergerak. Postur mulai tegak, aura tipis mulai terlihat di sekeliling tubuh.",
    svg: "assets/svg/stage2.svg" },
  { id: 3, minLevel: 5,  maxLevel: 6,  name: "Yang Berlatih",
    desc: "Disiplin mulai membentuk otot dan kebiasaan. Garis tubuh lebih tegas, aura menguat.",
    svg: "assets/svg/stage3.svg" },
  { id: 4, minLevel: 7,  maxLevel: 8,  name: "Yang Berpikir",
    desc: "Pikiran mulai setajam tubuh. Lingkaran kesadaran muncul di sekitar kepala, aura makin terang.",
    svg: "assets/svg/stage4.svg" },
  { id: 5, minLevel: 9,  maxLevel: 10, name: "Yang Bangkit",
    desc: "Tubuh dan pikiran menyatu. Otot penuh, aura memancar kuat ke segala arah.",
    svg: "assets/svg/stage5.svg" },
  { id: 6, minLevel: 11, maxLevel: 9999, name: "Yang Tercerahkan",
    desc: "Bentuk akhir. Halo cahaya, aura penuh, sosok yang telah melalui semuanya.",
    svg: "assets/svg/stage6.svg" },
];

const CATEGORIES = {
  fisik:  { label: "Fisik",   short: "FIS" },
  otak:   { label: "Otak",    short: "OTK" },
  disiplin: { label: "Disiplin", short: "DSP" },
  gizi: { label: "Gizi", short: "GZI" },
};

/* XP dibutuhkan untuk MENCAPAI sebuah level dari level sebelumnya.
   Level 1 -> 2 butuh 100xp, lalu naik 50xp setiap level (progresif). */
function xpForLevel(level) {
  return 100 + (level - 1) * 50;
}

/* Hitung level & sisa progres dari total XP akumulatif */
function computeLevel(totalXp) {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  return {
    level,
    xpIntoLevel: remaining,
    xpNeeded: xpForLevel(level),
  };
}

function getStageForLevel(level) {
  return STAGES.find(s => level >= s.minLevel && level <= s.maxLevel) || STAGES[STAGES.length - 1];
}

/* XP dasar per kategori tugas — mendorong variasi jenis tugas */
const XP_BY_CATEGORY = { fisik: 25, otak: 25, disiplin: 15, gizi: 20 };

function totalXpFromTasks(tasks) {
  return tasks.filter(t => t.done).reduce((sum, t) => sum + t.xp, 0);
}

function attributeTotals(tasks) {
  const totals = { fisik: 0, otak: 0, disiplin: 0 };
  tasks.filter(t => t.done).forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.xp;
  });
  return totals;
}
