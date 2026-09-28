<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/assets/logo/white.png">
  <img src="public/assets/logo/dark.png" alt="Akselera Tech" width="320">
</picture>

# Akselera Chat

**Aplikasi chat internal dengan enkripsi end-to-end di sisi klien.**
Server menyimpan ciphertext. Kunci privat tidak pernah meninggalkan perangkat.

[![Express.js](https://img.shields.io/badge/Express.js-4.18.2-000000?logo=express&logoColor=white)](https://expressjs.com)
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
- [Arsitektur](#-arsitektur)
- [Struktur Proyek](#-struktur-proyek)
- [Stack dan Alasan Memilihnya](#-stack-dan-alasan-memilihnya)
- [Keamanan dan Enkripsi](#-keamanan-dan-enkripsi)
- [Alur Utama](#-alur-utama)
- [Kontrak API](#-kontrak-api)
- [Event Socket.IO](#-event-socketio)
- [Menjalankan Secara Lokal](#-menjalankan-secara-lokal)
- [Yang Belum Selesai](#-yang-belum-selesai)
- [Catatan Sebelum Production](#-catatan-sebelum-production)

---

## 🔭 Sekilas

Akselera Chat terdiri dari dua bagian yang saling bergantung dan sengaja dibahas dalam satu README karena kontrak keamanannya menyatu:

| | |
|---|---|
| 🖥️ | **Frontend (Next.js)** — antarmuka, pembuatan key pair, enkripsi/dekripsi pesan di browser |
| 🛠️ | **Backend (Express.js + Socket.IO)** — autentikasi, penyimpanan data terenkripsi, relay pesan realtime |
| 🔒 | **Pesan dienkripsi di frontend sebelum dikirim** — backend hanya menyimpan dan meneruskan ciphertext |
| ⚡ | Satu koneksi Socket.IO menghubungkan keduanya untuk pesan dan status online realtime |
| 🎨 | Antarmuka monokrom dengan mode terang/gelap |

> Skema enkripsinya dirancang lintas lapisan: keputusan di frontend (Web Crypto API, secure context) menentukan syarat wajib di backend (HTTPS, skema penyimpanan wrapped key), dan sebaliknya kontrak Socket.IO di backend menentukan bagaimana frontend harus menangani reconnect. Membaca salah satu sisi saja akan membuat sebagian keputusan desain terlihat sewenang-wenang.

---

## ✨ Fitur

<details open>
<summary><b>Autentikasi</b></summary>

- Register dengan nama, email, dan password
- **Frontend**: membuat key pair RSA-OAEP 4096-bit saat register, kunci privat dienkripsi dengan password lalu disimpan di IndexedDB
- **Backend**: password di-hash dengan Argon2id, kunci publik RSA disimpan di database
- Login lewat `/auth/login` → backend menerbitkan JWT → frontend redirect otomatis ke `/chat`
- Logout menghapus kunci dari memori dan IndexedDB di sisi frontend

</details>

<details open>
<summary><b>Percakapan</b></summary>

- Daftar percakapan beserta unread count
- Pencarian percakapan secara lokal di frontend (tanpa request tambahan)
- Membuat percakapan baru lewat dialog, dengan pencarian pengguna via `/users`
- Hapus percakapan dan tandai sudah dibaca
- Percakapan dengan pesan terbaru naik ke posisi teratas secara realtime lewat event `conversation:updated`
- Status online / "terakhir dilihat" per lawan bicara

</details>

<details open>
<summary><b>Pesan</b></summary>

- **Frontend**: mengenkripsi pesan (AES-GCM + wrapped key RSA-OAEP) sebelum dikirim, mendekripsi pesan masuk
- **Backend**: menyimpan ciphertext dan wrapped key apa adanya, tidak pernah mendekripsi
- Riwayat pesan per percakapan dengan pagination
- Gelembung pesan berbeda posisi dan warna untuk pengirim dan penerima
- Pemisah tanggal: `Hari ini`, `Kemarin`, atau tanggal lengkap
- Pesan baru masuk realtime lewat event `message:new`, tanpa reload

</details>

---

## 🏗 Arsitektur

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/assets/images/architecture-white.jpeg">
  <img src="public/assets/images/architecture-white.jpeg" alt="Akselera Tech">
</picture>

> **Plaintext tidak pernah melewati garis HTTPS/WSS di atas**. Yang melewatinya hanya ciphertext, wrapped key, dan kunci publik.

---


## 🏗 Diagram

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/assets/images/erd.png">
  <img src="public/assets/images/erd.png" alt="Akselera Tech">
</picture>

## Database Schema & Data Flow

Database menggunakan PostgreSQL dengan empat tabel utama: `users`, `conversations`, `conversation_members`, dan `messages`.

### 1. User

Tabel `users` menyimpan informasi akun pengguna dan data yang berkaitan dengan autentikasi serta encryption key.

- `id` — UUID sebagai primary key.
- `name` dan `email` — identitas pengguna.
- `password_hash` — password yang telah di-hash dan tidak menyimpan password asli.
- `public_key` — public key pengguna yang digunakan untuk proses enkripsi pesan.
- `encrypted_private_key` — private key yang disimpan dalam bentuk terenkripsi.
- `key_derivation_salt` — salt yang digunakan dalam proses derivasi key.
- `last_seen_at` — waktu terakhir pengguna aktif.
- `deleted_at` — digunakan untuk soft delete akun.

### 2. Conversation

Tabel `conversations` merepresentasikan sebuah ruang percakapan.

Untuk percakapan 1-on-1, satu conversation akan memiliki dua anggota yang dihubungkan melalui tabel `conversation_members`.

### 3. Conversation Members

Tabel `conversation_members` merupakan tabel penghubung antara `users` dan `conversations`.

Satu user dapat memiliki banyak conversation, dan satu conversation dapat memiliki beberapa member. Pada aplikasi ini, conversation digunakan untuk chat 1-on-1 sehingga setiap conversation memiliki dua member.

Kolom penting:

- `conversation_id` — referensi ke conversation.
- `user_id` — referensi ke user.
- `last_read_at` — menyimpan waktu terakhir user membaca conversation, yang digunakan untuk menghitung unread message.
- `(conversation_id, user_id)` memiliki unique constraint untuk mencegah user yang sama masuk dua kali ke conversation yang sama.

### 4. Messages

Tabel `messages` menyimpan pesan yang dikirim dalam sebuah conversation.

Setiap message memiliki:

- `conversation_id` — conversation tempat pesan berada.
- `sender_id` — user yang mengirim pesan.
- `ciphertext` — isi pesan yang telah dienkripsi.
- `iv` — initialization vector yang digunakan dalam enkripsi.
- `auth_tag` — authentication tag untuk verifikasi integritas ciphertext.
- `created_at` — waktu pesan dibuat.

Isi pesan tidak disimpan sebagai plaintext. Database hanya menyimpan data ciphertext dan parameter kriptografi yang diperlukan.

---

## Relationship Summary

| Relationship | Keterangan |
|---|---|
| `users` → `conversation_members` | Satu user dapat menjadi member di banyak conversation |
| `conversations` → `conversation_members` | Satu conversation memiliki member |
| `conversations` → `messages` | Satu conversation memiliki banyak message |
| `users` → `messages` | Satu user dapat mengirim banyak message |
| `conversation_members.last_read_at` | Menyimpan posisi terakhir user membaca conversation |

Dengan struktur ini, **`conversations` menjadi parent dari chat, `conversation_members` menentukan siapa yang memiliki akses ke chat, dan `messages` menyimpan seluruh pesan dalam conversation tersebut.**

---

## 🧱 Stack dan Alasan Memilihnya

### Ringkasan

| Lapisan | Pilihan | Alasan utama |
|---|---|---|
| Frontend — Framework | **Next.js** (App Router) | Routing dan bundling siap pakai; halaman chat & auth ditandai `"use client"` karena seluruhnya interaktif |
| Frontend — Bahasa | **TypeScript** (strict) | Kontrak data dipakai lintas lapisan; kesalahan bentuk data tertangkap saat compile |
| Frontend — Styling | **Tailwind CSS** | Token tema di CSS, mode gelap cukup menukar nilai variabel |
| Frontend — Kriptografi | **Web Crypto API** (native) | Tidak menambah bundle, tidak perlu mengaudit library kripto pihak ketiga |
| Frontend — Realtime client | **socket.io-client** | Reconnect otomatis, protokolnya sudah disepakati dengan backend |
| Backend — Framework | **Express.js** | Minim dan cukup untuk REST API, hidup berdampingan dengan Socket.IO di HTTP server yang sama |
| Backend — Realtime server | **Socket.IO** | Reconnect otomatis dan semantik room bawaan — persis yang dibutuhkan untuk broadcast per percakapan |
| Backend — Database | **PostgreSQL** | Relasi antar pengguna, percakapan, dan pesan butuh transaksi yang konsisten |
| Backend — Cache & Adapter | **Redis** | Adapter Socket.IO untuk *scaling* horizontal, plus cache status online |
| Backend — Hashing Password | **Argon2id** | Tahan terhadap serangan GPU/ASIC lebih baik dari bcrypt |
| Backend — Autentikasi | **JWT** | Stateless, cocok untuk banyak instance server di belakang load balancer |
| Backend — Validasi Skema | **Zod** | Kontrak request/response tervalidasi di runtime |

### Alasan yang lebih detail

<details>
<summary><b>Kenapa Next.js App Router (frontend)</b></summary>

Proyek ini butuh routing dan titik masuk client tanpa menulis server terpisah untuk frontend. Karena ini proyek baru, konvensi App Router bisa dipakai langsung tanpa migrasi kode lama.

Praktiknya: halaman chat dan autentikasi ditandai `"use client"` karena seluruhnya interaktif (perlu akses `crypto.subtle` dan IndexedDB), sementara `app/layout.tsx` tetap server component untuk metadata dan pemuatan font.

**Ini yang menghubungkan ke backend:** karena logika enkripsi berjalan penuh di browser, backend didesain sejak awal untuk tidak pernah menerima atau memproses plaintext — pembagian tanggung jawab ini baru masuk akal kalau frontend dan backend dibaca sebagai satu sistem.

</details>

<details>
<summary><b>Kenapa Web Crypto API di frontend, bukan library kripto</b></summary>

`crypto.subtle` sudah menyediakan RSA-OAEP dan AES-GCM secara native di browser. Memilih ini berarti nol byte tambahan pada bundle untuk fungsionalitas kripto, dan tidak ada library pihak ketiga yang perlu diaudit.

**Trade-off yang disadari:** `SubtleCrypto` hanya tersedia di *secure context*. Artinya frontend **tidak bisa berjalan di HTTP biasa** selain `localhost` — dan ini merambat langsung ke backend: **backend wajib disajikan lewat HTTPS di production**, karena kalau tidak, frontend gagal mengenkripsi apa pun sejak awal dan tidak ada request valid yang bisa sampai ke backend.

</details>

<details>
<summary><b>Kenapa envelope encryption RSA + AES, dan apa peran backend di dalamnya</b></summary>

RSA-OAEP hanya praktis untuk payload kecil, sementara pesan bisa panjang. Jadi setiap pesan memakai pola **envelope encryption**, dikerjakan sepenuhnya oleh frontend:

1. Frontend membuat kunci AES-GCM 256-bit sekali pakai untuk pesan itu
2. Frontend mengenkripsi pesan dengan kunci AES tersebut
3. Frontend membungkus kunci AES dengan RSA-OAEP milik penerima **dan** milik pengirim sendiri

**Kunci AES dibungkus dua kali** — tanpa pembungkusan untuk pengirim, pengirim tidak akan bisa membaca pesannya sendiri setelah reload, karena kunci AES sekali pakai itu tidak disimpan di mana pun oleh frontend.

Peran backend di alur ini murni pasif: menerima ciphertext + dua wrapped key lewat `POST /messages`, menyimpannya apa adanya di PostgreSQL, lalu meneruskannya lagi lewat `message:new` tanpa pernah membukanya.

</details>

<details>
<summary><b>Kenapa Socket.IO dipakai di kedua sisi</b></summary>

WebSocket mentah tidak punya reconnect otomatis, dan SSE tidak mendukung pengiriman dua arah. Socket.IO memberi keduanya plus semantik room — satu socket menerima `message:new` untuk room percakapan yang sedang dibuka, dan `conversation:updated` untuk memperbarui sidebar.

**Ini harus dipakai konsisten di kedua sisi**, karena reconnect otomatis di sisi frontend berarti `conversation:join` harus di-emit ulang setiap kali event `connect` menyala, dan backend harus menaruh socket itu kembali ke room yang benar — kontrak ini hanya berfungsi kalau kedua sisi sepakat pada urutan event yang sama.

</details>

<details>
<summary><b>Kenapa IndexedDB di frontend, Argon2id di backend</b></summary>

Objek `CryptoKey` di frontend **tidak bisa diserialisasi ke JSON**, jadi `localStorage` tidak bisa menyimpannya — IndexedDB bisa, karena memakai *structured clone*. Ini yang memungkinkan pengguna me-refresh halaman tanpa memasukkan password lagi.

Di sisi lain, password itu sendiri dikirim sebagai plaintext lewat HTTPS ke backend, karena hanya backend yang boleh memverifikasinya. Backend meng-hash-nya dengan Argon2id sebelum disimpan — frontend tidak pernah menyimpan password dalam bentuk apa pun, hanya kunci privat yang sudah dienkripsi dengan password tersebut.

</details>

---

## 🔐 Keamanan dan Enkripsi

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/assets/images/encryption.png">
  <img src="public/assets/images/encryption.png" alt="Akselera Tech">
</picture>

---

## 📋 Ringkasan pembagian tanggung jawab kriptografi antara kedua sisi:

| Operasi | Dilakukan di | Keterangan |
|---|---|---|
| Generate key pair RSA-OAEP 4096-bit | Frontend | Saat register, sekali per pengguna |
| Enkripsi kunci privat dengan password | Frontend | Sebelum disimpan ke IndexedDB |
| Hash password (Argon2id) | Backend | Password mentah dikirim lewat HTTPS, hanya untuk verifikasi |
| Generate kunci AES-GCM per pesan | Frontend | Sekali pakai, tidak pernah disimpan |
| Enkripsi isi pesan | Frontend | Dengan kunci AES di atas |
| Bungkus kunci AES (RSA-OAEP) | Frontend | Dua kali: untuk penerima dan pengirim |
| Simpan ciphertext + wrapped key | Backend | Apa adanya, tanpa diproses |
| Distribusi kunci publik | Backend | Lewat `/users/:id/public-key` |
| Dekripsi pesan | Frontend | Dengan kunci privat milik penerima |

> **Konsekuensinya:** kalau database backend bocor, isi pesan tetap tidak terbaca tanpa kunci privat pengguna — yang tidak pernah meninggalkan browser dalam bentuk yang tidak terenkripsi. Sebaliknya, ini juga berarti **backend tidak bisa melakukan moderasi konten** atau membantu memulihkan pesan kalau pengguna kehilangan kunci privatnya — ini trade-off yang disengaja, bukan celah yang belum diperbaiki.

---

## 🔄 Alur Utama

1. Pengguna register di **frontend** → key pair RSA dibuat di browser → kunci publik dikirim ke **backend**, kunci privat (terenkripsi password) disimpan di IndexedDB
2. Pengguna login → **backend** memverifikasi password dengan Argon2id → menerbitkan JWT
3. **Frontend** membuka koneksi Socket.IO, JWT dikirim saat handshake
4. Frontend mengambil kunci publik lawan bicara lewat `/users/:id/public-key`
5. Frontend mengenkripsi pesan (AES-GCM + dua wrapped key), lalu `POST /messages`
6. **Backend** menyimpan pesan, meng-update unread count, broadcast `message:new` dan `conversation:updated` ke room terkait
7. Frontend penerima menerima event lewat socket, mendekripsi pesan secara lokal dengan kunci privatnya

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
| `conversation:join` | Frontend → Backend | Bergabung ke room sebuah percakapan |
| `conversation:leave` | Frontend → Backend | Keluar dari room percakapan |
| `message:new` | Backend → Frontend | Pesan baru masuk ke percakapan yang sedang dibuka |
| `conversation:updated` | Backend → Frontend | Ada aktivitas baru di sebuah percakapan (untuk update sidebar) |
| `presence:online` | Backend → Frontend | Lawan bicara berubah status online/offline |

---

## 🚀 Menjalankan Secara Lokal

### 1. Clone repositori Backend

```bash
git clone https://github.com/rayhanzz772/akselera-chat-fe.git
cd akselera-chat-be
```

### 2. Jalankan Backend

```bash
npm install
cp .env.example .env
```

```env
PORT=8000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/akselera_chat
REDIS_URL=redis://localhost:6379
JWT_SECRET=ganti_dengan_secret_yang_kuat
JWT_EXPIRES_IN=1d
```

```bash
npm run migrate
npm run dev
```

Backend berjalan di `http://localhost:8000`, Socket.IO menempel di path yang sama.

### 3. Clone repository Frontend

```bash
git clone https://github.com/rayhanzz772/akselera-chat-fe.git
cd akselera-chat-fe
```

### 4. Jalankan Frontend

```bash
npm install
cp .env.example .env
```

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
```

```bash
npm run dev
```

Frontend berjalan di `http://localhost:3000`. Karena keduanya di `localhost`, `SubtleCrypto` tetap berfungsi tanpa HTTPS untuk kebutuhan development.

---

## 🚧 Yang Belum Selesai

- Penghapusan pesan (soft delete) belum diimplementasi di backend
- Belum ada mekanisme rotasi kunci RSA bila pengguna kehilangan kunci privat (frontend belum punya alur pemulihan)
- Rate limiting baru diterapkan di endpoint login, belum di endpoint pengiriman pesan
- Frontend belum menampilkan indikator "sedang mengetik"
- Belum ada indikator notifications

---

## ⚠️ Catatan Sebelum Production

- **Wajib HTTPS untuk keduanya** — tanpa ini, `SubtleCrypto` di frontend tidak berfungsi, dan tidak ada request valid yang bisa sampai ke backend
- Pastikan `JWT_SECRET` diganti dan tidak pernah di-commit ke repository
- `NEXT_PUBLIC_API_URL` dan `NEXT_PUBLIC_SOCKET_URL` harus dipointing ke domain HTTPS yang sama dengan sertifikat valid
- Redis adapter perlu dikonfigurasi bila backend dijalankan lebih dari satu instance
- Backup database di sisi backend tetap terenkripsi — kehilangan kunci privat di sisi frontend berarti kehilangan akses ke pesan lama secara permanen, backup tidak bisa menolong ini