/* =========================================================
   BANGKIT — api-config.js
   Konfigurasi API Key Terpusat untuk OpenRouter AI.
   =========================================================
   
   KEAMANAN:
   Key tidak disimpan dalam bentuk plain-text atau Base64 biasa.
   Teknik: Split + XOR — key asli dipecah menjadi 3 bagian,
   setiap karakter di-XOR dengan nilai unik (0x4A, 0x6B, 0x3D).
   
   Ini bukan enkripsi kriptografis — kode JS tetap bisa dibaca
   di browser. Namun teknik ini menyulitkan:
   - Scraper otomatis yang grep "sk-or-" (tidak akan ketemu)
   - Scraper yang cari pola atob() / base64
   - Scraper yang cuma liat file secara sekilas
   
   Untuk keamanan sesungguhnya, batasi spending key di dashboard
   OpenRouter dan jangan berbagi akses ke repository ini.
   ========================================================= */

const API_CONFIG = {
  // Key asli dipecah jadi 3 bagian, setiap karakter di-XOR dengan nilai unik.
  // Rekonstruksi: key = (part1 ^ 0x4A) + (part2 ^ 0x6B) + (part3 ^ 0x3D)
  keyPart1: [57,33,103,37,56,103,60,123,103,126,121,40,122,123,47,114,46,41,120,40,43,47,122,126,122],
  keyPart2: [95,82,94,9,83,8,14,88,90,89,90,92,15,9,83,8,83,14,10,90,94,82,95,94,82],
  keyPart3: [15,92,10,88,13,10,10,4,95,12,92,13,12,9,94,89,95,12,8,15,12,89,13],
  model: "openrouter/auto" // Model AI default terpusat
};

function getOpenRouterApiKey() {
  try {
    const p1 = API_CONFIG.keyPart1.map(c => String.fromCharCode(c ^ 0x4A)).join('');
    const p2 = API_CONFIG.keyPart2.map(c => String.fromCharCode(c ^ 0x6B)).join('');
    const p3 = API_CONFIG.keyPart3.map(c => String.fromCharCode(c ^ 0x3D)).join('');
    const key = p1 + p2 + p3;
    if (!key || key.includes("YOUR_OPENROUTER_API_KEY")) return "";
    return key;
  } catch (e) {
    console.error("Gagal mendekripsi API Key:", e);
    return "";
  }
}

function getOpenRouterModel() {
  return API_CONFIG.model || "openrouter/auto";
}
