# MyMBG Web Dashboard

## 📋 Deskripsi Proyek

Aplikasi web dashboard untuk manajemen dapur MBG - menyediakan interface yang user-friendly untuk tracking produksi, distribusi barang, manajemen resep, pencatatan keuangan, dan monitoring performa dapur. Dibangun dengan Next.js untuk performa optimal dan SEO.

## 🚀 Quick Start

### Prasyarat

- Node.js 18.0 atau lebih baru
- npm atau yarn
- Git
- Backend API harus running (lihat backend README)

### Setup Lokal

1. **Dari root monorepo ini** (`MyMBG-web` sekarang berada di `apps/web/`):

```bash
cd apps/web
```

2. **Install dependencies**

```bash
npm install
```

3. **Konfigurasi environment**

Buat file `.env.local` di root directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:5292
```

4. **Jalankan development server**

```bash
npm run dev
```

Aplikasi akan running di `http://localhost:3000`

5. **Build untuk production**

```bash
npm run build
npm run start
```

## 📦 Teknologi Utama

| Teknologi   | Versi  | Fungsi                |
| ----------- | ------ | --------------------- |
| Next.js     | 16.2+  | React framework & SSR |
| React       | 19+    | UI library            |
| TypeScript  | Latest | Type safety           |
| Zustand     | Latest | State management      |
| TailwindCSS | Latest | Styling               |
| Vercel      | -      | Deployment platform   |

## 🏗️ Arsitektur & Pola Desain

### Struktur Project

```
src/
├── pages/               # Next.js pages
│   ├── api/            # API routes
│   ├── login.tsx
│   ├── dashboard.tsx
│   ├── produksi.tsx
│   ├── distribusi.tsx
│   ├── keuangan.tsx
│   └── resep.tsx
├── components/         # Reusable components
├── lib/
│   └── api/            # API client layer
│       ├── client.ts   # Base API client dengan Bearer token
│       ├── auth.ts
│       ├── crud.ts
│       └── produksi.ts
├── store/              # Zustand state management
│   └── auth-store.ts
├── types/              # Type definitions
└── styles/            # Global styles
```

### Pola Desain

1. **Client-Side State Management**: Zustand untuk auth state
2. **API Client Abstraction**: Centralized API client dengan automatic Bearer token injection
3. **Pages Router**: Traditional page-based routing
4. **Middleware Authentication**: Protected routes dengan redirect
5. **Component Composition**: Reusable components

### Fitur Utama

- **Dashboard**: Overview metrics dapur
- **Manajemen Produksi**: Create/edit sesi produksi dengan resep scaling
- **Manajemen Distribusi**: Track pengiriman produk
- **Pencatatan Keuangan**: Input transaksi
- **Master Data**: CRUD resep, bahan baku
- **User Management**: Admin user management

## 🌐 Deployment

### Production URL

```
https://my-mbg.vercel.app
```

### Deploy ke Vercel

```bash
vercel --prod
```

### Environment Variables untuk Production

```env
NEXT_PUBLIC_API_URL=https://api.mymbg.vercel.app
```

## 🔐 Authentication

- **Bearer Token**: Automatic di semua API requests
- **Token Storage**: localStorage via Zustand (persisted)
- **Protected Routes**: Middleware mengecek token
- **Role-Based Access**: Admin, KepalaDapur, Staff

## 🐛 Troubleshooting

### 401 Unauthorized

- Pastikan login berhasil
- Cek localStorage untuk `mbg-auth` key
- Refresh page

### API Connection Error

- Verifikasi `NEXT_PUBLIC_API_URL` di `.env.local`
- Pastikan backend running

### Build gagal

- Clear `.next`: `rm -rf .next`
- Reinstall: `rm -rf node_modules && npm install`
