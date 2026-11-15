# AYAKA API — Official REST API Platform

![AYAKA API](https://img.shields.io/badge/AYAKA_API-v1.4.2-blue?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-20.x-green?style=for-the-badge&logo=nodedotjs)
![Vercel](https://img.shields.io/badge/Vercel-Serverless-black?style=for-the-badge&logo=vercel)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue?style=for-the-badge&logo=postgresql)

AYAKA API adalah platform penyedia REST API berskala *enterprise* yang dirancang dengan arsitektur modern, cepat, aman, dan ramah pengembang (*Developer-Friendly*). Project ini dibangun menggunakan **Node.js**, **Vercel Serverless Functions**, dan database **PostgreSQL (Neon)**. 

Tampilan antarmuka menggunakan desain **Neo-Brutalism** yang responsif dan interaktif.

---

## ✨ Fitur Utama

- 🔐 **Sistem Autentikasi (Auth)**: Register, Login, dan Logout menggunakan *HTTP-only cookies* yang aman.
- 🔑 **Manajemen API Key**:
  - Generate API Key otomatis dengan prefix `AYK_`.
  - Hashing API Key menggunakan SHA-256 + Pepper (tidak pernah disimpan dalam bentuk *plaintext*).
  - Fitur *Revoke* (Cabut) dan *Regenerate*.
- 🚦 **Rate Limiting & Quota**: Pembatasan request (60 req/menit) dan kuota bulanan yang terhubung langsung ke database.
- 📊 **Developer Dashboard**: Memantau total request, request berhasil/gagal, sisa kuota, dan grafik trafik API.
- 🧪 **Interactive API Explorer**: Playground untuk menguji endpoint API secara langsung dari browser menggunakan API Key asli.
- 📖 **Dokumentasi Lengkap**: Panduan integrasi API dengan contoh *code snippet* (cURL, Fetch, Axios, Python).
- ❤️ **System Status**: Halaman pemantauan *real-time* untuk mengecek kesehatan API Gateway, Database, dan Auth Service.
- 🎨 **Neo-Brutalism UI**: Desain antarmuka modern dengan border tebal, bayangan tegas, dan widget *real-time* (Jam, Tanggal, Baterai, Uptime).

---

## 🛠️ Teknologi yang Digunakan

**Frontend:**
- HTML5, CSS3, JavaScript (Vanilla)
- Tailwind CSS (via CDN)
- Chart.js (untuk grafik)
- Lucide Icons

**Backend & Database:**
- Node.js & Express.js (Vercel Serverless)
- Neon PostgreSQL (Database persisten kompatibel Vercel)
- `@neondatabase/serverless` (Driver koneksi database)
- Crypto (Node.js built-in untuk hashing password & API Key)

---

## 📁 Struktur Folder

```text
ayaka-api/
├── api/                  # Vercel Serverless Functions (Backend API)
│   ├── auth/             # Endpoint Login, Register, Logout
│   ├── keys/             # Endpoint Generate/Revoke API Key
│   ├── v1/               # Endpoint API versi 1 (Users, Health, dll)
│   ├── stats.js          # Endpoint statistik dashboard
│   └── public-stats.js   # Endpoint statistik landing page
├── public/               # Frontend (Static Files)
│   ├── css/              # File CSS kustom
│   ├── js/               # File JavaScript utama (app.js, dashboard.js)
│   └── index.html        # Entry point aplikasi (SPA)
├── src/                  # Kode Backend & Utility
│   ├── database/         # File schema.sql
│   ├── middleware/       # Middleware apiKeyAuth
│   └── utils/            # Utility (db.js, crypto.js, auth.js)
├── package.json
├── vercel.json
├── .env.example
└── README.md