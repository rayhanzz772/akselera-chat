<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/assets/logo/white.png">
  <img src="public/assets/logo/dark.png" alt="Akselera Tech" width="260">
</picture>

# Akselera Chat

**Aplikasi chat internal dengan enkripsi end-to-end di sisi klien.**
Server menyimpan ciphertext. Kunci privat tidak pernah meninggalkan perangkat.

[![Next.js](https://img.shields.io/badge/Next.js-16.3.6-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.8-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.3.3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8.4-010101?logo=socketdotio&logoColor=white)](https://socket.io)

</div>

---

## Daftar Isi

- [Sekilas](#-sekilas)
- [Fitur](#-fitur)
- [Stack dan Alasan Memilihnya](#-stack-dan-alasan-memilihnya)
- [Arsitektur](#-arsitektur)
- [Keamanan dan Enkripsi](#-keamanan-dan-enkripsi)
- [Alur Utama](#-alur-utama)
- [Kontrak API](#-kontrak-api)
- [Event Socket.IO](#-event-socketio)
- [Menjalankan Secara Lokal](#-menjalankan-secara-lokal)
- [Yang Belum Selesai](#-yang-belum-selesai)
- [Catatan Sebelum Production](#-catatan-sebelum-production)

---

## 🔭 Sekilas

Backend ini adalah sisi server dari Akselera Chat. Tanggung jawabnya:

| | |
|---|---|
| 🔑 | Register, login, dan penyimpanan kunci publik RSA per pengguna |
| 🙈 | **Tidak pernah melihat plaintext** — hanya menyimpan dan meneruskan ciphertext |
| 📬 | Menyimpan riwayat percakapan dan pesan dalam bentuk terenkripsi |
| ⚡ | Meneruskan pesan realtime lewat Socket.IO |
| 👤 | Melacak status online / "terakhir dilihat" per pengguna |
| 🔐 | Verifikasi password dengan Argon2id, penerbitan JWT |

> **Catatan tentang enkripsi.** Semua enkripsi dan dekripsi pesan terjadi di klien (browser), bukan di sini. Backend hanya menyimpan ciphertext, kunci AES yang sudah dibungkus (*wrapped key*), dan kunci publik RSA milik tiap pengguna. Kalau database ini bocor, isi pesan tetap tidak terbaca tanpa kunci privat milik pengguna, yang tidak pernah dikirim ke server.

---

## ✨ Fitur

<details open>
<summary><b>Autentikasi</b></summary>

- Register dengan nama, email, dan password
- Password di-hash dengan Argon2id sebelum disimpan — plaintext password tidak pernah masuk log atau database
- Penyimpanan kunci publik RSA-OAEP milik pengguna saat register
- Login lewat `/auth/login`, mengembalikan access token JWT
- Endpoint `/auth/me` untuk validasi sesi
- Rate limiting pada endpoint login untuk mencegah brute force

</details>

<details>
<summary><b>Percakapan</b></summary>

- Membuat, mengambil daftar, dan menghapus percakapan
- Unread count dihitung per percakapan per pengguna
- Pencarian pengguna lewat `/users` untuk memulai percakapan baru
- Broadcast `conversation:updated` setiap ada pesan baru, supaya sidebar klien ikut naik urutannya

</details>

<details>
<summary><b>Pesan</b></summary>

- Penyimpanan pesan dalam bentuk ciphertext AES-GCM
- Penyimpanan dua salinan *wrapped key* per pesan — satu untuk penerima, satu untuk pengirim
- Riwayat pesan per percakapan dengan pagination
- Broadcast `message:new` ke room percakapan yang relevan
- Penandaan pesan sebagai sudah dibaca

</details>

<details>
<summary><b>Realtime & Presence</b></summary>

- Satu koneksi Socket.IO per klien, diautentikasi lewat JWT saat handshake
- Room per percakapan (`conversation:join` / `conversation:leave`)
- Broadcast status online dan "terakhir dilihat" ke lawan bicara

</details>

---

## 🧱 Stack dan Alasan Memilihnya

### Ringkasan

| Lapisan | Pilihan | Alasan utama |
|---|---|---|
| Framework | **Express.js** | Minim, matang, dan cukup untuk REST API + jembatan ke server Socket.IO tanpa banyak *boilerplate* |
| Realtime | **Socket.IO** | Reconnect otomatis dan semantik room bawaan, protokolnya sudah disepakati dengan frontend |
| Database | **PostgreSQL** | Relasi antar pengguna, percakapan, dan pesan jelas dan butuh transaksi yang konsisten |
| Cache & Adapter | **Redis** | Socket.IO adapter untuk *scaling* horizontal, plus cache status online |
| Hashing Password | **Argon2id** | Pemenang password hashing competition, tahan terhadap serangan GPU/ASIC lebih baik dari bcrypt |
| Autentikasi | **JWT** | Stateless, cocok dipasangkan dengan banyak instance server di belakang load balancer |
| Validasi Skema | **Zod** | Kontrak request/response tervalidasi di runtime, bukan cuma di TypeScript saat compile |

### Alasan yang lebih detail

<details>
<summary><b>Kenapa Express.js, bukan framework lain</b></summary>

Proyek ini butuh REST API yang bisa berbagi HTTP server yang sama dengan Socket.IO — keduanya memang didesain untuk hidup berdampingan di atas server `http` Node.js yang sama. Express cukup tipis untuk itu, tanpa memaksakan konvensi routing yang harus disesuaikan hanya supaya bisa "menumpangkan" WebSocket di port yang sama.

Praktiknya: `http.createServer(app)` dibuat sekali, lalu dipakai baik oleh Express maupun oleh instance Socket.IO.

</details>

<details>
<summary><b>Kenapa backend tidak pernah menyimpan atau melihat plaintext</b></summary>

Backend ini sengaja dirancang buta terhadap isi pesan. Yang disimpan di database hanya:

1. **Ciphertext AES-GCM** dari isi pesan
2. **Wrapped key** — kunci AES sekali pakai yang sudah dibungkus RSA-OAEP, disimpan dua kali (untuk pengirim dan penerima)
3. **Kunci publik RSA** milik tiap pengguna, dipakai klien lain untuk membungkus kunci AES saat mengirim pesan ke pengguna tersebut

Server tidak pernah menyimpan atau menerima kunci privat siapa pun. Ini konsekuensi langsung dari skema *envelope encryption* yang dipakai di sisi klien — backend hanya perlu jadi tempat penyimpanan dan jalur distribusi, bukan pihak yang perlu dipercaya untuk menjaga rahasia isi pesan.

</details>

<details>
<summary><b>Kenapa Socket.IO, bukan WebSocket mentah</b></summary>

WebSocket mentah tidak punya reconnect otomatis atau fallback transport. Socket.IO memberi keduanya, plus semantik room yang langsung dipakai untuk memisahkan broadcast per percakapan (`message:new`) dari broadcast global (`conversation:updated`, status online).

**Konsekuensi yang harus diingat:** setiap koneksi harus diautentikasi ulang lewat JWT saat handshake, dan klien wajib mengirim ulang `conversation:join` setiap kali event `connect` menyala — bukan hanya sekali saat socket dibuat.

</details>

<details>
<summary><b>Kenapa Redis untuk adapter Socket.IO</b></summary>

Begitu server Socket.IO perlu berjalan di lebih dari satu instance (di belakang load balancer), broadcast ke room tertentu harus disebarkan lintas instance. `@socket.io/redis-adapter` menyelesaikan ini dengan pub/sub Redis, tanpa perlu *sticky session* yang kaku di layer load balancer.

Redis yang sama juga dipakai untuk menyimpan status online, karena sifatnya *ephemeral* dan butuh TTL — cocok dibanding menulis ke PostgreSQL setiap kali status berubah.

</details>

<details>
<summary><b>Kenapa Argon2id, bukan bcrypt</b></summary>

Argon2id adalah pemenang Password Hashing Competition dan dirancang tahan terhadap serangan menggunakan GPU/ASIC, sesuatu yang jadi kelemahan bcrypt di dunia modern. Password dikirim sebagai plaintext lewat HTTPS dari klien (bukan tanggung jawab frontend untuk hashing), dan baru di-hash di sini sebelum disimpan.

</details>

---

## 🏗 Arsitektur

```
┌─────────────┐        HTTPS (REST)         ┌──────────────────┐
│             │ ───────────────────────────▶│                  │
│   Klien     │                              │   Express.js     │
│  (Browser)  │◀─────────────────────────────│   (REST API)     │
│             │                              │                  │
│             │        WSS (Socket.IO)       │  ┌────────────┐  │
│             │ ───────────────────────────▶│  │ Socket.IO   │  │
│             │◀─────────────────────────────│  │  Server     │  │
└─────────────┘                              │  └─────┬──────┘  │
                                              │        │         │
                                              └────────┼─────────┘
                                                        │
                                        ┌───────────────┼───────────────┐
                                        ▼                               ▼
                                 ┌─────────────┐               ┌───────────────┐
                                 │ PostgreSQL  │               │     Redis     │
                                 │ (data utama)│               │ (adapter +    │
                                 │             │               │  presence)    │
                                 └─────────────┘               └───────────────┘
```

Semua ciphertext, wrapped key, dan kunci publik disimpan di PostgreSQL. Redis tidak pernah menyimpan isi pesan — hanya dipakai untuk koordinasi antar instance dan status online.

---

## 🔐 Keamanan dan Enkripsi

Skema kriptografi ini **diwarisi dari frontend** dan backend dirancang mengikuti kontrak yang sama, bukan mendiktenya:

<details open>
<summary><b>Envelope encryption RSA + AES</b></summary>

1. Klien membuat kunci AES-GCM 256-bit sekali pakai untuk tiap pesan
2. Klien mengenkripsi isi pesan dengan kunci AES tersebut
3. Klien membungkus kunci AES dengan RSA-OAEP milik penerima **dan** milik pengirim sendiri
4. Backend menerima ciphertext + dua wrapped key, lalu menyimpannya apa adanya

Backend tidak pernah melakukan operasi kriptografi apa pun — semua dilakukan Web Crypto API di browser. Peran backend murni sebagai penyimpan dan distributor.

</details>

<details>
<summary><b>Kenapa HTTPS wajib di production</b></summary>

`SubtleCrypto` di klien hanya tersedia di *secure context* (HTTPS atau `localhost`). Kalau backend disajikan lewat HTTP biasa di production, klien tidak akan bisa menjalankan operasi enkripsinya sama sekali — jadi HTTPS di sini bukan sekadar rekomendasi keamanan umum, tapi syarat fungsional.

</details>

<details>
<summary><b>Yang backend TIDAK boleh lakukan</b></summary>

- Tidak boleh melakukan logging isi pesan mentah (ciphertext boleh, tapi tetap dijaga agar tidak bocor ke log pihak ketiga)
- Tidak boleh menyimpan atau menerima kunci privat pengguna dalam bentuk apa pun
- Tidak boleh mendekripsi pesan "untuk keperluan moderasi" — arsitektur ini secara sengaja tidak mendukung moderasi konten sisi server

</details>

---

## 🔄 Alur Utama

1. Pengguna register → password di-hash Argon2id → kunci publik RSA disimpan
2. Pengguna login → password diverifikasi → JWT diterbitkan
3. Klien membuka koneksi Socket.IO, JWT dikirim saat handshake
4. Klien mengambil kunci publik lawan bicara lewat `/users/:id/public-key`
5. Klien mengenkripsi pesan (AES-GCM + dua wrapped key RSA-OAEP), lalu POST ke `/messages`
6. Backend menyimpan pesan, meng-update `unread_count`, lalu broadcast `message:new` dan `conversation:updated` ke room terkait
7. Klien penerima mendekripsi pesan secara lokal dengan kunci privatnya

---

## 📡 Kontrak API

| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/auth/register` | Registrasi pengguna baru + kunci publik RSA |
| `POST` | `/auth/login` | Login, mengembalikan JWT |
| `GET` | `/auth/me` | Validasi sesi saat ini |
| `GET` | `/users?q=` | Cari pengguna untuk memulai percakapan |
| `GET` | `/users/:id/public-key` | Ambil kunci publik RSA milik pengguna |
| `GET` | `/conversations` | Daftar percakapan milik pengguna |
| `POST` | `/conversations` | Buat percakapan baru |
| `DELETE` | `/conversations/:id` | Hapus percakapan |
| `GET` | `/conversations/:id/messages` | Riwayat pesan (paginated) |
| `POST` | `/messages` | Kirim pesan (ciphertext + wrapped keys) |
| `PATCH` | `/conversations/:id/read` | Tandai percakapan sudah dibaca |

Dokumentasi lengkap beserta contoh request/response tersedia di Swagger UI: `http://localhost:8000/api/docs`.

---

## ⚡ Event Socket.IO

| Event | Arah | Deskripsi |
|---|---|---|
| `conversation:join` | Klien → Server | Bergabung ke room sebuah percakapan |
| `conversation:leave` | Klien → Server | Keluar dari room percakapan |
| `message:new` | Server → Klien | Pesan baru masuk ke percakapan yang sedang dibuka |
| `conversation:updated` | Server → Klien | Ada aktivitas baru di sebuah percakapan (untuk update sidebar) |
| `presence:online` | Server → Klien | Lawan bicara berubah status online/offline |

---

## 🚀 Menjalankan Secara Lokal

1. **Clone dan install dependencies:**
   ```bash
   git clone https://github.com/username/akselera-chat-backend.git
   cd akselera-chat-backend
   npm install
   ```

2. **Konfigurasi environment:**
   ```bash
   cp .env.example .env
   ```

   ```env
   PORT=8000
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/akselera_chat
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=ganti_dengan_secret_yang_kuat
   JWT_EXPIRES_IN=1d
   ```

3. **Jalankan migrasi database:**
   ```bash
   npm run migrate
   ```

4. **Jalankan server:**
   ```bash
   npm run dev
   ```
   Server berjalan di `http://localhost:8000`, Socket.IO menempel di path yang sama.

---

## 🚧 Yang Belum Selesai

- Penghapusan pesan (soft delete) belum diimplementasi
- Belum ada mekanisme rotasi kunci RSA bila kunci privat pengguna hilang
- Rate limiting baru diterapkan di endpoint login, belum di endpoint pengiriman pesan

---

## ⚠️ Catatan Sebelum Production

- **Wajib HTTPS** — tanpa ini, `SubtleCrypto` di klien tidak akan berfungsi sama sekali
- Pastikan `JWT_SECRET` diganti dan tidak pernah di-commit ke repository
- Redis adapter perlu dikonfigurasi bila server dijalankan lebih dari satu instance
- Backup database perlu memperhitungkan bahwa data yang dicadangkan tetap terenkripsi — kehilangan kunci privat pengguna berarti kehilangan akses ke pesan lama secara permanen, backup tidak bisa menolong ini
---

## 📡 Kontrak API

Base URL default: `http://127.0.0.1:8001/api/v1` · Socket: `http://localhost:8001`

<details>
<summary><b>Endpoint</b></summary>

```http
POST   /auth/register
POST   /auth/login
GET    /auth/me

GET    /users

GET    /conversations
POST   /conversations
PATCH  /conversations/:conversationId/read
DELETE /conversations/:conversationId

GET    /conversations/:conversationId/messages
POST   /conversations/:conversationId/messages
```

</details>

<details>
<summary><b>Bentuk data penting</b></summary>

Register:

```json
{
  "name": "Nama Pengguna",
  "email": "user@example.com",
  "password": "plaintext-password",
  "public_key": "...",
  "encrypted_private_key": "...",
  "key_derivation_salt": "..."
}
```

Item percakapan — perhatikan `last_message`, yang dipakai frontend untuk preview tanpa request tambahan:

```json
{
  "id": "conversation-uuid",
  "unread_count": 3,
  "opponent": {
    "id": "user-uuid",
    "name": "Dimas Rizky",
    "email": "dimas@gmail.com",
    "public_key": "..."
  },
  "last_message": {
    "id": "message-uuid",
    "sender_id": "user-uuid",
    "ciphertext": "...",
    "iv": "...",
    "auth_tag": "...",
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

Kirim pesan:

```json
{ "ciphertext": "...", "iv": "...", "auth_tag": "..." }
```

</details>

<details>
<summary><b>Event Socket.IO</b></summary>

| Arah | Event | Isi |
|---|---|---|
| → | `conversation:join` | Masuk ke room percakapan |
| → | `conversation:leave` | Keluar dari room |
| → | `presence:get` | Minta status user tertentu (untuk dialog chat baru) |
| ← | `message:new` | Pesan baru pada room yang sedang dibuka |
| ← | `conversation:updated` | Preview, unread count, urutan sidebar |
| ← | `presence:sync` | Status presence otoritatif (menimpa seluruh store) |
| ← | `presence:update` | Perubahan status satu pengguna |
| ← | `connect_error` | Kegagalan koneksi atau autentikasi |

Koneksi:

```ts
io(SOCKET_URL, {
  auth: { token: jwtToken },
  withCredentials: true,
});
```

> **Penting untuk backend:** karena `presence:sync` bersifat otoritatif dan menimpa seluruh store di klien, payload-nya harus memuat **semua** pengguna yang relevan. Status yang tidak disebut di dalamnya akan dianggap sudah basi dan dibuang.

</details>

---

## 🚀 Menjalankan Secara Lokal

### Prasyarat

| Kebutuhan | Keterangan |
|---|---|
| **Node.js** | 20 atau lebih baru |
| **npm** | Sertaan Node.js |
| **Backend** | REST + Socket.IO aktif di port `8001` (repo terpisah) |

### 1 · Pasang dependency

```bash
npm install
```

### 2 · Siapkan environment

Buat `.env.local` di root proyek:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8001/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:8001
```

Kalau kedua variabel ini tidak diisi, frontend memakai nilai default di atas — jadi untuk pengembangan lokal keduanya sebenarnya opsional.

> ⚠️ Variabel `NEXT_PUBLIC_*` **tertanam ke bundle saat build** dan bisa dibaca siapa pun. Jangan pernah menaruh rahasia di sini.

### 3 · Jalankan

```bash
npm run dev
```

Buka **http://localhost:3000** — halaman root otomatis mengalihkan ke `/login`.

> 🔐 Aplikasi memakai Web Crypto API, yang hanya aktif di *secure context*. `localhost` dianggap aman, jadi pengembangan lokal berjalan tanpa HTTPS. **Deployment wajib HTTPS**, kalau tidak kripto tidak akan berfungsi sama sekali.

### 4 · Build production

```bash
npm run build
npm run start
```

`npm run build` menjalankan compile, pemeriksaan TypeScript, pembuatan rute, dan optimasi produksi.

### 5 · Perintah lain

```bash
npm run lint          # ESLint
npx tsc --noEmit      # Pemeriksaan tipe
```

### Alamat default

| Layanan | URL |
|---|---|
| Frontend | http://localhost:3000 |
| REST API | http://127.0.0.1:8001/api/v1 |
| Socket.IO | http://localhost:8001 |

---

## 🤖 AI Tools yang Dipakai

Bagian ini didokumentasikan terbuka karena alat bantu AI memengaruhi cara kode ini ditulis dan di-review.

| Tool | Peran |
|---|---|
| **Claude Code** | Refactor bertahap, ekstraksi modul, penelusuran kode, dan penulisan komponen presentasional |

### Cara penggunaannya

AI dipakai untuk pekerjaan yang terverifikasi secara mekanis — memindahkan kode ke modul baru, memecah komponen besar, dan menelusuri referensi lintas file. Pekerjaan semacam ini punya jawaban benar/salah yang jelas, sehingga hasilnya bisa diperiksa.

### Yang tetap diverifikasi manual

Setiap perubahan melewati pemeriksaan berikut sebelum dianggap selesai:

- `npx tsc --noEmit` dan `npx eslint` harus keluar tanpa error
- Setiap halaman harus benar-benar terkompilasi dan bisa dibuka
- Perilaku runtime diuji di browser — AI tidak bisa membuktikan ini
- **Setiap keputusan produk diambil pemilik proyek, bukan AI**

### Catatan penting

AI dapat menghasilkan kode yang **lolos pemeriksaan tipe tapi tetap salah secara logika**. Satu contoh nyata yang tertangkap saat review: sebuah handler ringkasan percakapan memakai objek pesan terenkripsi alih-alih yang sudah didekripsi, sehingga preview selalu menampilkan `"Encrypted message"`. TypeScript tidak bisa menangkap kesalahan itu karena bentuk tipenya sah.

Pelajaran yang diambil: **hasil AI wajib dibaca ulang baris per baris, bukan sekadar dipastikan lolos build.**

---

## 🚧 Yang Belum Selesai

Diurutkan dari yang paling berdampak.

### Prioritas tinggi

| # | Item | Dampak |
|---|---|---|
| 1 | **Belum ada test sama sekali** — tidak ada test runner, script `test`, maupun file test. Verifikasi sepenuhnya manual. | Regresi tidak tertangkap otomatis |
| 2 | **Semua kegagalan bootstrap diperlakukan sebagai kegagalan autentikasi.** `catch` di `use-chat-bootstrap.ts` memanggil `clearAuthToken()` lalu mengalihkan ke `/login` untuk *semua* error — termasuk 5xx dan koneksi putus. `ApiError` sudah membawa `status`, tapi belum dimanfaatkan. | API yang sedang gangguan akan mengeluarkan pengguna dan menghapus tokennya, padahal sesinya masih sah |
| 3 | **`presence:sync` menimpa hasil `presence:get`.** `replacePresence()` memanggil `clear()`, jadi status pengguna di luar daftar percakapan ikut terhapus. Mitigasi sekarang: `presence:get` di-emit ulang setiap dialog dibuka. | Titik status online di dialog chat baru bisa berkedip kembali ke abu-abu |
| 4 | **Paginasi riwayat tidak dipakai.** Backend mengembalikan `next_cursor`, tapi `getMessages()` membuangnya dan mengambil seluruh riwayat sekaligus. | Room dengan ribuan pesan akan lambat dibuka |

### Prioritas menengah

| # | Item | Dampak |
|---|---|---|
| 5 | **Dependency backend tertinggal di `package.json`** — `pg`, `sequelize`, `pg-hstore`, `argon2`, `next-auth`, `zod`, dan `dotenv` tidak diimpor di mana pun. Folder `migrations/`, `seeders/`, `config/`, dan `models/` juga tidak ada. | `npm install` memasang paket yang tidak dipakai |
| 6 | **Script `"seed: all"` salah nama** — mengandung spasi, sehingga tidak bisa dipanggil lewat `npm run seed:all`. | Script tidak berfungsi |
| 7 | **`.env.example` tidak sesuai** — isinya `DATABASE_URL` dan `AUTH_SECRET` (variabel backend), bukan `NEXT_PUBLIC_API_URL` dan `NEXT_PUBLIC_SOCKET_URL` yang benar-benar dibaca frontend. | Menyesatkan saat *setup* |
| 8 | **Tidak ada penanganan kedaluwarsa sesi** — belum ada refresh token; token yang kedaluwarsa baru ketahuan saat request gagal. | Pengguna terlempar ke login tanpa penjelasan |
| 9 | **Cache pesan tidak dibatasi** — `messagesByRoom` menyimpan pesan setiap room yang pernah dibuka selama sesi, tanpa pembuangan. | Pemakaian memori tumbuh selama sesi panjang |

### Prioritas rendah

| # | Item | Dampak |
|---|---|---|
| 10 | **`DialogContent` tanpa batas tinggi** — `max-w-md p-6` tanpa `max-h` atau `overflow-y-auto`. | Dialog yang lebih tinggi dari viewport tidak bisa digulir. Laten, karena daftar pengguna sekarang dibatasi `max-h-48` |
| 11 | **Posisi pesan error pada composer kurang tepat** — `absolute -mt-12` dipakai di dalam `<form>` yang tidak `relative`, sehingga diposisikan terhadap leluhur berposisi terdekat. | Error tetap terbaca, tapi posisinya bukan yang dimaksud |
| 12 | **`font-mono` disiapkan tapi tidak dipakai** — `Geist_Mono` diunduh dan diikat ke `--font-mono`, tapi tidak ada komponen yang memakainya. | Satu file font terunduh tanpa manfaat |
| 13 | **Pesan sistem & feedback belum seragam** — error tampil inline dan lokal; belum ada mekanisme notifikasi global. | Inkonsistensi kecil pada pengalaman pengguna |

### Yang sengaja tidak dikerjakan

- **Verifikasi kunci publik lawan bicara.** Sekarang kunci publik diterima apa adanya dari server. Untuk mencegah serangan penggantian kunci, dibutuhkan verifikasi di luar jalur (mis. perbandingan sidik jari kunci secara manual). Ini keputusan desain keamanan, bukan sekadar pekerjaan teknis.
- **Pemulihan kunci.** Kalau kunci privat hilang, pesan lama tidak bisa dibaca lagi — tidak ada mekanisme pemulihan. Ini konsekuensi yang melekat pada enkripsi end-to-end dan perlu keputusan produk.

---

## 📌 Catatan Sebelum Production

<details>
<summary><b>Checklist keamanan</b></summary>

- [ ] Wajib **HTTPS** dan **WSS** — tanpa itu Web Crypto tidak aktif
- [ ] Jangan pernah mencatat plaintext pesan atau kunci privat ke log
- [ ] Batasi ukuran ciphertext di backend
- [ ] Konfigurasi CSP dan atribut cookie yang aman
- [ ] Tambahkan refresh token dan penanganan kedaluwarsa sesi
- [ ] Uji pemulihan kunci di perangkat dan browser berbeda
- [ ] Pertimbangkan verifikasi kunci publik lawan bicara

</details>

<details>
<summary><b>Yang dibutuhkan dari backend</b></summary>

- `opponent.public_key` dan `last_message` pada respons daftar percakapan
- `encrypted_private_key` dan `key_derivation_salt` pada `/auth/me`, atau key material tersedia dari perangkat yang dipakai mendaftar
- Envelope pesan yang membungkus kunci AES untuk **pengirim dan penerima**
- CORS dengan credentials aktif bila memakai cookie JWT; bila memakai bearer token, respons login harus mengembalikan `access_token` atau `token`

</details>

<details>
<summary><b>Kompatibilitas pesan lama</b></summary>

Pesan lama yang hanya punya satu `wrapped_key` (untuk penerima) **tidak bisa dibaca oleh pengirimnya sendiri**. Dekoder tetap menerimanya agar pesan lama tetap terbaca oleh penerima. Pesan baru selalu memakai `wrapped_keys.sender` dan `wrapped_keys.recipient`.

</details>

---

<div align="center">
<sub>Dokumen ini menjelaskan tujuan, arsitektur, teknologi, alur data, kontrak API, keamanan, dan batasan implementasi proyek.</sub>
</div>
