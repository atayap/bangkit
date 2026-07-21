/* =========================================================
   BANGKIT — chat.js
   Mengelola Halaman Obrolan Asisten Penasihat & Perencana.
   ========================================================= */

function initChatPage() {
  requireAuth();
  renderSidebarUser();

  const chatContainer = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send-btn");

  if (!chatContainer || !chatForm || !chatInput || !sendBtn) return;

  const user = getCurrentUser();
  if (!user) return;

  // Inisialisasi Riwayat Obrolan dari Database User
  let chatHistory = user.chatHistory || [];

  // Pesan sambutan default jika baru pertama kali buka chat
  const defaultWelcome = {
    role: "assistant",
    content: `Halo ${user.name || "Kawan"}! Saya adalah Asisten Diskusi & Penasihat Produktivitas khusus untuk Anda di Bangkit. 

Saya siap membantu Anda:
• Menyusun prioritas jadwal pengerjaan yang efisien.
• Memberikan motivasi & rekomendasi pengaturan waktu (Time Management).
• Mengevaluasi beban aktivitas harian Anda.

Tulis apa saja tantangan produktivitas Anda hari ini, mari kita diskusikan bersama!`
  };

  if (chatHistory.length === 0) {
    chatHistory.push(defaultWelcome);
    updateCurrentUser(u => {
      u.chatHistory = chatHistory;
    });
  }

  // Render semua riwayat obrolan yang ada
  renderAllMessages(chatHistory);

  // Jika API Key belum disetel, tunjukkan note peringatan
  if (!user.orApiKey) {
    const warningBubble = document.createElement("div");
    warningBubble.className = "chat-bubble assistant";
    warningBubble.style.borderColor = "rgba(220, 53, 69, 0.4)";
    warningBubble.style.color = "#ff6b6b";
    warningBubble.innerHTML = "<strong>Pemberitahuan:</strong> API Key OpenRouter belum disetel. Hubungkan API Key Anda terlebih dahulu di halaman <strong><a href='settings.html' style='color:#ff6b6b; text-decoration: underline;'>Setelan</a></strong> agar dapat mengobrol dengan asisten.";
    chatContainer.appendChild(warningBubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Nonaktifkan form input
    chatInput.disabled = true;
    chatInput.placeholder = "Aktifkan API Key di Setelan terlebih dahulu...";
    sendBtn.disabled = true;
  }

  // Form Submit Handler
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const promptText = chatInput.value.trim();
    if (!promptText) return;

    // Bersihkan input
    chatInput.value = "";

    // 1. Tambah & render pesan user
    const userMessage = { role: "user", content: promptText };
    chatHistory.push(userMessage);
    appendSingleMessage("user", promptText);
    saveChatHistory(chatHistory);

    // 2. Render indicator loading/thinking
    const thinkingDot = showThinkingIndicator();

    // Matikan input sementara
    chatInput.disabled = true;
    sendBtn.disabled = true;

    try {
      const responseText = await callChatAi(promptText, chatHistory, user.orApiKey);
      removeThinkingIndicator(thinkingDot);

      // Search for the [ACTION_DATA] marker in the response
      let cleanText = responseText;
      let actionData = null;
      
      const marker = "[ACTION_DATA]";
      const markerIndex = responseText.indexOf(marker);
      if (markerIndex !== -1) {
        cleanText = responseText.substring(0, markerIndex).trim();
        const jsonStr = responseText.substring(markerIndex + marker.length).trim();
        try {
          const jsonClean = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();
          actionData = JSON.parse(jsonClean);
        } catch (e) {
          console.warn("Gagal parse action data JSON:", e);
        }
      }

      // 3. Tambah & render pesan asisten
      const assistantMessage = { role: "assistant", content: cleanText };
      chatHistory.push(assistantMessage);
      appendSingleMessage("assistant", cleanText);
      saveChatHistory(chatHistory);

      // 4. Jalankan Aksi CRUD Tugas yang dikirimkan oleh AI
      if (actionData && actionData.action) {
        executeTaskAction(actionData);
      }
    } catch (err) {
      removeThinkingIndicator(thinkingDot);
      appendSingleMessage("assistant", "Maaf, terjadi kendala saat memproses jawaban: " + (err.message || "Pastikan API key valid & coba sesaat lagi."));
    } finally {
      // Hidupkan kembali input
      chatInput.disabled = false;
      sendBtn.disabled = false;
      chatInput.focus();
    }
  });
}

function executeTaskAction(actionData) {
  try {
    if (actionData.action === "add" && actionData.task) {
      const text = actionData.task.text || "";
      const category = actionData.task.category || "disiplin";
      const time = actionData.task.time || "";
      addTask(text, category, time);
    } 
    else if (actionData.action === "edit" && actionData.taskId && actionData.task) {
      updateCurrentUser(u => {
        const t = u.tasks.find(x => x.id === actionData.taskId);
        if (t) {
          if (actionData.task.text) t.text = actionData.task.text;
          if (actionData.task.category) t.category = actionData.task.category;
          if (actionData.task.time !== undefined) t.time = actionData.task.time;
        }
      });
      renderSidebarUser();
    } 
    else if (actionData.action === "delete" && actionData.taskId) {
      deleteTask(actionData.taskId);
    } 
    else if (actionData.action === "complete" && actionData.taskId) {
      const before = computeLevel(totalXpFromTasks(getCurrentUser().tasks)).level;
      updateCurrentUser(u => {
        const t = u.tasks.find(x => x.id === actionData.taskId);
        if (t) t.done = (actionData.done !== undefined) ? actionData.done : !t.done;
      });
      const after = computeLevel(totalXpFromTasks(getCurrentUser().tasks)).level;
      renderSidebarUser();
      if (after > before) {
        showToast(`✦ NAIK LEVEL — Kini Level ${after}: ${getStageForLevel(after).name}`);
      }
    }
  } catch (err) {
    console.error("Gagal menjalankan sinkronisasi tugas chat:", err);
  }
}

// Fungsi Parse Markdown Sederhana secara Aman
function parseBasicMarkdown(text) {
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold text (**text**)
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Italic text (*text*)
  escaped = escaped.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Bullet list (baris baru berawalan • / * / -)
  escaped = escaped.replace(/^\s*[\*\-•]\s*(.*?)$/gm, "• $1");

  return escaped;
}

// Render semua riwayat
function renderAllMessages(history) {
  const chatContainer = document.getElementById("chat-messages");
  if (!chatContainer) return;
  chatContainer.innerHTML = "";

  history.forEach(msg => {
    let text = msg.content;
    const marker = "[ACTION_DATA]";
    const index = text.indexOf(marker);
    if (index !== -1) {
      text = text.substring(0, index).trim();
    }
    appendSingleMessage(msg.role, text);
  });
}

// Append satu gelembung pesan ke DOM
function appendSingleMessage(role, content) {
  const chatContainer = document.getElementById("chat-messages");
  if (!chatContainer) return;

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble " + (role === "user" ? "user" : "assistant");
  bubble.innerHTML = parseBasicMarkdown(content);
  
  chatContainer.appendChild(bubble);
  // Auto-scroll ke bawah
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Simpan history ke LocalStorage
function saveChatHistory(history) {
  // Hanya simpan 20 chat terakhir agar localstorage tidak penuh
  const trimmed = history.slice(-25);
  updateCurrentUser(u => {
    u.chatHistory = trimmed;
  });
}

// Menampilkan indikator berpikir
function showThinkingIndicator() {
  const chatContainer = document.getElementById("chat-messages");
  if (!chatContainer) return null;

  const thinkingDiv = document.createElement("div");
  thinkingDiv.className = "thinking";
  thinkingDiv.id = "thinking-indicator";
  thinkingDiv.innerHTML = "<span></span><span></span><span></span>";

  chatContainer.appendChild(thinkingDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return thinkingDiv;
}

// Hapus indikator berpikir
function removeThinkingIndicator(indicatorEl) {
  if (indicatorEl && indicatorEl.parentNode) {
    indicatorEl.parentNode.removeChild(indicatorEl);
  } else {
    const el = document.getElementById("thinking-indicator");
    if (el) el.parentNode.removeChild(el);
  }
}

// API Call ke OpenRouter dengan model openrouter/auto
async function callChatAi(userPrompt, history, apiKey) {
  const user = getCurrentUser();
  const tasks = user.tasks || [];
  const tasksString = tasks.map(t => `- ID: ${t.id}, Text: "${t.text}", Category: "${t.category}", Time: "${t.time || ''}", Done: ${t.done}`).join("\n");

  const SYSTEM_PROMPT = `Kamu adalah Asisten Diskusi & Penasihat tingkat tinggi di web aplikasi 'Bangkit'. 
Tugasmu adalah:
1. Membantu pengguna mereview jadwal harian agar hemat waktu & sehat.
2. Memberikan motivasi disiplin yang tegas namun bersahabat, ringkas, dan praktis.
3. Memberikan panduan pengembangan diri (mindset & action plan).
4. Jika pengguna meminta untuk menambahkan, mengedit/mengubah, menghapus, atau menyelesaikan sebuah tugas (misal: "tambahkan tugas ngoding 2 jam", "hapus tugas olahraga", "oke apa selanjutnya", dll), kamu harus melakukan aksi tersebut dan memicu perubahan di database lokal.

PENTING & WAJIB:
- Kamu HARUS LANGSUNG BERTINDAK nyata (dengan menyertakan tag [ACTION_DATA]) ketika pengguna menyuruh atau menyetujui penambahan atau perubahan tugas. Jangan pernah menunda-nunda tindakan atau meminta konfirmasi berulang kali untuk hal yang sudah jelas!
- Jika teks jawabanmu mengklaim telah melakukan sesuatu (misal: "Tugas X sudah saya tambahkan", "Saya tambahkan tugas Y sekarang", "Status tugas Z berhasil diperbarui"), maka kamu WAJIB menyertakan tag [ACTION_DATA] di akhir pesanmu. Jangan berbohong di pesan teks tanpa melakukan aksi database riil!

Format Aksi Khusus:
Jika pengguna berniat mengubah/mengelola tugas (tambah/edit/hapus/selesai), setelah pesan percakapan normalmu berakhir, tambahkan tag khusus '[ACTION_DATA]' diikuti persis satu baris JSON valid bermodel format di bawah (tanpa markdown box):

[ACTION_DATA]{"action": "add"|"edit"|"delete"|"complete", "taskId": "ID_TUGAS", "task": {"text":"Deskripsi tugas singkat","category":"fisik"|"otak"|"disiplin","time":"⏱️ X Jam" atau "⏰ HH:MM - HH:MM" atau ""}, "done": true|false}

Petunjuk parameter JSON:
- action: 'add' (tambah tugas), 'edit' (ubah tugas), 'delete' (hapus tugas), 'complete' (tanda tugas selesai / checklist).
- taskId: Wajib diisi untuk aksi 'edit', 'delete', dan 'complete'. Cocokkan dengan teliti dari Daftar Tugas Aktif Pengguna di bawah. Jika tidak ditemukan tugas yang cocok untuk diedit/dihapus, pilih action 'add' (tambah baru).
- done: Boolean untuk menandai tugas selesai (complete).
- time: Gunakan format "⏱️ X Jam / Menit" atau "⏰ HH:MM - HH:MM".

Aturan Pembicaraan:
- Berbahasa Indonesia yang sopan, memotivasi, dan terstruktur.
- Jangan bertele-tele. Jaga jawaban di bawah 3-4 paragraf agar nyaman dibaca di layar HP/Desktop.

Daftar Tugas Aktif Pengguna Saat Ini:
${tasksString || "(Belum ada tugas aktif)"}`;

  // Filter history: ambil maksimal 8 pesan terakhir agar context window efisien
  const memoryMessages = history.slice(-8).map(h => ({
    role: h.role === "assistant" ? "assistant" : "user",
    content: h.content
  }));

  const messagesPayload = [
    { role: "system", content: SYSTEM_PROMPT },
    ...memoryMessages
  ];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "Bangkit - Diskusi",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages: messagesPayload
    })
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    if (res.status === 401) throw new Error("API key ditolak. Cek di halaman Setelan.");
    if (res.status === 402) throw new Error("Kredit model gratis habis/limit batas tercapai.");
    throw new Error(`Server returned code ${res.status}: ${bodyText.slice(0, 100)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Jawaban kosong diterima dari AI.");
  
  return Array.isArray(content) ? content.map(c => c.text || "").join("") : content;
}
