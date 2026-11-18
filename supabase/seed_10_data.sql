-- =============================================================================
-- SEED DATA DUMMY LENGKAP (MASING-MASING 10 RECORD PER TAB) — AZURA MAKEUP ARTIST
-- Jalankan langsung di Supabase SQL Editor (aman dijalankan ulang / idempoten)
-- Catatan: Memakai kode/nomor mulai seri -0101 s/d -0110 agar tidak bentrok dengan data yang sudah ada.
-- =============================================================================

-- 0. SINKRONISASI KOLOM & CONSTRAINT TAMBAHAN (AMAN UNTUK DB EXISTING)
alter table public.pengaturan_dropdown drop constraint if exists pengaturan_dropdown_option_group_check;
alter table public.pengaturan_dropdown add constraint pengaturan_dropdown_option_group_check
  check (option_group in ('paymentMethods', 'poExpenseCategories', 'generalExpenseCategories', 'stylingTypes', 'inventoryCategories', 'units'));

alter table public.pengeluaran add column if not exists source text not null default 'Manual';
alter table public.pengeluaran add column if not exists refund_id uuid references public.data_pelanggan_refund(id) on delete set null;
alter table public.inventaris_barang add column if not exists image_url text;

insert into public.pengaturan_dropdown (option_group, label, sort_order) values
  ('stylingTypes', 'Hairdo', 1),
  ('stylingTypes', 'Hijabdo', 2),
  ('stylingTypes', 'Paes Adat', 3),
  ('inventoryCategories', 'Complexion', 1),
  ('inventoryCategories', 'Finishing', 2),
  ('inventoryCategories', 'Eye & Lashes', 3),
  ('inventoryCategories', 'Skin Prep', 4),
  ('inventoryCategories', 'Tools & Brushes', 5),
  ('inventoryCategories', 'Hair Styling', 6),
  ('inventoryCategories', 'Hijab & Veil', 7),
  ('units', 'paket', 1),
  ('units', 'orang', 2),
  ('units', 'sesi', 3),
  ('units', 'set', 4),
  ('units', 'botol', 5),
  ('units', 'jar', 6),
  ('units', 'pcs', 7),
  ('units', 'pasang', 8),
  ('units', 'kotak', 9),
  ('units', 'pack', 10)
on conflict (option_group, label) do nothing;

-- 1. 10 KARYAWAN (pengaturan_karyawan)
insert into public.pengaturan_karyawan (id, name, role, phone, email, active, last_login_label) values
  ('10000000-0000-4000-8100-000000000001', 'Aura Rahma', 'Pemilik & Lead MUA', '0812 9000 2026', 'aura@azuramakeup.id', true, 'Hari ini'),
  ('10000000-0000-4000-8100-000000000002', 'Nisa Amalia', 'Finance & Admin', '0812 8811 2201', 'nisa@azuramakeup.id', true, 'Hari ini'),
  ('10000000-0000-4000-8100-000000000003', 'Rani Putri', 'Wardrobe & Inventaris', '0813 7711 9022', 'rani@azuramakeup.id', true, 'Kemarin'),
  ('10000000-0000-4000-8100-000000000004', 'Sinta Dewi', 'MUA & Hairdo', '0857 2241 8810', 'sinta@azuramakeup.id', true, '2 hari lalu'),
  ('10000000-0000-4000-8100-000000000005', 'Dina Kartika', 'Hijabdo Stylist', '0821 6640 3190', 'dina@azuramakeup.id', true, 'Kemarin'),
  ('10000000-0000-4000-8100-000000000006', 'Maya Lestari', 'MUA Pendamping', '0819 3300 4412', 'maya@azuramakeup.id', true, '3 hari lalu'),
  ('10000000-0000-4000-8100-000000000007', 'Raka Pratama', 'Asisten Groom & Beskap', '0856 9120 7731', 'raka@azuramakeup.id', true, 'Hari ini'),
  ('10000000-0000-4000-8100-000000000008', 'Citra Anggraini', 'Hairdo & Sanggul Jawa', '0812 4490 5511', 'citra@azuramakeup.id', true, '4 hari lalu'),
  ('10000000-0000-4000-8100-000000000009', 'Nadia Larasati', 'Asisten Domas & Keluarga', '0813 5580 1122', 'nadia@azuramakeup.id', true, '5 hari lalu'),
  ('10000000-0000-4000-8100-000000000010', 'Tasya Maharani', 'MUA Wisuda & Event', '0822 7100 8844', 'tasya@azuramakeup.id', true, 'Hari ini')
on conflict (id) do nothing;

-- 2. 10 KATALOG JASA (katalog_jasa: 5 Inti + 5 Additional)
insert into public.katalog_jasa (id, catalog_code, name, type, description, catalog_price, unit, is_active) values
  ('10000000-0000-4000-8200-000000000001', 'CAT-0101', 'Makeup Akad & Resepsi Pengantin', 'core', 'Paket rias pengantin wanita lengkap akad hingga resepsi termasuk retouch.', 6500000, 'paket', true),
  ('10000000-0000-4000-8200-000000000002', 'CAT-0102', 'Makeup Wedding Adat Jawa Lengkap', 'core', 'Rias pengantin adat Jawa beserta paes, busana, dan aksesoris utama.', 9500000, 'paket', true),
  ('10000000-0000-4000-8200-000000000003', 'CAT-0103', 'Makeup Lamaran / Tunangan', 'core', 'Rias flawless natural untuk acara lamaran keluarga.', 2500000, 'paket', true),
  ('10000000-0000-4000-8200-000000000004', 'CAT-0104', 'Paket Siraman & Pengajian', 'core', 'Rias pengantin untuk rangkaian pengajian dan siraman pra-nikah.', 3500000, 'paket', true),
  ('10000000-0000-4000-8200-000000000005', 'CAT-0105', 'Makeup Prewedding Outdoor', 'core', 'Rias tahan lama untuk sesi foto prewedding full day.', 3000000, 'paket', true),
  ('10000000-0000-4000-8200-000000000006', 'CAT-0106', 'Makeup Ibu Pengantin & Besan', 'additional', 'Rias ibu pengantin atau besan termasuk penataan hijab/sanggul.', 750000, 'orang', true),
  ('10000000-0000-4000-8200-000000000007', 'CAT-0107', 'Makeup Pagar Ayu / Bridesmaid', 'additional', 'Rias seragam bridesmaid atau penerima tamu.', 450000, 'orang', true),
  ('10000000-0000-4000-8200-000000000008', 'CAT-0108', 'Ganti Look & Busana Resepsi', 'additional', 'Tambahan sesi ganti rias dan busana malam.', 1500000, 'sesi', true),
  ('10000000-0000-4000-8200-000000000009', 'CAT-0109', 'Sewa Melati Segar Pengantin', 'additional', 'Rangkaian melati segar asli untuk akad & adat.', 850000, 'set', true),
  ('10000000-0000-4000-8200-000000000010', 'CAT-0110', 'Hairdo / Hijabdo Styling Tambahan', 'additional', 'Penataan rambut modern atau hijab styling khusus.', 400000, 'orang', true)
on conflict (id) do nothing;

-- 3. 10 BUSANA PORTAL PERNIKAHAN (portal_pernikahan_busana)
insert into public.portal_pernikahan_busana (id, attire_code, name, category, size, status, image_url, notes, is_active) values
  ('10000000-0000-4000-8300-000000000001', 'BTR-0101', 'Kebaya Sekar Arum Putih', 'bride', 'M', 'available', '/attire/bride-kebaya-putih.jpg', 'Payet mutiara full akad', true),
  ('10000000-0000-4000-8300-000000000002', 'BTR-0102', 'Kebaya Ayu Ratih Champagne', 'bride', 'L', 'available', '/attire/bride-kebaya-champagne.jpg', 'Ekor 1.5 meter resepsi', true),
  ('10000000-0000-4000-8300-000000000003', 'BTR-0103', 'Kebaya Paes Ageng Velvet Hitam', 'bride', 'S', 'available', '/attire/bride-paes-velvet.svg', 'Adat Jawa klasik', true),
  ('10000000-0000-4000-8300-000000000004', 'BTR-0104', 'Gaun Silk Sage Emerald', 'bride', 'M', 'laundry', '/attire/bride-gaun-sage.svg', 'Sedang dry cleaning', true),
  ('10000000-0000-4000-8300-000000000005', 'BTR-0105', 'Kebaya Sunda Siger Broken White', 'bride', 'M', 'available', '/attire/bride-sunda-siger.svg', 'Cocok untuk akad pagi', true),
  ('10000000-0000-4000-8300-000000000006', 'BTR-0106', 'Beskap Gading Payet Gold', 'groom', 'L', 'available', '/attire/groom-beskap-gold.svg', 'Set lengkap selop & blangkon', true),
  ('10000000-0000-4000-8300-000000000007', 'BTR-0107', 'Beskap Surjan Navy Klasik', 'groom', 'XL', 'available', '/attire/groom-beskap-navy.jpg', 'Kain jarik parang', true),
  ('10000000-0000-4000-8300-000000000008', 'BTR-0108', 'Beskap Bludru Hitam Gold', 'groom', 'M', 'available', '/attire/groom-beskap-hitam.svg', 'Pasangan Paes Ageng', true),
  ('10000000-0000-4000-8300-000000000009', 'BTR-0109', 'Jas Wool Charcoal Modern', 'groom', 'L', 'laundry', '/attire/groom-jas-charcoal.svg', 'Perlu steam ulang', true),
  ('10000000-0000-4000-8300-000000000010', 'BTR-0110', 'Beskap Sunda Putih Mutiara', 'groom', 'L', 'available', '/attire/groom-beskap-putih.svg', 'Pasangan Sunda Siger', true)
on conflict (id) do update set image_url = coalesce(portal_pernikahan_busana.image_url, excluded.image_url);

-- 4. 10 DATA PELANGGAN (data_pelanggan)
insert into public.data_pelanggan (id, name, phone, notes) values
  ('10000000-0000-4000-8400-000000000001', 'Nadya Prameswari', '081280001101', 'Acara pagi The Langham'),
  ('10000000-0000-4000-8400-000000000002', 'Alya Rahman', '081380002202', 'Resepsi sore Bandung'),
  ('10000000-0000-4000-8400-000000000003', 'Clarissa Wijaya', '085780003303', 'Adat Jawa lengkap'),
  ('10000000-0000-4000-8400-000000000004', 'Sabrina Kusuma', '082180004404', 'Akad + Resepsi 1 hari'),
  ('10000000-0000-4000-8400-000000000005', 'Nabila Azzahra', '081980005505', 'Lamaran keluarga'),
  ('10000000-0000-4000-8400-000000000006', 'Putri Anggraini', '081291116606', 'Sunda Siger'),
  ('10000000-0000-4000-8400-000000000007', 'Keisha Putri', '081392227707', 'Prewedding indoor + outdoor'),
  ('10000000-0000-4000-8400-000000000008', 'Dinda Permata', '085693338808', 'Acara Desember'),
  ('10000000-0000-4000-8400-000000000009', 'Fathia Nurul', '082294449909', 'Sudah selesai acara'),
  ('10000000-0000-4000-8400-000000000010', 'Rania Salsabila', '081895550010', 'Jadwal bulan depan')
on conflict (id) do nothing;

-- 5. 10 BOOKING / PO CUSTOMER (data_pelanggan_booking)
insert into public.data_pelanggan_booking (id, po_number, customer_id, event_location, event_date, event_time, styling_type, notes, status, cancelled_paid_amount) values
  ('10000000-0000-4000-8500-000000000001', 'PO-2026-0101', '10000000-0000-4000-8400-000000000001', 'The Langham Jakarta', '2026-11-22', '05:00', 'Hijabdo', 'Standby 04.00 WIB', 'confirmed', 0),
  ('10000000-0000-4000-8500-000000000002', 'PO-2026-0102', '10000000-0000-4000-8400-000000000002', 'Gedung Sate Ballroom Bandung', '2026-11-25', '06:00', 'Hairdo', 'Paket full day', 'confirmed', 0),
  ('10000000-0000-4000-8500-000000000003', 'PO-2026-0103', '10000000-0000-4000-8400-000000000003', 'Plataran Menteng Jakarta', '2026-11-28', '04:30', 'Hairdo', 'Paes Ageng + 2 besan', 'confirmed', 0),
  ('10000000-0000-4000-8500-000000000004', 'PO-2026-0104', '10000000-0000-4000-8400-000000000004', 'Hotel Mulia Senayan', '2026-12-03', '05:30', 'Hijabdo', 'Akad + Resepsi malam', 'confirmed', 0),
  ('10000000-0000-4000-8500-000000000005', 'PO-2026-0105', '10000000-0000-4000-8400-000000000005', 'Rumah Mempelai Kemang', '2026-12-06', '07:00', 'Hijabdo', 'Lamaran intimate', 'draft', 0),
  ('10000000-0000-4000-8500-000000000006', 'PO-2026-0106', '10000000-0000-4000-8400-000000000006', 'Taman Kajoe Jakarta Selatan', '2026-12-10', '05:00', 'Hijabdo', 'Sunda Siger modern', 'confirmed', 0),
  ('10000000-0000-4000-8500-000000000007', 'PO-2026-0107', '10000000-0000-4000-8400-000000000007', 'Kota Tua & Studio Kemang', '2026-12-14', '07:30', 'Hairdo', 'Prewedding 2 look', 'draft', 0),
  ('10000000-0000-4000-8500-000000000008', 'PO-2026-0108', '10000000-0000-4000-8400-000000000008', 'Balai Samudra Kelapa Gading', '2026-12-19', '05:00', 'Hijabdo', 'Resepsi 800 tamu', 'confirmed', 0),
  ('10000000-0000-4000-8500-000000000009', 'PO-2026-0109', '10000000-0000-4000-8400-000000000009', 'Glass House Ritz-Carlton', '2026-11-10', '06:00', 'Hijabdo', 'Acara selesai lunas', 'completed', 0),
  ('10000000-0000-4000-8500-000000000010', 'PO-2026-0110', '10000000-0000-4000-8400-000000000010', 'Bidarkara Pancoran Jakarta', '2026-12-27', '05:30', 'Hairdo', 'Menunggu jadwal fitting', 'confirmed', 0)
on conflict (id) do nothing;

-- 6. 10 PESANAN + DETAIL PESANAN (pesanan & pesanan_detail)
insert into public.pesanan (id, booking_id, type, order_date, notes) values
  ('10000000-0000-4000-8600-000000000001', '10000000-0000-4000-8500-000000000001', 'initial', '2026-11-01', 'Pesanan awal PO-2026-0101'),
  ('10000000-0000-4000-8600-000000000002', '10000000-0000-4000-8500-000000000002', 'initial', '2026-11-02', 'Pesanan awal PO-2026-0102'),
  ('10000000-0000-4000-8600-000000000003', '10000000-0000-4000-8500-000000000003', 'initial', '2026-11-03', 'Pesanan awal PO-2026-0103'),
  ('10000000-0000-4000-8600-000000000004', '10000000-0000-4000-8500-000000000004', 'initial', '2026-11-04', 'Pesanan awal PO-2026-0104'),
  ('10000000-0000-4000-8600-000000000005', '10000000-0000-4000-8500-000000000005', 'initial', '2026-11-05', 'Pesanan awal PO-2026-0105'),
  ('10000000-0000-4000-8600-000000000006', '10000000-0000-4000-8500-000000000006', 'initial', '2026-11-06', 'Pesanan awal PO-2026-0106'),
  ('10000000-0000-4000-8600-000000000007', '10000000-0000-4000-8500-000000000007', 'initial', '2026-11-07', 'Pesanan awal PO-2026-0107'),
  ('10000000-0000-4000-8600-000000000008', '10000000-0000-4000-8500-000000000008', 'initial', '2026-11-08', 'Pesanan awal PO-2026-0108'),
  ('10000000-0000-4000-8600-000000000009', '10000000-0000-4000-8500-000000000009', 'initial', '2026-10-20', 'Pesanan awal PO-2026-0109'),
  ('10000000-0000-4000-8600-000000000010', '10000000-0000-4000-8500-000000000010', 'initial', '2026-11-10', 'Pesanan awal PO-2026-0110')
on conflict (id) do nothing;

insert into public.pesanan_detail (id, order_id, catalog_item_id, service_name_snapshot, catalog_price_snapshot, customer_price, quantity, unit_snapshot) values
  ('10000000-0000-4000-8610-000000000001', '10000000-0000-4000-8600-000000000001', '10000000-0000-4000-8200-000000000001', 'Makeup Akad & Resepsi Pengantin', 6500000, 6500000, 1, 'paket'),
  ('10000000-0000-4000-8610-000000000011', '10000000-0000-4000-8600-000000000001', '10000000-0000-4000-8200-000000000006', 'Makeup Ibu Pengantin & Besan', 750000, 750000, 2, 'orang'),
  ('10000000-0000-4000-8610-000000000002', '10000000-0000-4000-8600-000000000002', '10000000-0000-4000-8200-000000000001', 'Makeup Akad & Resepsi Pengantin', 6500000, 6500000, 1, 'paket'),
  ('10000000-0000-4000-8610-000000000003', '10000000-0000-4000-8600-000000000003', '10000000-0000-4000-8200-000000000002', 'Makeup Wedding Adat Jawa Lengkap', 9500000, 9500000, 1, 'paket'),
  ('10000000-0000-4000-8610-000000000004', '10000000-0000-4000-8600-000000000004', '10000000-0000-4000-8200-000000000001', 'Makeup Akad & Resepsi Pengantin', 6500000, 6500000, 1, 'paket'),
  ('10000000-0000-4000-8610-000000000005', '10000000-0000-4000-8600-000000000005', '10000000-0000-4000-8200-000000000003', 'Makeup Lamaran / Tunangan', 2500000, 2500000, 1, 'paket'),
  ('10000000-0000-4000-8610-000000000006', '10000000-0000-4000-8600-000000000006', '10000000-0000-4000-8200-000000000001', 'Makeup Akad & Resepsi Pengantin', 6500000, 6200000, 1, 'paket'),
  ('10000000-0000-4000-8610-000000000007', '10000000-0000-4000-8600-000000000007', '10000000-0000-4000-8200-000000000005', 'Makeup Prewedding Outdoor', 3000000, 3000000, 1, 'paket'),
  ('10000000-0000-4000-8610-000000000008', '10000000-0000-4000-8600-000000000008', '10000000-0000-4000-8200-000000000002', 'Makeup Wedding Adat Jawa Lengkap', 9500000, 9500000, 1, 'paket'),
  ('10000000-0000-4000-8610-000000000009', '10000000-0000-4000-8600-000000000009', '10000000-0000-4000-8200-000000000004', 'Paket Siraman & Pengajian', 3500000, 3500000, 1, 'paket'),
  ('10000000-0000-4000-8610-000000000010', '10000000-0000-4000-8600-000000000010', '10000000-0000-4000-8200-000000000001', 'Makeup Akad & Resepsi Pengantin', 6500000, 6500000, 1, 'paket')
on conflict (id) do nothing;

-- 7. 10 FAKTUR TAGIHAN & DETAIL FAKTUR (faktur_tagihan & faktur_tagihan_detail)
insert into public.faktur_tagihan (id, invoice_number, booking_id, order_id, invoice_date, due_date) values
  ('10000000-0000-4000-8700-000000000001', 'INV-2026-0101', '10000000-0000-4000-8500-000000000001', '10000000-0000-4000-8600-000000000001', '2026-11-01', '2026-11-20'),
  ('10000000-0000-4000-8700-000000000002', 'INV-2026-0102', '10000000-0000-4000-8500-000000000002', '10000000-0000-4000-8600-000000000002', '2026-11-02', '2026-11-23'),
  ('10000000-0000-4000-8700-000000000003', 'INV-2026-0103', '10000000-0000-4000-8500-000000000003', '10000000-0000-4000-8600-000000000003', '2026-11-03', '2026-11-26'),
  ('10000000-0000-4000-8700-000000000004', 'INV-2026-0104', '10000000-0000-4000-8500-000000000004', '10000000-0000-4000-8600-000000000004', '2026-11-04', '2026-12-01'),
  ('10000000-0000-4000-8700-000000000005', 'INV-2026-0105', '10000000-0000-4000-8500-000000000005', '10000000-0000-4000-8600-000000000005', '2026-11-05', '2026-12-04'),
  ('10000000-0000-4000-8700-000000000006', 'INV-2026-0106', '10000000-0000-4000-8500-000000000006', '10000000-0000-4000-8600-000000000006', '2026-11-06', '2026-12-08'),
  ('10000000-0000-4000-8700-000000000007', 'INV-2026-0107', '10000000-0000-4000-8500-000000000007', '10000000-0000-4000-8600-000000000007', '2026-11-07', '2026-12-12'),
  ('10000000-0000-4000-8700-000000000008', 'INV-2026-0108', '10000000-0000-4000-8500-000000000008', '10000000-0000-4000-8600-000000000008', '2026-11-08', '2026-12-17'),
  ('10000000-0000-4000-8700-000000000009', 'INV-2026-0109', '10000000-0000-4000-8500-000000000009', '10000000-0000-4000-8600-000000000009', '2026-10-20', '2026-11-08'),
  ('10000000-0000-4000-8700-000000000010', 'INV-2026-0110', '10000000-0000-4000-8500-000000000010', '10000000-0000-4000-8600-000000000010', '2026-11-10', '2026-12-25')
on conflict (id) do nothing;

insert into public.faktur_tagihan_detail (id, invoice_id, source_order_item_id, order_group_id, order_date, service_type, service_name_snapshot, quantity, unit_price, unit_snapshot) values
  ('10000000-0000-4000-8710-000000000001', '10000000-0000-4000-8700-000000000001', '10000000-0000-4000-8610-000000000001', '10000000-0000-4000-8600-000000000001', '2026-11-01', 'core', 'Makeup Akad & Resepsi Pengantin', 1, 6500000, 'paket'),
  ('10000000-0000-4000-8710-000000000011', '10000000-0000-4000-8700-000000000001', '10000000-0000-4000-8610-000000000011', '10000000-0000-4000-8600-000000000001', '2026-11-01', 'additional', 'Makeup Ibu Pengantin & Besan', 2, 750000, 'orang'),
  ('10000000-0000-4000-8710-000000000002', '10000000-0000-4000-8700-000000000002', '10000000-0000-4000-8610-000000000002', '10000000-0000-4000-8600-000000000002', '2026-11-02', 'core', 'Makeup Akad & Resepsi Pengantin', 1, 6500000, 'paket'),
  ('10000000-0000-4000-8710-000000000003', '10000000-0000-4000-8700-000000000003', '10000000-0000-4000-8610-000000000003', '10000000-0000-4000-8600-000000000003', '2026-11-03', 'core', 'Makeup Wedding Adat Jawa Lengkap', 1, 9500000, 'paket'),
  ('10000000-0000-4000-8710-000000000004', '10000000-0000-4000-8700-000000000004', '10000000-0000-4000-8610-000000000004', '10000000-0000-4000-8600-000000000004', '2026-11-04', 'core', 'Makeup Akad & Resepsi Pengantin', 1, 6500000, 'paket'),
  ('10000000-0000-4000-8710-000000000005', '10000000-0000-4000-8700-000000000005', '10000000-0000-4000-8610-000000000005', '10000000-0000-4000-8600-000000000005', '2026-11-05', 'core', 'Makeup Lamaran / Tunangan', 1, 2500000, 'paket'),
  ('10000000-0000-4000-8710-000000000006', '10000000-0000-4000-8700-000000000006', '10000000-0000-4000-8610-000000000006', '10000000-0000-4000-8600-000000000006', '2026-11-06', 'core', 'Makeup Akad & Resepsi Pengantin', 1, 6200000, 'paket'),
  ('10000000-0000-4000-8710-000000000007', '10000000-0000-4000-8700-000000000007', '10000000-0000-4000-8610-000000000007', '10000000-0000-4000-8600-000000000007', '2026-11-07', 'core', 'Makeup Prewedding Outdoor', 1, 3000000, 'paket'),
  ('10000000-0000-4000-8710-000000000008', '10000000-0000-4000-8700-000000000008', '10000000-0000-4000-8610-000000000008', '10000000-0000-4000-8600-000000000008', '2026-11-08', 'core', 'Makeup Wedding Adat Jawa Lengkap', 1, 9500000, 'paket'),
  ('10000000-0000-4000-8710-000000000009', '10000000-0000-4000-8700-000000000009', '10000000-0000-4000-8610-000000000009', '10000000-0000-4000-8600-000000000009', '2026-10-20', 'core', 'Paket Siraman & Pengajian', 1, 3500000, 'paket'),
  ('10000000-0000-4000-8710-000000000010', '10000000-0000-4000-8700-000000000010', '10000000-0000-4000-8610-000000000010', '10000000-0000-4000-8600-000000000010', '2026-11-10', 'core', 'Makeup Akad & Resepsi Pengantin', 1, 6500000, 'paket')
on conflict (id) do nothing;

-- 8. 10 PEMBAYARAN & KWITANSI (pembayaran)
insert into public.pembayaran (id, payment_number, receipt_number, booking_id, paid_at, method, amount, notes, idempotency_key, billing_snapshot, cumulative_paid_snapshot, balance_snapshot) values
  ('10000000-0000-4000-8800-000000000001', 'PAY-2026-0101', 'KWT-2026-0101', '10000000-0000-4000-8500-000000000001', '2026-11-02T10:00:00Z', 'Transfer', 3000000, 'DP Tahap 1', '10000000-0000-4000-8800-000000000001', 8000000, 3000000, 5000000),
  ('10000000-0000-4000-8800-000000000002', 'PAY-2026-0102', 'KWT-2026-0102', '10000000-0000-4000-8500-000000000001', '2026-11-12T14:30:00Z', 'QRIS', 2000000, 'Cicilan ke-2', '10000000-0000-4000-8800-000000000002', 8000000, 5000000, 3000000),
  ('10000000-0000-4000-8800-000000000003', 'PAY-2026-0103', 'KWT-2026-0103', '10000000-0000-4000-8500-000000000002', '2026-11-03T11:00:00Z', 'Transfer', 2500000, 'Uang muka booking', '10000000-0000-4000-8800-000000000003', 6500000, 2500000, 4000000),
  ('10000000-0000-4000-8800-000000000004', 'PAY-2026-0104', 'KWT-2026-0104', '10000000-0000-4000-8500-000000000003', '2026-11-05T09:15:00Z', 'Transfer', 5000000, 'DP Paket Adat Jawa', '10000000-0000-4000-8800-000000000004', 9500000, 5000000, 4500000),
  ('10000000-0000-4000-8800-000000000005', 'PAY-2026-0105', 'KWT-2026-0105', '10000000-0000-4000-8500-000000000004', '2026-11-06T13:00:00Z', 'QRIS', 2000000, 'DP Lock Tanggal', '10000000-0000-4000-8800-000000000005', 6500000, 2000000, 4500000),
  ('10000000-0000-4000-8800-000000000006', 'PAY-2026-0106', 'KWT-2026-0106', '10000000-0000-4000-8500-000000000005', '2026-11-07T16:20:00Z', 'Tunai', 1000000, 'DP Lamaran', '10000000-0000-4000-8800-000000000006', 2500000, 1000000, 1500000),
  ('10000000-0000-4000-8800-000000000007', 'PAY-2026-0107', 'KWT-2026-0107', '10000000-0000-4000-8500-000000000006', '2026-11-08T12:00:00Z', 'Transfer', 3000000, 'DP Tahap 1', '10000000-0000-4000-8800-000000000007', 6200000, 3000000, 3200000),
  ('10000000-0000-4000-8800-000000000008', 'PAY-2026-0108', 'KWT-2026-0108', '10000000-0000-4000-8500-000000000008', '2026-11-10T15:00:00Z', 'Transfer', 4500000, 'DP Resepsi 50%', '10000000-0000-4000-8800-000000000008', 9500000, 4500000, 5000000),
  ('10000000-0000-4000-8800-000000000009', 'PAY-2026-0109', 'KWT-2026-0109', '10000000-0000-4000-8500-000000000009', '2026-10-25T10:30:00Z', 'Transfer', 3500000, 'Pelunasan penuh', '10000000-0000-4000-8800-000000000009', 3500000, 3500000, 0),
  ('10000000-0000-4000-8800-000000000010', 'PAY-2026-0110', 'KWT-2026-0110', '10000000-0000-4000-8500-000000000010', '2026-11-14T11:15:00Z', 'QRIS', 2000000, 'Booking fee tanggal', '10000000-0000-4000-8800-000000000010', 6500000, 2000000, 4500000)
on conflict (id) do nothing;

-- 9. 10 PENUGASAN TIM (penugasan_tim & penugasan_tim_anggota)
insert into public.penugasan_tim (booking_id, notes) values
  ('10000000-0000-4000-8500-000000000001', 'Lead Aura + Hijabdo Dina'),
  ('10000000-0000-4000-8500-000000000002', 'Standby venue 04.30 WIB'),
  ('10000000-0000-4000-8500-000000000003', 'Paes Jawa bersama Citra'),
  ('10000000-0000-4000-8500-000000000004', 'Bawa tim bridesmaid lengkap'),
  ('10000000-0000-4000-8500-000000000005', 'Sesi pagi saja'),
  ('10000000-0000-4000-8500-000000000006', 'Tim Sunda Siger + Groom'),
  ('10000000-0000-4000-8500-000000000007', 'Retouch outdoor siang'),
  ('10000000-0000-4000-8500-000000000008', 'Full team resepsi besar'),
  ('10000000-0000-4000-8500-000000000009', 'Acara selesai dengan baik'),
  ('10000000-0000-4000-8500-000000000010', 'Konfirmasi ulang H-3')
on conflict (booking_id) do nothing;

insert into public.penugasan_tim_anggota (booking_id, employee_id) values
  ('10000000-0000-4000-8500-000000000001', '10000000-0000-4000-8100-000000000001'),
  ('10000000-0000-4000-8500-000000000001', '10000000-0000-4000-8100-000000000005'),
  ('10000000-0000-4000-8500-000000000002', '10000000-0000-4000-8100-000000000001'),
  ('10000000-0000-4000-8500-000000000002', '10000000-0000-4000-8100-000000000004'),
  ('10000000-0000-4000-8500-000000000003', '10000000-0000-4000-8100-000000000001'),
  ('10000000-0000-4000-8500-000000000003', '10000000-0000-4000-8100-000000000008'),
  ('10000000-0000-4000-8500-000000000004', '10000000-0000-4000-8100-000000000006'),
  ('10000000-0000-4000-8500-000000000005', '10000000-0000-4000-8100-000000000010'),
  ('10000000-0000-4000-8500-000000000006', '10000000-0000-4000-8100-000000000005'),
  ('10000000-0000-4000-8500-000000000006', '10000000-0000-4000-8100-000000000007'),
  ('10000000-0000-4000-8500-000000000007', '10000000-0000-4000-8100-000000000004'),
  ('10000000-0000-4000-8500-000000000008', '10000000-0000-4000-8100-000000000001'),
  ('10000000-0000-4000-8500-000000000008', '10000000-0000-4000-8100-000000000009'),
  ('10000000-0000-4000-8500-000000000009', '10000000-0000-4000-8100-000000000010'),
  ('10000000-0000-4000-8500-000000000010', '10000000-0000-4000-8100-000000000004')
on conflict (booking_id, employee_id) do nothing;

-- 10. 10 FORM FITTING & DETAIL ACARA (portal_pernikahan_fitting & portal_pernikahan_acara)
insert into public.portal_pernikahan_fitting (id, booking_id, measurements, uniforms_and_extras, vendors) values
  ('10000000-0000-4000-8900-000000000001', '10000000-0000-4000-8500-000000000001', '{"bride":{"LD":"86","LP":"68","TB":"162","BB":"52"},"groom":{"LD":"102","LP":"84","TB":"175","BB":"72"}}', '{"uniforms":{"domas":"Kebaya Sage 4 orang","manggolo":"Beskap Navy 2 orang","softlens":"Normal"},"manggoloBlangkon":2,"manggoloSlop":2}', '{"wo":"Harmoni WO","dekor":"Flora Decor","foto":"Lensa Abadi"}'),
  ('10000000-0000-4000-8900-000000000002', '10000000-0000-4000-8500-000000000002', '{"bride":{"LD":"90","LP":"72","TB":"160","BB":"56"},"groom":{"LD":"104","LP":"88","TB":"178","BB":"76"}}', '{"uniforms":{"domas":"Dusty Pink 6 orang","softlens":"Minus 1.5"},"manggoloBlangkon":4,"manggoloSlop":4}', '{"wo":"Bandung Wedding Co"}'),
  ('10000000-0000-4000-8900-000000000003', '10000000-0000-4000-8500-000000000003', '{"bride":{"LD":"84","LP":"64","TB":"158","BB":"49"},"groom":{"LD":"98","LP":"80","TB":"172","BB":"68"}}', '{"uniforms":{"domas":"Jawa Klasik 4 orang","softlens":"Normal"},"manggoloBlangkon":2,"manggoloSlop":2}', '{"wo":"Kraton WO"}'),
  ('10000000-0000-4000-8900-000000000004', '10000000-0000-4000-8500-000000000004', '{"bride":{"LD":"88","LP":"70","TB":"165","BB":"54"}}', '{"uniforms":{"softlens":"Normal"},"manggoloBlangkon":null,"manggoloSlop":null}', '{"wo":"Senayan Event"}'),
  ('10000000-0000-4000-8900-000000000005', '10000000-0000-4000-8500-000000000005', '{"bride":{"LD":"86","LP":"67","TB":"161","BB":"51"}}', '{"uniforms":{"softlens":"Normal"},"manggoloBlangkon":null,"manggoloSlop":null}', '{}'),
  ('10000000-0000-4000-8900-000000000006', '10000000-0000-4000-8500-000000000006', '{"bride":{"LD":"88","LP":"69","TB":"163","BB":"53"},"groom":{"LD":"100","LP":"82","TB":"174","BB":"70"}}', '{"uniforms":{"softlens":"Normal"},"manggoloBlangkon":2,"manggoloSlop":2}', '{"wo":"Sunda Heritage"}'),
  ('10000000-0000-4000-8900-000000000007', '10000000-0000-4000-8500-000000000007', '{"bride":{"LD":"85","LP":"66","TB":"164","BB":"50"}}', '{"uniforms":{"softlens":"Normal"},"manggoloBlangkon":null,"manggoloSlop":null}', '{}'),
  ('10000000-0000-4000-8900-000000000008', '10000000-0000-4000-8500-000000000008', '{"bride":{"LD":"92","LP":"74","TB":"160","BB":"58"}}', '{"uniforms":{"domas":"Maroon 6 orang","softlens":"Minus 2"},"manggoloBlangkon":4,"manggoloSlop":4}', '{"wo":"Samudra WO"}'),
  ('10000000-0000-4000-8900-000000000009', '10000000-0000-4000-8500-000000000009', '{"bride":{"LD":"86","LP":"68","TB":"159","BB":"51"}}', '{"uniforms":{"softlens":"Normal"},"manggoloBlangkon":null,"manggoloSlop":null}', '{"wo":"Ritz Organizer"}'),
  ('10000000-0000-4000-8900-000000000010', '10000000-0000-4000-8500-000000000010', '{"bride":{"LD":"89","LP":"71","TB":"162","BB":"55"}}', '{"uniforms":{"softlens":"Normal"},"manggoloBlangkon":2,"manggoloSlop":2}', '{"wo":"Bidakara WO"}')
on conflict (id) do nothing;

insert into public.portal_pernikahan_acara (id, fitting_form_id, event_number, event_name, ready_time, time_note, bride_attire_id, bride_look, bride_accessories, bride_shoes, groom_attire_id, groom_look, groom_accessories, groom_shoes) values
  ('10000000-0000-4000-8910-000000000001', '10000000-0000-4000-8900-000000000001', 1, 'Akad Nikah', '05:00', 'Ready Pagi', '10000000-0000-4000-8300-000000000001', 'Soft Glam Hijab', 'Mahkota Mutiara', '38', '10000000-0000-4000-8300-000000000006', 'Beskap Gold', 'Blangkon Solo', '42'),
  ('10000000-0000-4000-8910-000000000002', '10000000-0000-4000-8900-000000000002', 1, 'Resepsi Siang', '09:00', 'Ganti Look 2', '10000000-0000-4000-8300-000000000002', 'Modern Glow', 'Tiara Crystal', '39', '10000000-0000-4000-8300-000000000007', 'Beskap Navy', 'Pin Keris', '43'),
  ('10000000-0000-4000-8910-000000000003', '10000000-0000-4000-8900-000000000003', 1, 'Panggih & Resepsi', '06:30', 'Paes Jawa', '10000000-0000-4000-8300-000000000003', 'Paes Ageng', 'Cunduk Mentul 9', '37', '10000000-0000-4000-8300-000000000008', 'Bludru Hitam', 'Kalung Ulur', '41'),
  ('10000000-0000-4000-8910-000000000004', '10000000-0000-4000-8900-000000000004', 1, 'Akad Nikah', '05:30', 'Pagi', '10000000-0000-4000-8300-000000000005', 'Sunda Hijab', 'Bros Perak', '38', '10000000-0000-4000-8300-000000000010', 'Beskap Putih', 'Bendo Putih', '42'),
  ('10000000-0000-4000-8910-000000000005', '10000000-0000-4000-8900-000000000005', 1, 'Lamaran', '08:00', 'Pagi', '10000000-0000-4000-8300-000000000001', 'Natural Peach', 'Anting Mutiara', '38', null, '', '', ''),
  ('10000000-0000-4000-8910-000000000006', '10000000-0000-4000-8900-000000000006', 1, 'Akad Sunda', '05:00', 'Ready Subuh', '10000000-0000-4000-8300-000000000005', 'Sunda Siger', 'Siger Melati', '39', '10000000-0000-4000-8300-000000000010', 'Sunda Putih', 'Bendo & Kalung', '42'),
  ('10000000-0000-4000-8910-000000000007', '10000000-0000-4000-8900-000000000007', 1, 'Prewedding', '07:30', 'Sesi 1', '10000000-0000-4000-8300-000000000002', 'Editorial Bronze', 'Headpiece Daun', '38', null, '', '', ''),
  ('10000000-0000-4000-8910-000000000008', '10000000-0000-4000-8900-000000000008', 1, 'Resepsi Besar', '08:00', 'Full Day', '10000000-0000-4000-8300-000000000002', 'Bold Glam', 'Mahkota Gold', '38', '10000000-0000-4000-8300-000000000006', 'Beskap Gold', 'Blangkon Gold', '43'),
  ('10000000-0000-4000-8910-000000000009', '10000000-0000-4000-8900-000000000009', 1, 'Siraman & Pengajian', '06:00', 'Selesai', '10000000-0000-4000-8300-000000000001', 'Fresh Dewy', 'Ronce Melati', '37', null, '', '', ''),
  ('10000000-0000-4000-8910-000000000010', '10000000-0000-4000-8900-000000000010', 1, 'Akad & Resepsi', '05:30', 'Siap pagi', '10000000-0000-4000-8300-000000000003', 'Classic Glam', 'Hairpiece Perak', '38', '10000000-0000-4000-8300-000000000008', 'Beskap Hitam', 'Keris & Slop', '42')
on conflict (id) do nothing;

-- 11. 10 PENGELUARAN (pengeluaran)
insert into public.pengeluaran (id, expense_number, expense_date, expense_scope, expense_type, category, booking_id, description, amount, payment_method) values
  ('10000000-0000-4000-8a00-000000000001', 'EXP-2026-0101', '2026-11-12', 'Berdasarkan PO', 'po', 'Transportasi', '10000000-0000-4000-8500-000000000001', 'Transport tim ke The Langham', 350000, 'Transfer'),
  ('10000000-0000-4000-8a00-000000000002', 'EXP-2026-0102', '2026-11-13', 'Berdasarkan PO', 'po', 'Honor Tim', '10000000-0000-4000-8500-000000000002', 'Fee asisten hairdo Bandung', 600000, 'Transfer'),
  ('10000000-0000-4000-8a00-000000000003', 'EXP-2026-0103', '2026-11-14', 'Berdasarkan PO', 'po', 'Akomodasi', '10000000-0000-4000-8500-000000000002', 'Hotel tim 1 malam Bandung', 750000, 'QRIS'),
  ('10000000-0000-4000-8a00-000000000004', 'EXP-2026-0104', '2026-11-15', 'Berdasarkan PO', 'po', 'Perlengkapan', '10000000-0000-4000-8500-000000000003', 'Melati segar adat Jawa', 450000, 'Tunai'),
  ('10000000-0000-4000-8a00-000000000005', 'EXP-2026-0105', '2026-11-16', 'Berdasarkan PO', 'po', 'Honor Tim', '10000000-0000-4000-8500-000000000009', 'Fee tim acara Ritz-Carlton', 550000, 'Transfer'),
  ('10000000-0000-4000-8a00-000000000006', 'EXP-2026-0106', '2026-11-10', 'Di Luar PO', 'general', 'Operasional', null, 'Tagihan internet & WiFi studio', 450000, 'Transfer'),
  ('10000000-0000-4000-8a00-000000000007', 'EXP-2026-0107', '2026-11-11', 'Di Luar PO', 'general', 'Perlengkapan', null, 'Restock bulu mata & sponge studio', 680000, 'QRIS'),
  ('10000000-0000-4000-8a00-000000000008', 'EXP-2026-0108', '2026-11-14', 'Di Luar PO', 'general', 'Operasional', null, 'Laundry kebaya & beskap bulanan', 520000, 'Transfer'),
  ('10000000-0000-4000-8a00-000000000009', 'EXP-2026-0109', '2026-11-15', 'Di Luar PO', 'general', 'Operasional', null, 'Listrik & air studio bulan November', 850000, 'Transfer'),
  ('10000000-0000-4000-8a00-000000000010', 'EXP-2026-0110', '2026-11-17', 'Di Luar PO', 'general', 'Perlengkapan', null, 'Pembelian kuas & ringlight cadangan', 420000, 'Tunai')
on conflict (id) do nothing;

-- 12. 10 BARANG INVENTARIS (inventaris_barang)
insert into public.inventaris_barang (id, item_code, name, category, unit, initial_quantity, minimum_stock, storage_location, is_active) values
  ('10000000-0000-4000-8b00-000000000001', 'BRG-0101', 'Foundation HD Ivory', 'Complexion', 'botol', 10, 4, 'Rak A1', true),
  ('10000000-0000-4000-8b00-000000000002', 'BRG-0102', 'Setting Spray Matte', 'Finishing', 'botol', 8, 3, 'Rak A2', true),
  ('10000000-0000-4000-8b00-000000000003', 'BRG-0103', 'Bulu Mata 3D Natural', 'Aksesoris Mata', 'pasang', 20, 8, 'Laci B1', true),
  ('10000000-0000-4000-8b00-000000000004', 'BRG-0104', 'Cleansing Balm', 'Skin Prep', 'jar', 4, 2, 'Rak A3', true),
  ('10000000-0000-4000-8b00-000000000005', 'BRG-0105', 'Beauty Sponge', 'Tools', 'pcs', 15, 5, 'Laci B2', true),
  ('10000000-0000-4000-8b00-000000000006', 'BRG-0106', 'Bedak Tabur Translucent', 'Complexion', 'jar', 6, 2, 'Rak A1', true),
  ('10000000-0000-4000-8b00-000000000007', 'BRG-0107', 'Hair Spray Extra Hold', 'Hair Styling', 'kaleng', 12, 4, 'Lemari C1', true),
  ('10000000-0000-4000-8b00-000000000008', 'BRG-0108', 'Jarum Pentul & Peniti Set', 'Hijab Styling', 'kotak', 18, 6, 'Laci B3', true),
  ('10000000-0000-4000-8b00-000000000009', 'BRG-0109', 'Softlens Cairan 360ml', 'Softlens Care', 'botol', 9, 3, 'Rak A4', true),
  ('10000000-0000-4000-8b00-000000000010', 'BRG-0110', 'Kapas & Tisu Pembersih', 'Skin Prep', 'pack', 14, 5, 'Lemari C2', true)
on conflict (id) do nothing;

-- 13. 10 MUTASI INVENTARIS (5 BARANG MASUK + 5 BARANG KELUAR) + 2 STOK OPNAME
insert into public.inventaris_barang_masuk (id, transaction_number, transaction_date, pic_name, supplier, notes, idempotency_key) values
  ('10000000-0000-4000-8c00-000000000001', 'IN-2026-0101', '2026-11-10', 'Rani Putri', 'Sephora Supplier', 'Restock mingguan', '10000000-0000-4000-8c00-000000000001'),
  ('10000000-0000-4000-8c00-000000000002', 'IN-2026-0102', '2026-11-11', 'Nisa Amalia', 'Toko Kosmetik Jaya', 'Tambahan bulu mata', '10000000-0000-4000-8c00-000000000002'),
  ('10000000-0000-4000-8c00-000000000003', 'IN-2026-0103', '2026-11-12', 'Rani Putri', 'Beauty Mart', 'Stok hair spray', '10000000-0000-4000-8c00-000000000003'),
  ('10000000-0000-4000-8c00-000000000004', 'IN-2026-0104', '2026-11-14', 'Rani Putri', 'Optical Care', 'Cairan softlens', '10000000-0000-4000-8c00-000000000004'),
  ('10000000-0000-4000-8c00-000000000005', 'IN-2026-0105', '2026-11-15', 'Nisa Amalia', 'Grosir Studio', 'Kapas & sponge', '10000000-0000-4000-8c00-000000000005')
on conflict (id) do nothing;

insert into public.inventaris_barang_masuk_detail (id, stock_in_id, inventory_item_id, quantity) values
  ('10000000-0000-4000-8c10-000000000001', '10000000-0000-4000-8c00-000000000001', '10000000-0000-4000-8b00-000000000001', 4),
  ('10000000-0000-4000-8c10-000000000002', '10000000-0000-4000-8c00-000000000002', '10000000-0000-4000-8b00-000000000003', 10),
  ('10000000-0000-4000-8c10-000000000003', '10000000-0000-4000-8c00-000000000003', '10000000-0000-4000-8b00-000000000007', 5),
  ('10000000-0000-4000-8c10-000000000004', '10000000-0000-4000-8c00-000000000004', '10000000-0000-4000-8b00-000000000009', 4),
  ('10000000-0000-4000-8c10-000000000005', '10000000-0000-4000-8c00-000000000005', '10000000-0000-4000-8b00-000000000005', 6)
on conflict (id) do nothing;

insert into public.inventaris_barang_keluar (id, transaction_number, transaction_date, pic_name, purpose, notes, idempotency_key) values
  ('10000000-0000-4000-8d00-000000000001', 'OUT-2026-0101', '2026-11-11', 'Sinta Dewi', 'Acara Wedding Ritz', 'Pemakaian tim pagi', '10000000-0000-4000-8d00-000000000001'),
  ('10000000-0000-4000-8d00-000000000002', 'OUT-2026-0102', '2026-11-12', 'Dina Kartika', 'Pemakaian studio', 'Job lamaran', '10000000-0000-4000-8d00-000000000002'),
  ('10000000-0000-4000-8d00-000000000003', 'OUT-2026-0103', '2026-11-13', 'Maya Lestari', 'Pemakaian event', 'Setting spray tim 2', '10000000-0000-4000-8d00-000000000003'),
  ('10000000-0000-4000-8d00-000000000004', 'OUT-2026-0104', '2026-11-15', 'Citra Anggraini', 'Acara Sanggul', 'Pemakaian hairspray', '10000000-0000-4000-8d00-000000000004'),
  ('10000000-0000-4000-8d00-000000000005', 'OUT-2026-0105', '2026-11-16', 'Rani Putri', 'Prep Kit Bride', 'Perlengkapan kebersihan', '10000000-0000-4000-8d00-000000000005')
on conflict (id) do nothing;

insert into public.inventaris_barang_keluar_detail (id, stock_out_id, inventory_item_id, quantity) values
  ('10000000-0000-4000-8d10-000000000001', '10000000-0000-4000-8d00-000000000001', '10000000-0000-4000-8b00-000000000001', 2),
  ('10000000-0000-4000-8d10-000000000002', '10000000-0000-4000-8d00-000000000002', '10000000-0000-4000-8b00-000000000003', 6),
  ('10000000-0000-4000-8d10-000000000003', '10000000-0000-4000-8d00-000000000003', '10000000-0000-4000-8b00-000000000002', 5),
  ('10000000-0000-4000-8d10-000000000004', '10000000-0000-4000-8d00-000000000004', '10000000-0000-4000-8b00-000000000007', 3),
  ('10000000-0000-4000-8d10-000000000005', '10000000-0000-4000-8d00-000000000005', '10000000-0000-4000-8b00-000000000004', 2)
on conflict (id) do nothing;

insert into public.inventaris_mutasi_stok (id, inventory_item_id, movement_type, quantity, stock_in_item_id, stock_out_item_id, movement_date, pic_name, notes) values
  ('10000000-0000-4000-8e00-000000000001', '10000000-0000-4000-8b00-000000000001', 'in', 4, '10000000-0000-4000-8c10-000000000001', null, '2026-11-10', 'Rani Putri', 'Restock mingguan'),
  ('10000000-0000-4000-8e00-000000000002', '10000000-0000-4000-8b00-000000000003', 'in', 10, '10000000-0000-4000-8c10-000000000002', null, '2026-11-11', 'Nisa Amalia', 'Tambahan bulu mata'),
  ('10000000-0000-4000-8e00-000000000003', '10000000-0000-4000-8b00-000000000007', 'in', 5, '10000000-0000-4000-8c10-000000000003', null, '2026-11-12', 'Rani Putri', 'Stok hair spray'),
  ('10000000-0000-4000-8e00-000000000004', '10000000-0000-4000-8b00-000000000009', 'in', 4, '10000000-0000-4000-8c10-000000000004', null, '2026-11-14', 'Rani Putri', 'Cairan softlens'),
  ('10000000-0000-4000-8e00-000000000005', '10000000-0000-4000-8b00-000000000005', 'in', 6, '10000000-0000-4000-8c10-000000000005', null, '2026-11-15', 'Nisa Amalia', 'Kapas & sponge'),
  ('10000000-0000-4000-8e00-000000000006', '10000000-0000-4000-8b00-000000000001', 'out', -2, null, '10000000-0000-4000-8d10-000000000001', '2026-11-11', 'Sinta Dewi', 'Acara Wedding Ritz'),
  ('10000000-0000-4000-8e00-000000000007', '10000000-0000-4000-8b00-000000000003', 'out', -6, null, '10000000-0000-4000-8d10-000000000002', '2026-11-12', 'Dina Kartika', 'Job lamaran'),
  ('10000000-0000-4000-8e00-000000000008', '10000000-0000-4000-8b00-000000000002', 'out', -5, null, '10000000-0000-4000-8d10-000000000003', '2026-11-13', 'Maya Lestari', 'Pemakaian event'),
  ('10000000-0000-4000-8e00-000000000009', '10000000-0000-4000-8b00-000000000007', 'out', -3, null, '10000000-0000-4000-8d10-000000000004', '2026-11-15', 'Citra Anggraini', 'Acara Sanggul'),
  ('10000000-0000-4000-8e00-000000000010', '10000000-0000-4000-8b00-000000000004', 'out', -2, null, '10000000-0000-4000-8d10-000000000005', '2026-11-16', 'Rani Putri', 'Prep Kit Bride')
on conflict (id) do nothing;

insert into public.inventaris_stok_opname (id, opname_number, opname_date, pic_name, notes) values
  ('10000000-0000-4000-8f00-000000000001', 'SO-2026-0101', '2026-11-17', 'Rani Putri', 'Pengecekan rutin tengah bulan'),
  ('10000000-0000-4000-8f00-000000000002', 'SO-2026-0102', '2026-11-18', 'Nisa Amalia', 'Audit laci aksesoris')
on conflict (id) do nothing;

insert into public.inventaris_stok_opname_detail (id, opname_id, inventory_item_id, system_stock, physical_stock, diff_quantity, notes) values
  ('10000000-0000-4000-8f10-000000000001', '10000000-0000-4000-8f00-000000000001', '10000000-0000-4000-8b00-000000000001', 12, 12, 0, 'Sesuai'),
  ('10000000-0000-4000-8f10-000000000002', '10000000-0000-4000-8f00-000000000002', '10000000-0000-4000-8b00-000000000003', 24, 24, 0, 'Sesuai')
on conflict (id) do nothing;
