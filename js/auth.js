/* =========================================================
   BANGKIT — auth.js
   Integrasi Firebase Authentication + Status Progres Lokal.
   ========================================================= */

const DB_KEY = "bangkit_users";
const SESSION_KEY = "bangkit_session";
const CHAT_HISTORY_LIMIT = 100;

// Flag untuk cegah sinkronisasi berantai (infinite loop)
let _syncingToFirebase = false;
let _realtimeListener = null;

// Inisialisasi Firebase jika kredensial sudah diisi di firebase-config.js
let useFirebase = false;

if (typeof firebaseConfig !== "undefined" && isFirebaseConfigured) {
  try {
    firebase.initializeApp(firebaseConfig);
    useFirebase = true;
    console.log("Firebase initialized successfully.");
  } catch (err) {
    console.error("Gagal menginisialisasi Firebase:", err);
  }
} else {
  console.warn("Konfigurasi Firebase belum diatur. Berjalan dalam mode Local Fallback.");
}

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

/* =========================================================
   LOADING BAR — strip ungu di pojok atas setiap kali
   navigasi halaman (login, logout, redirect, dll).
   ========================================================= */
function initPageLoader() {
  if (document.getElementById("page-loader")) return;
  const loader = document.createElement("div");
  loader.id = "page-loader";
  loader.innerHTML = '<div class="bar"></div>';
  document.body.appendChild(loader);
}

function showPageLoading() {
  const loader = document.getElementById("page-loader");
  if (loader) loader.classList.add("active");
}

function navigateTo(url) {
  showPageLoading();
  // Delay kecil biar loading bar sempat kelihatan sebelum halaman pindah
  setTimeout(() => {
    window.location.href = url;
  }, 300);
}

/* =========================================================
   MERGE DATA — Gabung data lokal & Firebase dengan cerdas.
   Array tasks & nutritionLog digabung berdasarkan ID,
   bukan ditimpa mentah-mentah.
   ========================================================= */
function mergeUserData(local, remote) {
  // createdAt: WAJIB pakai nilai PALING LAMA (pertama kali user daftar).
  // Jangan biarkan remote menimpa dengan timestamp baru.
  const oldestCreatedAt = Math.min(
    local.createdAt || Infinity,
    remote.createdAt || Infinity
  );

  const merged = { ...local, ...remote };

  // Kembalikan createdAt ke nilai terlama
  if (oldestCreatedAt !== Infinity) {
    merged.createdAt = oldestCreatedAt;
  } else {
    merged.createdAt = Date.now();
  }

  // Gabung array tasks by ID (tidak ada duplikat)
  if (remote.tasks || local.tasks) {
    const taskMap = new Map();
    (local.tasks || []).forEach(t => {
      if (t && t.id) taskMap.set(t.id, t);
    });
    (remote.tasks || []).forEach(t => {
      if (t && t.id) taskMap.set(t.id, t);
    });
    merged.tasks = Array.from(taskMap.values());
  }

  // Gabung nutritionLog by ID
  if (remote.nutritionLog || local.nutritionLog) {
    const logMap = new Map();
    (local.nutritionLog || []).forEach(e => {
      if (e && e.id) logMap.set(e.id, e);
    });
    (remote.nutritionLog || []).forEach(e => {
      if (e && e.id) logMap.set(e.id, e);
    });
    merged.nutritionLog = Array.from(logMap.values());
  }

  // Gabung chatHistory — ambil 100 pesan terbaru
  if (remote.chatHistory || local.chatHistory) {
    const chatMap = new Map();
    (local.chatHistory || []).forEach((m, i) => {
      chatMap.set(m.timestamp ? m.timestamp + "_" + i : "local_" + i, m);
    });
    (remote.chatHistory || []).forEach((m, i) => {
      chatMap.set(m.timestamp ? m.timestamp + "_" + i : "remote_" + i, m);
    });
    merged.chatHistory = Array.from(chatMap.values())
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .slice(-CHAT_HISTORY_LIMIT);
  }

  return merged;
}

/* Fungsi Registrasi User Baru */
async function registerUser({ name, email, password }) {
  const key = emailKey(email);

  if (useFirebase) {
    try {
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({
        displayName: name.trim()
      });
      
      const users = getUsers();
      if (!users[key]) {
        users[key] = {
          name: name.trim(),
          email: key,
          createdAt: Date.now(),
          xp: 0,
          tasks: [],
          tutorialSeen: false,
          onboarded: false
        };
        saveUsers(users);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  } else {
    const users = getUsers();
    if (users[key]) {
      return { ok: false, error: "Email ini sudah terdaftar di database lokal. Coba masuk saja." };
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
      onboarded: false
    };
    saveUsers(users);
    return { ok: true };
  }
}

/* Fungsi Login Email/Password */
async function loginUser({ email, password }) {
  const key = emailKey(email);

  if (useFirebase) {
    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      const users = getUsers();
      if (!users[key]) {
        users[key] = {
          name: user.displayName || "Pengguna Baru",
          email: key,
          createdAt: Date.now(),
          xp: 0,
          tasks: [],
          tutorialSeen: false,
          onboarded: false
        };
        saveUsers(users);
      }
      localStorage.setItem(SESSION_KEY, key);
      await syncFromFirebase(key);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  } else {
    const users = getUsers();
    const user = users[key];
    if (!user) {
      return { ok: false, error: "Email belum terdaftar secara lokal." };
    }
    const passHash = await sha256(password);
    if (passHash !== user.passHash) {
      return { ok: false, error: "Password salah." };
    }
    localStorage.setItem(SESSION_KEY, key);
    return { ok: true };
  }
}

/* Fungsi Login dengan Google */
async function loginWithGoogle() {
  if (!useFirebase) {
    return { ok: false, error: "Firebase belum terkonfigurasi. Edit file 'js/firebase-config.js' terlebih dahulu." };
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    const key = emailKey(user.email);

    const users = getUsers();
    if (!users[key]) {
      users[key] = {
        name: user.displayName || "Pengguna Google",
        email: key,
        createdAt: Date.now(),
        xp: 0,
        tasks: [],
        tutorialSeen: false,
        onboarded: false
      };
      saveUsers(users);
    }
    localStorage.setItem(SESSION_KEY, key);
    await syncFromFirebase(key);
    return { ok: true, user: user };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* Fungsi Logout */
function logoutUser() {
  if (!confirm("Apakah Anda yakin ingin keluar dari akun? Semua data tetap tersimpan.")) {
    return;
  }

  unsubscribeRealtime();

  // Hapus session INSTAN
  localStorage.removeItem(SESSION_KEY);

  // Firebase: fire-and-forget
  if (useFirebase) {
    syncToFirebase();
    firebase.auth().signOut().catch(() => {});
  }

  // Redirect dengan loading bar
  navigateTo("index.html");
}

function sanitizeFirebaseKey(key) {
  return key.replace(/[.#$[\]]/g, "_");
}

async function syncFromFirebase(email) {
  if (!useFirebase) return;
  const key = emailKey(email);
  const fbKey = sanitizeFirebaseKey(key);
  try {
    const snapshotPromise = firebase.database().ref('users/' + fbKey).once('value');
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Sync timeout")), 3000));

    const snapshot = await Promise.race([snapshotPromise, timeoutPromise]);
    const data = snapshot.val();
    if (data) {
      const users = getUsers();
      users[key] = mergeUserData(users[key] || {}, data);
      saveUsers(users);
    }
  } catch (err) {
    console.warn("Gagal/Skip sinkronisasi data dari Firebase (melanjutkan login lokal):", err.message);
  }
}

async function syncToFirebase() {
  if (!useFirebase) return;
  if (_syncingToFirebase) return;
  const key = getCurrentUserKey();
  if (!key) return;
  const user = getCurrentUser();
  if (!user) return;
  const fbKey = sanitizeFirebaseKey(key);

  _syncingToFirebase = true;
  try {
    const snapshot = await firebase.database().ref('users/' + fbKey).once('value');
    const remoteData = snapshot.val() || {};

    const merged = mergeUserData(user, remoteData);
    const syncData = { ...merged };
    delete syncData.passHash;

    await firebase.database().ref('users/' + fbKey).set(syncData);
  } catch (err) {
    console.error("Gagal sinkronisasi data ke Firebase:", err);
  } finally {
    _syncingToFirebase = false;
  }
}

/* =========================================================
   REALTIME LISTENER
   ========================================================= */
function subscribeRealtime() {
  if (!useFirebase) return;
  const key = getCurrentUserKey();
  if (!key) return;
  const fbKey = sanitizeFirebaseKey(key);

  unsubscribeRealtime();

  _realtimeListener = firebase.database().ref('users/' + fbKey).on('value', (snapshot) => {
    if (_syncingToFirebase) return;

    const data = snapshot.val();
    if (!data) return;

    const localKey = getCurrentUserKey();
    if (!localKey) return;

    const users = getUsers();
    const before = users[localKey];
    if (!before) return;

    users[localKey] = mergeUserData(before, data);
    saveUsers(users);

    if (typeof renderTasks === "function") renderTasks();
    if (typeof renderLevelHero === "function") renderLevelHero();
    if (typeof renderSidebarUser === "function") renderSidebarUser();
    if (typeof renderTodayLog === "function") renderTodayLog();
    if (typeof initHistoryPage === "function") initHistoryPage();
    if (typeof renderProgressPage === "function") renderProgressPage();
  });
}

function unsubscribeRealtime() {
  if (!useFirebase || !_realtimeListener) return;
  const key = getCurrentUserKey();
  if (key) {
    const fbKey = sanitizeFirebaseKey(key);
    firebase.database().ref('users/' + fbKey).off('value', _realtimeListener);
  }
  _realtimeListener = null;
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
  if (useFirebase) {
    syncToFirebase();
  }
  return users[key];
}

/* =========================================================
   HAPUS AKUN
   ========================================================= */
async function deleteUserAccount() {
  unsubscribeRealtime();

  const key = getCurrentUserKey();
  const fbKey = key ? sanitizeFirebaseKey(key) : null;

  // Hapus localStorage INSTAN
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem(SESSION_KEY);

  // Firebase: fire-and-forget
  if (useFirebase && fbKey) {
    firebase.database().ref('users/' + fbKey).remove().catch(() => {});
    const currentUser = firebase.auth().currentUser;
    if (currentUser) {
      currentUser.delete().catch(() => {});
    }
  }

  // Redirect dengan loading bar
  navigateTo('index.html');
}

/* Panggil di awal setiap halaman yang butuh login */
function requireAuth() {
  const key = getCurrentUserKey();
  const user = getCurrentUser();
  if (!key || !user) {
    navigateTo("index.html");
    return;
  }
  if (!user.onboarded) {
    navigateTo("onboarding.html");
    return;
  }
  if (useFirebase && key) {
    subscribeRealtime();

    syncFromFirebase(key).then(() => {
      if (typeof renderTasks === "function") renderTasks();
      if (typeof renderLevelHero === "function") renderLevelHero();
      if (typeof renderSidebarUser === "function") renderSidebarUser();
      if (typeof initHistoryPage === "function") initHistoryPage();
      if (typeof renderTodayLog === "function") renderTodayLog();
      if (typeof renderProgressPage === "function") renderProgressPage();
    });
  }
}

/* Panggil di halaman login/register: kalau sudah login, langsung lempar ke dashboard */
function redirectIfLoggedIn() {
  const user = getCurrentUser();
  if (getCurrentUserKey() && user) {
    if (!user.onboarded) {
      navigateTo("onboarding.html");
    } else {
      navigateTo("dashboard.html");
    }
  }
}

/* Inisialisasi loading bar — jalan langsung (auth.js selalu di <body> bagian bawah) */
if (document.body) {
  initPageLoader();
} else {
  document.addEventListener("DOMContentLoaded", initPageLoader);
}
