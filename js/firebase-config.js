/* =========================================================
   BANGKIT — firebase-config.js
   Konfigurasi Firebase Web App Anda pelacak pengguna.
   Silakan ubah placeholder di bawah dengan kredensial asli 
   dari Firebase Console Anda: https://console.firebase.google.com/
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyCVj-sRXy6J7mZmbOnka4wgf2Q7Vt-IXs0",
  authDomain: "bangkit-52e8c.firebaseapp.com",
  projectId: "bangkit-52e8c",
  storageBucket: "bangkit-52e8c.firebasestorage.app",
  messagingSenderId: "416713048337",
  appId: "1:416713048337:web:9963b4fd862fd111d70cb0",
  measurementId: "G-4QRNXTN7TW"
};

// Deteksi apakah pengguna sudah mengatur kredensial asli
const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY_HERE";
