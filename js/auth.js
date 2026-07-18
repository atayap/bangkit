/* =========================================================
   BANGKIT — auth.js
   Autentikasi sisi klien. Situs ini hosting statis (GitHub Pages)
   tanpa server, jadi ini BUKAN keamanan tingkat produksi —
   fungsinya sebagai gerbang pribadi, bukan brankas bank.
   Password di-hash (SHA-256) sebelum disimpan, tidak plaintext.
   ========================================================= */

const DB_KEY = "bangkit_users";
const SESSION_KEY = "bangkit_session";

async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(DB_KEY, JSON.stringify(users));
}

function emailKey(email) {
  return email.trim().toLowerCase();
}

async function registerUser({ name, email, password }) {
  const users = getUsers();
  const key = emailKey(email);
  if (users[key]) {
    return { ok: false, error: "Email ini sudah terdaftar. Coba masuk saja." };
  }
  const passHash = await sha256(password);
  users[key] = {
    name: name.trim(),
    email: key,
    passHash,
    createdAt: Date.now(),
    xp: 0,
    tasks: [],
    tutorialSeen: false,
  };
  saveUsers(users);
  return { ok: true };
}

async function loginUser({ email, password }) {
  const users = getUsers();
  const key = emailKey(email);
  const user = users[key];
  if (!user) {
    return { ok: false, error: "Email belum terdaftar." };
  }
  const passHash = await sha256(password);
  if (passHash !== user.passHash) {
    return { ok: false, error: "Password salah." };
  }
  localStorage.setItem(SESSION_KEY, key);
  return { ok: true };
}

function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "index.html";
}

function getCurrentUserKey() {
  return localStorage.getItem(SESSION_KEY);
}

function getCurrentUser() {
  const key = getCurrentUserKey();
  if (!key) return null;
  const users = getUsers();
  return users[key] || null;
}

function updateCurrentUser(mutatorFn) {
  const key = getCurrentUserKey();
  if (!key) return null;
  const users = getUsers();
  if (!users[key]) return null;
  mutatorFn(users[key]);
  saveUsers(users);
  return users[key];
}

/* Panggil di awal setiap halaman yang butuh login */
function requireAuth() {
  if (!getCurrentUserKey() || !getCurrentUser()) {
    window.location.href = "index.html";
  }
}

/* Panggil di halaman login/register: kalau sudah login, langsung lempar ke dashboard */
function redirectIfLoggedIn() {
  if (getCurrentUserKey() && getCurrentUser()) {
    window.location.href = "dashboard.html";
  }
}
