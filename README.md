# Bangkit

Website produktivitas pribadi dengan sistem level & evolusi visual. Gelap, monokrom, tanpa server — semua data tersimpan di browser perangkatmu sendiri.

## Cara hosting di GitHub Pages

1. Buat repository baru di GitHub (bisa **Private** kalau mau ekstra tenang, meski Pages dari repo private butuh GitHub Pro/Team — kalau pakai akun gratis, repo harus **Public** agar Pages aktif. Isi kode tidak berisi data pribadi apapun, jadi aman jika publik; datamu tetap hanya di browser, bukan di repo).
2. Upload seluruh isi folder `Produktifitas` ini ke root repository (jangan taruh di dalam subfolder, biar linknya rapi — atau taruh di subfolder juga tidak masalah, GitHub Pages tetap bisa serve).
3. Masuk ke **Settings → Pages** di repo tersebut.
4. Di bagian **Source**, pilih branch `main` dan folder `/ (root)`, lalu **Save**.
5. Tunggu 1–2 menit, GitHub akan memberi URL seperti `https://namamu.github.io/nama-repo/`.
6. Buka URL itu → kamu akan diarahkan ke halaman **Daftar** dulu untuk membuat akun pertamamu.

## Struktur file

```
Produktifitas/
├── index.html          # Halaman login
├── register.html        # Halaman daftar
├── dashboard.html        # Dasbor utama (tugas, XP, level)
├── progress.html         # Halaman evolusi/progres visual
├── css/style.css         # Semua styling
├── js/
│   ├── auth.js           # Login/register/logout (localStorage)
│   ├── levels.js         # Rumus XP & level, definisi 6 tahap
│   ├── app.js             # Logika dasbor & tugas
│   ├── progress.js        # Logika halaman progres
│   └── tutorial.js        # Modal pengenalan/onboarding
└── assets/svg/           # 6 ilustrasi tahap evolusi (SVG)
```

## Cara kerja sistem level

- Setiap tugas punya kategori: **Fisik**, **Otak**, atau **Disiplin**.
- Menyelesaikan tugas memberi XP (Fisik/Otak = 25 XP, Disiplin = 15 XP).
- XP terkumpul menentukan **Level**. Kebutuhan XP naik progresif tiap level.
- Setiap level masuk ke salah satu dari **6 tahap evolusi visual**, terlihat di halaman Progres:

| Level | Tahap |
|---|---|
| 1–2 | Yang Tertidur |
| 3–4 | Yang Bangun |
| 5–6 | Yang Berlatih |
| 7–8 | Yang Berpikir |
| 9–10 | Yang Bangkit |
| 11+ | Yang Tercerahkan |

Mau ubah kebutuhan XP, nilai XP per kategori, atau nama/deskripsi tahap? Semua ada di `js/levels.js` — tinggal edit angkanya.

## Tentang privasi & keamanan (penting dibaca)

Situs ini **hosting statis** (tanpa server backend), jadi sistem login bekerja sepenuhnya di browser:

- Password tidak disimpan sebagai teks biasa — di-hash pakai SHA-256 sebelum disimpan.
- Semua data (akun, daftar tugas, XP) tersimpan di `localStorage` browser, **khusus untuk perangkat & browser itu saja** — tidak pernah terkirim ke server manapun.
- Ini cukup untuk mencegah orang terdekatmu asal buka dan langsung lihat isinya (mereka butuh tahu email+password akunmu). Tapi ini **bukan pengaman tingkat bank** — siapa pun yang benar-benar paham developer tools browser secara teknis bisa melihat data di localStorage jika mereka punya akses fisik ke perangkat dan tahu cara membukanya.
- Karena datanya per-browser, jika kamu ganti perangkat atau hapus data browser, progresmu ikut hilang (tidak ada sinkronisasi ke akun lain). Kalau nanti butuh ini, opsinya adalah menyambungkan ke layanan seperti Firebase — bilang saja kalau mau dibantu ke arah situ.

## Uji coba lokal sebelum di-push

Karena halaman Progres memuat file SVG lewat `fetch()`, membuka `index.html` langsung dengan cara klik dua kali (`file://`) bisa gagal memuat gambar akibat pembatasan browser. Untuk tes lokal, jalankan server sederhana dulu, contoh:

```
cd Produktifitas
python3 -m http.server 8000
```

Lalu buka `http://localhost:8000` di browser. Setelah di-hosting lewat GitHub Pages, ini otomatis tidak jadi masalah.
