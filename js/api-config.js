/* =========================================================
   BANGKIT — api-config.js
   Konfigurasi API Key Terpusat untuk OpenRouter AI.
   ========================================================= */

const API_CONFIG = {
  // PENTING: Ganti string di bawah ini dengan API Key OpenRouter Anda yang sudah di-encode ke Base64.
  // Cara mendapatkan Base64 dari API Key Anda:
  // Di Console Browser (F12 -> Console), ketik: btoa("MASUKKAN_API_KEY_OPENROUTER_DISINI")
  // Salin hasilnya dan tempel di bawah ini.
  // Keamanan: Teknik ini mencegah bot otomatis (scraper) membaca API Key secara mentah dari file kode.
  apiKeyEncoded: "c2stb3ItdjEtNDNiMDFlOGRjMmJhZTA0MDQ5NWI4Y2UzMTIxN2RiOGM4ZWExNTk0NTkyYTdlMDc3OWIxYTAxNGNkYjE1MjFkMA==", // Ter-enkode Base64 secara aman
  model: "openrouter/auto" // Model AI default terpusat
};

function getOpenRouterApiKey() {
  try {
    const key = atob(API_CONFIG.apiKeyEncoded);
    if (!key || key.includes("YOUR_OPENROUTER_API_KEY_HERE")) {
      return "";
    }
    return key;
  } catch (e) {
    console.error("Gagal men-decode API Key OpenRouter:", e);
    return "";
  }
}

function getOpenRouterModel() {
  return API_CONFIG.model || "openrouter/auto";
}
