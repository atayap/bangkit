/* =========================================================
   BANGKIT — auth.js
   Integrasi Firebase Authentication + Status Progres Lokal.
   ========================================================= */

const DB_KEY = "bangkit_users";
const SESSION_KEY = "bangkit_session";

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

/* Fungsi Registrasi User Baru */
async function registerUser({ name, email, password }) {
  const key = emailKey(email);

  if (useFirebase) {
    try {
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      // Simpan Display Name ke Firebase Profile
      await userCredential.user.updateProfile({
        displayName: name.trim()
      });
      
      // Inisialisasi data progres lokal jika belum ada
      const users = getUsers();
      if (!users[key]) {
        users[key] = {
          name: name.trim(),
          email: key,
          createdAt: Date.now(),
          xp: 0,
          tasks: [],
          tutorialSeen: false,
        };
        saveUsers(users);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  } else {
    // Mode Fallback Lokal (Password Hash)
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
      
      // Buat entri profil lokal jika belum ada (misal dari register lain)
      const users = getUsers();
      if (!users[key]) {
        users[key] = {
          name: user.displayName || "Pengguna Baru",
          email: key,
          createdAt: Date.now(),
          xp: 0,
          tasks: [],
          tutorialSeen: false,
        };
        saveUsers(users);
      }
      localStorage.setItem(SESSION_KEY, key);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  } else {
    // Mode Fallback Lokal
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

    // Daftarkan progres lokal jika belum pernah login
    const users = getUsers();
    if (!users[key]) {
      users[key] = {
        name: user.displayName || "Pengguna Google",
        email: key,
        createdAt: Date.now(),
        xp: 0,
        tasks: [],
        tutorialSeen: false,
      };
      saveUsers(users);
    }
    localStorage.setItem(SESSION_KEY, key);
    return { ok: true, user: user };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* Fungsi Logout */
async function logoutUser() {
  if (useFirebase) {
    try {
      await firebase.auth().signOut();
    } catch (err) {
      console.error("Gagal melakukan sign out dari Firebase:", err);
    }
  }
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
