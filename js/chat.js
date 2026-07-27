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

  // Filter riwayat chat yang berumur lebih dari 30 hari (1 bulan)
  const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  let updated = false;

  chatHistory = chatHistory.filter(msg => {
    // Jika tidak ada timestamp (chat lama sebelum fitur ini ada), beri timestamp saat ini
    if (!msg.timestamp) {
      msg.timestamp = Date.now();
      updated = true;
    }
    return msg.timestamp >= oneMonthAgo;
  });

  // Pesan sambutan default jika baru pertama kali buka chat
  const defaultWelcome = {
    role: "assistant",
    content: `Halo ${user.name || "Kawan"}! Saya adalah Asisten Diskusi & Penasihat Produktivitas khusus untuk Anda di Bangkit. 

Saya siap membantu Anda:
• Menyusun prioritas jadwal pengerjaan yang efisien.
• Memberikan motivasi & rekomendasi pengaturan waktu (Time Management).
• Mengevaluasi beban aktivitas harian Anda.

Tulis apa saja tantangan produktivitas Anda hari ini, mari kita diskusikan bersama!`,
    timestamp: Date.now()
  };

  if (chatHistory.length === 0) {
    chatHistory.push(defaultWelcome);
    updated = true;
  }

  if (updated) {
    updateCurrentUser(u => {
      u.chatHistory = chatHistory;
    });
  }

  // Render semua riwayat obrolan yang ada
  renderAllMessages(chatHistory);

  const clearBtn = document.getElementById("clear-chat-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (confirm("Apakah Anda yakin ingin membersihkan layar obrolan? (AI akan tetap mengingat konteks pembicaraan sebelumnya)")) {
        updateCurrentUser(u => {
          if (u.chatHistory) {
            u.chatHistory.forEach((msg, idx) => {
              // Biarkan pesan selamat datang (pesan pertama) tetap terlihat
              if (idx === 0 && msg.role === "assistant" && msg.content.startsWith("Halo")) {
                 msg.hidden = false;
              } else {
                 msg.hidden = true;
              }
            });
          }
        });
        const userNow = getCurrentUser();
        renderAllMessages(userNow.chatHistory);
      }
    });
  }

  // Jika API Key belum disetel, tunjukkan note peringatan
  if (!getOpenRouterApiKey()) {
    const warningBubble = document.createElement("div");
    warningBubble.className = "chat-bubble assistant";
    warningBubble.style.borderColor = "rgba(220, 53, 69, 0.4)";
    warningBubble.style.color = "#ff6b6b";
    warningBubble.innerHTML = "<strong>Pemberitahuan:</strong> API Key OpenRouter terpusat belum disetel di berkas <code>js/api-config.js</code>. Hubungi admin/pengembang untuk menyetel API Key agar fitur asisten AI dapat digunakan.";
    chatContainer.appendChild(warningBubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Nonaktifkan form input
    chatInput.disabled = true;
    chatInput.placeholder = "Fitur dinonaktifkan (API Key belum diatur)...";
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
    const userMessage = { role: "user", content: promptText, timestamp: Date.now() };
    chatHistory.push(userMessage);
    appendSingleMessage("user", promptText);
    saveChatHistory(chatHistory);

    // 2. Render indicator loading/thinking
    const thinkingDot = showThinkingIndicator();

    // Matikan input sementara
    chatInput.disabled = true;
    sendBtn.disabled = true;

    try {
      const responseText = await callChatAi(promptText, chatHistory, getOpenRouterApiKey());
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
      const assistantMessage = { role: "assistant", content: cleanText, timestamp: Date.now() };
      chatHistory.push(assistantMessage);
      appendSingleMessage("assistant", cleanText);
      saveChatHistory(chatHistory);

      // 4. Jalankan Aksi CRUD Tugas yang dikirimkan oleh AI (dukung objek tunggal & array)
      if (actionData && (actionData.action || Array.isArray(actionData))) {
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
    // Dukung baik objek tunggal MAUPUN array aksi (batch)
    const actions = Array.isArray(actionData) ? actionData : [actionData];
    if (actions.length === 0) return;

    let addedCount = 0, editedCount = 0, deletedCount = 0, completedCount = 0;
    let levelUp = false;

    actions.forEach(a => {
      if (a.action === "add" && a.task) {
        addTask(a.task.text || "", a.task.category || "disiplin", a.task.time || "");
        addedCount++;
      } 
      else if (a.action === "edit" && a.taskId && a.task) {
        updateCurrentUser(u => {
          const t = u.tasks.find(x => x.id === a.taskId);
          if (t) {
            if (a.task.text) t.text = a.task.text;
            if (a.task.category) t.category = a.task.category;
            if (a.task.time !== undefined) t.time = a.task.time;
          }
        });
        editedCount++;
      } 
      else if (a.action === "delete" && a.taskId) {
        deleteTask(a.taskId);
        deletedCount++;
      } 
      else if (a.action === "complete" && a.taskId) {
        const before = computeLevel(totalXpFromUser(getCurrentUser())).level;
        updateCurrentUser(u => {
          const t = u.tasks.find(x => x.id === a.taskId);
          if (t) t.done = (a.done !== undefined) ? a.done : !t.done;
        });
        const after = computeLevel(totalXpFromUser(getCurrentUser())).level;
        completedCount++;
        if (after > before) levelUp = true;
      }
    });

    // Re-render UI sekali untuk semua aksi
    renderSidebarUser();
    renderLevelHero();

    // Toast ringkasan
    const parts = [];
    if (addedCount > 0) parts.push(`+${addedCount} tugas`);
    if (editedCount > 0) parts.push(`${editedCount} diubah`);
    if (deletedCount > 0) parts.push(`${deletedCount} dihapus`);
    if (completedCount > 0) parts.push(`${completedCount} selesai`);
    if (parts.length > 0) {
      setTimeout(() => showToast(`✅ ${parts.join(', ')} berhasil`), 400);
    }
    if (levelUp) {
      const after = computeLevel(totalXpFromUser(getCurrentUser())).level;
      setTimeout(() => showToast(`✦ NAIK LEVEL — Kini Level ${after}: ${getStageForLevel(after).name}`), 1000);
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
    if (msg.hidden) return;
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
  // Simpan hingga 100 chat terakhir
  const trimmed = history.slice(-100);
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

  const SYSTEM_PROMPT = `Kamu adalah Asisten Produktivitas & Manajemen Tugas di aplikasi 'Bangkit'. Tugasmu adalah membantu pengguna mengatur jadwal harian mereka secara EFEKTIF dan LANGSUNG BERTINDAK.

### ATURAN UTAMA — BACA INI DULU:
1. Jika pengguna MEMINTA atau MENYETUJUI penambahan/ubah/hapus/cek tugas, kamu HARUS LANGSUNG EKSEKUSI dengan tag [ACTION_DATA]. Jangan tanya konfirmasi ulang — langsung kerjakan!
2. Jika pengguna meminta MENAMBAH BANYAK TUGAS sekaligus (misal: "tambahin 3 tugas ya", "saya mau nambah: A, B, C"), kamu WAJIB gunakan format ARRAY untuk menambahkan semuanya dalam SATU RESPON.
3. Jangan hanya bilang "oke sudah ditambahkan" tanpa menyertakan [ACTION_DATA] — kamu HARUS beneran menjalankan aksinya.

### FORMAT [ACTION_DATA] — DUA BENTUK:

**Bentuk 1 — Satu aksi:**
[ACTION_DATA]{"action":"add","task":{"text":"Belajar React","category":"otak","time":"⏰ 10:00 - 12:00"}}

**Bentuk 2 — Banyak aksi (ARRAY):**
[ACTION_DATA][{"action":"add","task":{"text":"Belajar React","category":"otak","time":"⏰ 10:00 - 12:00"}},{"action":"add","task":{"text":"Lari pagi","category":"fisik","time":"⏱️ 30 Menit"}},{"action":"complete","taskId":"abc123"}]

### PARAMETER:
- action: "add" | "edit" | "delete" | "complete"
- taskId: WAJIB untuk edit/delete/complete. Ambil dari daftar tugas di bawah.
- task.text: Deskripsi tugas (wajib untuk add)
- task.category: "fisik" | "otak" | "disiplin"
- task.time: "⏰ HH:MM - HH:MM" atau "⏱️ X Jam/Menit" atau ""

### GAYA BICARA:
- Bahasa Indonesia yang hangat, memotivasi, tapi to the point.
- Maksimal 2-3 paragraf. Jangan bertele-tele.

### DAFTAR TUGAS SAAT INI:
${tasksString || "(Belum ada tugas)"}`;

  // Filter history: ambil maksimal 12 pesan terakhir agar AI paham konteks lebih baik
  const memoryMessages = history.slice(-12).map(h => ({
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
