# Azura MUA CRM & Inventory

Monorepo CRM, keuangan, dan inventory untuk bisnis Makeup Artist.

## Stack

- Frontend: Vue 3, Vite, TypeScript, Pinia
- Backend: Hono di Cloudflare Workers
- Database/Auth/Realtime: Supabase
- File storage: Cloudflare R2
- Local file storage: simulasi R2 Wrangler di `.wrangler/state`

## Menjalankan lokal

Prasyarat: Node.js 22 atau lebih baru.

```powershell
npm install
npm run dev
```

Jika PowerShell memblokir `npm.ps1`, gunakan:

```powershell
npm.cmd install
npm.cmd run dev
```

Alamat lokal:

- Frontend: <http://localhost:8080>
- Backend: <http://localhost:8181>
- Health check: <http://localhost:8181/health>

UI berjalan dalam **Mode Demo Lokal** sampai Supabase dikonfigurasi. Data transaksi demo tersimpan di browser dan dapat di-reset dari Pengaturan Sistem. File tidak disimpan di browser: upload masuk ke R2 simulator lokal Wrangler.

## Environment

Salin contoh berikut jika akan menghubungkan Supabase:

```text
apps/web/.env.example       -> apps/web/.env
apps/api/.dev.vars.example  -> apps/api/.dev.vars
```

Secret Supabase hanya boleh berada di Worker. Jangan menaruh `SUPABASE_SECRET_KEY` pada variabel `VITE_*`.

## Supabase

Migration awal berada di `supabase/migrations`. Terapkan lewat Supabase CLI atau SQL editor yang terkontrol. Migration menyediakan tabel relasional, constraint, RLS, view saldo, counter nomor bisnis, audit log, dan publication Realtime.

Untuk membuat type database setelah schema diterapkan:

```powershell
npx supabase gen types typescript --project-id PROJECT_ID > packages/database-types/src/database.ts
```

## R2 lokal dan produksi

`wrangler dev` menggunakan penyimpanan lokal di `apps/api/.wrangler/state`. Kode binding yang sama digunakan di production.

Sebelum deploy buat dua bucket:

```powershell
npx wrangler r2 bucket create azura-mua-public
npx wrangler r2 bucket create azura-mua-private
```

Atur secret Worker production:

```powershell
npx wrangler secret put SUPABASE_URL --env production
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY --env production
npx wrangler secret put SUPABASE_SECRET_KEY --env production
```

Ganti `ALLOWED_ORIGIN` di `apps/api/wrangler.jsonc` dan domain API sebelum deploy.

## Build dan pemeriksaan

```powershell
npm run typecheck
npm run build
```

## Status implementasi

Sudah tersedia:

- Shell dan navigasi seluruh modul dari requirement
- Dashboard, agenda, arus kas, invoice, dan peringatan stok
- Booking dengan Nomor PO otomatis di mode demo
- Pesanan dan additional multi-item yang membuat invoice terpisah
- Katalog inti/additional dengan upload R2 lokal
- Pembayaran bertahap dengan validasi sisa tagihan
- Preview invoice A4 serta cetak/simpan melalui dialog PDF browser
- Wedding Portal: katalog busana Bride/Groom, tiga slot acara, size chart fitting, detail look, seragam keluarga, dan vendor
- Pengeluaran terkait PO/operasional
- Barang masuk/keluar dengan PIC serta validasi stok
- Skema Supabase relasional, RLS, audit, dan Realtime publication
- Worker upload/download/delete untuk public dan private R2

Operasi produksi yang melibatkan banyak tabel selanjutnya harus dihubungkan ke PostgreSQL RPC agar atomik, khususnya pembuatan order+invoice, alokasi pembayaran FIFO, dan transaksi stok multi-item.
"# azura_mua" 
