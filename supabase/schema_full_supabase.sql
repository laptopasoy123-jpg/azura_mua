-- =============================================================================
-- AZURA MAKEUP ARTIST (Powered by DaySheet.id)
-- SKEMA DATABASE SUPABASE LENGKAP DALAM 1 FILE SQL
-- Nama tabel disamakan persis dengan menu website:
--   • Portal Pernikahan  -> portal_pernikahan_busana, portal_pernikahan_fitting, portal_pernikahan_acara
--   • Data Pelanggan     -> data_pelanggan, data_pelanggan_booking, data_pelanggan_refund
--   • Pesanan & Tambahan -> pesanan, pesanan_detail
--   • Penugasan Tim      -> penugasan_tim, penugasan_tim_anggota, pengaturan_karyawan
--   • Faktur Tagihan     -> faktur_tagihan, faktur_tagihan_detail
--   • Pembayaran         -> pembayaran
--   • Katalog Jasa       -> katalog_jasa
--   • Pengeluaran        -> pengeluaran
--   • Inventaris         -> inventaris_barang, inventaris_barang_masuk(_detail),
--                           inventaris_barang_keluar(_detail), inventaris_stok_opname(_detail),
--                           inventaris_mutasi_stok
--   • Profil & Dropdown  -> profil_bisnis, pengaturan_dropdown, pengaturan_penomoran, pengaturan_file
--   • Dasbor & Laporan   -> v_dasbor_faktur, v_inventaris_saldo, v_laporan_keuangan_po, laporan_log_aktivitas
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. BERSIHKAN TABEL LAMA BAHASA INGGRIS (AGAR SUPABASE TABLE EDITOR RAPI)
-- -----------------------------------------------------------------------------
drop view if exists public.po_financial_summary cascade;
drop view if exists public.inventory_balances cascade;
drop view if exists public.invoice_totals cascade;
drop view if exists public.v_laporan_keuangan_po cascade;
drop view if exists public.v_inventaris_saldo cascade;
drop view if exists public.v_dasbor_faktur cascade;

drop table if exists
  public.payment_allocations,
  public.payments,
  public.invoice_items,
  public.invoices,
  public.order_items,
  public.orders,
  public.booking_job_employees,
  public.booking_job_assignments,
  public.booking_refunds,
  public.wedding_event_details,
  public.wedding_fitting_forms,
  public.wedding_attire,
  public.expenses,
  public.stock_movements,
  public.stock_opname_items,
  public.stock_opnames,
  public.stock_out_items,
  public.stock_out,
  public.stock_in_items,
  public.stock_in,
  public.inventory_items,
  public.catalog_items,
  public.bookings,
  public.customers,
  public.employees,
  public.app_dropdown_options,
  public.business_profiles,
  public.business_counters,
  public.file_objects,
  public.audit_logs
cascade;

-- -----------------------------------------------------------------------------
-- 2. ENUM & FUNGSI UTILITAS
-- -----------------------------------------------------------------------------
do $$ begin create type public.app_role as enum ('owner', 'admin', 'finance', 'inventory', 'viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.booking_status as enum ('draft', 'confirmed', 'completed', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.catalog_type as enum ('core', 'additional'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_type as enum ('initial', 'additional'); exception when duplicate_object then null; end $$;
do $$ begin create type public.stock_movement_type as enum ('in', 'out', 'adjustment', 'opname'); exception when duplicate_object then null; end $$;
do $$ begin create type public.file_purpose as enum ('catalog', 'payment-proof', 'expense-proof', 'inventory', 'avatar', 'business-asset', 'wedding-attire', 'business-logo'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attire_category as enum ('bride', 'groom'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attire_status as enum ('available', 'booked', 'laundry'); exception when duplicate_object then null; end $$;

create table if not exists public.pengaturan_penomoran (
  counter_key text not null,
  counter_year integer not null,
  value bigint not null default 0,
  primary key (counter_key, counter_year)
);

create or replace function public.next_business_code(
  p_counter_key text,
  p_prefix text,
  p_year integer default extract(year from current_date)::integer
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_value bigint;
begin
  insert into public.pengaturan_penomoran(counter_key, counter_year, value)
  values (p_counter_key, p_year, 1)
  on conflict (counter_key, counter_year)
  do update set value = public.pengaturan_penomoran.value + 1
  returning value into next_value;
  return p_prefix || '-' || p_year::text || '-' || lpad(next_value::text, 4, '0');
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. PROFIL BISNIS, FILE LAMPIRAN, KARYAWAN & PENGATURAN DROPDOWN
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) >= 2),
  phone text,
  role public.app_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pengaturan_file (
  id uuid primary key default extensions.gen_random_uuid(),
  bucket text not null check (bucket in ('public', 'private')),
  object_key text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  etag text,
  purpose public.file_purpose not null,
  status text not null default 'active' check (status in ('pending', 'active', 'deleted')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.profil_bisnis (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null default 'AZURA',
  tagline text not null default 'MAKEUP ARTIST',
  phone text,
  email text,
  address text,
  logo_file_id uuid references public.pengaturan_file(id) on delete set null,
  logo_url text,
  invoice_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pengaturan_dropdown (
  id uuid primary key default extensions.gen_random_uuid(),
  option_group text not null check (option_group in ('paymentMethods', 'poExpenseCategories', 'generalExpenseCategories')),
  label text not null check (length(trim(label)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (option_group, label)
);

create table if not exists public.pengaturan_karyawan (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  role text not null default 'MUA / Tim',
  phone text,
  email text,
  active boolean not null default true,
  last_login_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4. DATA PELANGGAN (CUSTOMER, BOOKING PO & PENGEMBALIAN UANG / BATAL)
-- -----------------------------------------------------------------------------
create table if not exists public.data_pelanggan (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  phone text not null check (length(trim(phone)) >= 6),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_pelanggan_booking (
  id uuid primary key default extensions.gen_random_uuid(),
  po_number text not null unique default public.next_business_code('booking', 'PO'),
  customer_id uuid not null references public.data_pelanggan(id) on delete restrict,
  event_location text not null,
  event_date date not null,
  event_time time,
  event_address text,
  styling_type text check (styling_type in ('Hijabdo', 'Hairdo')),
  notes text,
  status public.booking_status not null default 'draft',
  cancelled_paid_amount bigint not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.data_pelanggan_refund (
  id uuid primary key default extensions.gen_random_uuid(),
  refund_number text not null unique default public.next_business_code('booking-refund', 'RFD'),
  booking_id uuid not null references public.data_pelanggan_booking(id) on delete restrict,
  refund_date date not null,
  amount bigint not null check (amount > 0),
  method text not null,
  proof_file_id uuid references public.pengaturan_file(id) on delete set null,
  proof_url text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 5. PENUGASAN TIM KARYAWAN
-- -----------------------------------------------------------------------------
create table if not exists public.penugasan_tim (
  booking_id uuid primary key references public.data_pelanggan_booking(id) on delete cascade,
  notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.penugasan_tim_anggota (
  booking_id uuid not null references public.data_pelanggan_booking(id) on delete cascade,
  employee_id uuid not null references public.pengaturan_karyawan(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (booking_id, employee_id)
);

-- -----------------------------------------------------------------------------
-- 6. KATALOG JASA, PESANAN, LAYANAN TAMBAHAN, FAKTUR TAGIHAN & PEMBAYARAN
-- -----------------------------------------------------------------------------
create table if not exists public.katalog_jasa (
  id uuid primary key default extensions.gen_random_uuid(),
  catalog_code text not null unique default public.next_business_code('catalog', 'CAT'),
  name text not null,
  type public.catalog_type not null,
  description text,
  catalog_price bigint not null check (catalog_price >= 0),
  unit text not null,
  image_file_id uuid references public.pengaturan_file(id) on delete set null,
  image_url text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pesanan (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid not null references public.data_pelanggan_booking(id) on delete restrict,
  type public.order_type not null,
  order_date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create table if not exists public.pesanan_detail (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.pesanan(id) on delete cascade,
  catalog_item_id uuid references public.katalog_jasa(id) on delete restrict,
  service_name_snapshot text not null,
  catalog_price_snapshot bigint not null check (catalog_price_snapshot >= 0),
  customer_price bigint not null check (customer_price >= 0),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_snapshot text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.faktur_tagihan (
  id uuid primary key default extensions.gen_random_uuid(),
  invoice_number text not null unique default public.next_business_code('invoice', 'INV'),
  booking_id uuid not null references public.data_pelanggan_booking(id) on delete restrict,
  order_id uuid not null unique references public.pesanan(id) on delete restrict,
  invoice_date date not null default current_date,
  due_date date,
  notes text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.faktur_tagihan_detail (
  id uuid primary key default extensions.gen_random_uuid(),
  invoice_id uuid not null references public.faktur_tagihan(id) on delete cascade,
  source_order_item_id uuid references public.pesanan_detail(id) on delete set null,
  order_group_id uuid references public.pesanan(id) on delete set null,
  order_date date,
  service_type public.catalog_type,
  service_name_snapshot text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0),
  unit_snapshot text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pembayaran (
  id uuid primary key default extensions.gen_random_uuid(),
  payment_number text not null unique default public.next_business_code('payment', 'PAY'),
  receipt_number text not null unique default public.next_business_code('receipt', 'KWT'),
  booking_id uuid not null references public.data_pelanggan_booking(id) on delete restrict,
  paid_at timestamptz not null,
  method text not null,
  amount bigint not null check (amount > 0),
  proof_file_id uuid references public.pengaturan_file(id) on delete set null,
  notes text,
  idempotency_key uuid not null unique,
  billing_snapshot bigint not null default 0 check (billing_snapshot >= 0),
  cumulative_paid_snapshot bigint not null default 0 check (cumulative_paid_snapshot >= 0),
  balance_snapshot bigint not null default 0 check (balance_snapshot >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

-- -----------------------------------------------------------------------------
-- 7. PORTAL PERNIKAHAN (BUSANA, FORM FITTING & DETAIL ACARA)
-- -----------------------------------------------------------------------------
create table if not exists public.portal_pernikahan_busana (
  id uuid primary key default extensions.gen_random_uuid(),
  attire_code text not null unique default public.next_business_code('wedding-attire', 'BTR'),
  name text not null check (length(trim(name)) >= 2),
  category public.attire_category not null,
  size text not null check (length(trim(size)) > 0),
  status public.attire_status not null default 'available',
  photo_file_id uuid references public.pengaturan_file(id) on delete set null,
  image_url text,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_pernikahan_fitting (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid not null unique references public.data_pelanggan_booking(id) on delete restrict,
  measurements jsonb not null default '{}'::jsonb,
  uniforms_and_extras jsonb not null default '{}'::jsonb,
  vendors jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(measurements) = 'object'),
  check (jsonb_typeof(uniforms_and_extras) = 'object'),
  check (jsonb_typeof(vendors) = 'object')
);

create table if not exists public.portal_pernikahan_acara (
  id uuid primary key default extensions.gen_random_uuid(),
  fitting_form_id uuid not null references public.portal_pernikahan_fitting(id) on delete cascade,
  event_number smallint not null check (event_number between 1 and 3),
  event_name text,
  ready_time time,
  time_note text,
  bride_attire_id uuid references public.portal_pernikahan_busana(id) on delete restrict,
  bride_look text,
  bride_accessories text,
  bride_shoes text,
  groom_attire_id uuid references public.portal_pernikahan_busana(id) on delete restrict,
  groom_look text,
  groom_accessories text,
  groom_shoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fitting_form_id, event_number)
);

-- -----------------------------------------------------------------------------
-- 8. PENGELUARAN (BERDASARKAN PO & DI LUAR PO)
-- -----------------------------------------------------------------------------
create table if not exists public.pengeluaran (
  id uuid primary key default extensions.gen_random_uuid(),
  expense_number text not null unique default public.next_business_code('expense', 'EXP'),
  expense_date date not null,
  expense_scope text not null default 'Berdasarkan PO' check (expense_scope in ('Berdasarkan PO', 'Di Luar PO')),
  expense_type text not null,
  category text not null,
  booking_id uuid references public.data_pelanggan_booking(id) on delete restrict,
  description text not null,
  amount bigint not null check (amount > 0),
  payment_method text not null,
  proof_file_id uuid references public.pengaturan_file(id) on delete set null,
  proof_url text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

-- -----------------------------------------------------------------------------
-- 9. INVENTARIS (KATALOG BARANG, MASUK/KELUAR BATCH, STOK OPNAME & MUTASI)
-- -----------------------------------------------------------------------------
create table if not exists public.inventaris_barang (
  id uuid primary key default extensions.gen_random_uuid(),
  item_code text not null unique default public.next_business_code('inventory-item', 'BRG'),
  name text not null,
  category text not null,
  brand_spec text,
  unit text not null,
  initial_quantity numeric(14, 3) not null default 0 check (initial_quantity >= 0),
  minimum_stock numeric(14, 3) not null default 0 check (minimum_stock >= 0),
  storage_location text,
  image_file_id uuid references public.pengaturan_file(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventaris_barang_masuk (
  id uuid primary key default extensions.gen_random_uuid(),
  transaction_number text not null unique default public.next_business_code('stock-in', 'IN'),
  transaction_date date not null,
  pic_name text not null check (length(trim(pic_name)) > 0),
  supplier text,
  notes text,
  proof_file_id uuid references public.pengaturan_file(id) on delete set null,
  proof_url text,
  idempotency_key uuid not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

create table if not exists public.inventaris_barang_masuk_detail (
  id uuid primary key default extensions.gen_random_uuid(),
  stock_in_id uuid not null references public.inventaris_barang_masuk(id) on delete cascade,
  inventory_item_id uuid not null references public.inventaris_barang(id) on delete restrict,
  quantity numeric(14, 3) not null check (quantity > 0),
  unique (stock_in_id, inventory_item_id)
);

create table if not exists public.inventaris_barang_keluar (
  id uuid primary key default extensions.gen_random_uuid(),
  transaction_number text not null unique default public.next_business_code('stock-out', 'OUT'),
  transaction_date date not null,
  pic_name text not null check (length(trim(pic_name)) > 0),
  purpose text not null,
  notes text,
  proof_file_id uuid references public.pengaturan_file(id) on delete set null,
  proof_url text,
  idempotency_key uuid not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

create table if not exists public.inventaris_barang_keluar_detail (
  id uuid primary key default extensions.gen_random_uuid(),
  stock_out_id uuid not null references public.inventaris_barang_keluar(id) on delete cascade,
  inventory_item_id uuid not null references public.inventaris_barang(id) on delete restrict,
  quantity numeric(14, 3) not null check (quantity > 0),
  unique (stock_out_id, inventory_item_id)
);

create table if not exists public.inventaris_stok_opname (
  id uuid primary key default extensions.gen_random_uuid(),
  opname_number text not null unique default public.next_business_code('stock-opname', 'SO'),
  opname_date date not null,
  pic_name text not null check (length(trim(pic_name)) > 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.inventaris_stok_opname_detail (
  id uuid primary key default extensions.gen_random_uuid(),
  opname_id uuid not null references public.inventaris_stok_opname(id) on delete cascade,
  inventory_item_id uuid not null references public.inventaris_barang(id) on delete restrict,
  system_stock numeric(14, 3) not null,
  physical_stock numeric(14, 3) not null check (physical_stock >= 0),
  diff_quantity numeric(14, 3) not null,
  notes text,
  unique (opname_id, inventory_item_id)
);

create table if not exists public.inventaris_mutasi_stok (
  id uuid primary key default extensions.gen_random_uuid(),
  inventory_item_id uuid not null references public.inventaris_barang(id) on delete restrict,
  movement_type public.stock_movement_type not null,
  quantity numeric(14, 3) not null check (quantity <> 0),
  stock_in_item_id uuid unique references public.inventaris_barang_masuk_detail(id) on delete cascade,
  stock_out_item_id uuid unique references public.inventaris_barang_keluar_detail(id) on delete cascade,
  opname_id uuid references public.inventaris_stok_opname(id) on delete set null,
  movement_date date not null,
  pic_name text not null,
  notes text,
  created_at timestamptz not null default now(),
  check (
    (movement_type = 'in' and quantity > 0 and stock_in_item_id is not null and stock_out_item_id is null)
    or (movement_type = 'out' and quantity < 0 and stock_out_item_id is not null and stock_in_item_id is null)
    or (movement_type in ('adjustment', 'opname') and stock_in_item_id is null and stock_out_item_id is null)
  )
);

-- -----------------------------------------------------------------------------
-- 10. AUDIT LOG & VIEW UNTUK DASBOR / LAPORAN
-- -----------------------------------------------------------------------------
create table if not exists public.laporan_log_aktivitas (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create or replace view public.v_dasbor_faktur with (security_invoker = true) as
select
  f.id as invoice_id,
  coalesce(sum(fd.quantity * fd.unit_price), 0)::bigint as total
from public.faktur_tagihan f
left join public.faktur_tagihan_detail fd on fd.invoice_id = f.id
where f.cancelled_at is null
group by f.id;

create or replace view public.v_inventaris_saldo with (security_invoker = true) as
select
  b.id as inventory_item_id,
  b.item_code,
  b.name,
  b.initial_quantity + coalesce(sum(m.quantity), 0) as available_stock,
  b.minimum_stock
from public.inventaris_barang b
left join public.inventaris_mutasi_stok m on m.inventory_item_id = b.id
where b.is_active
group by b.id, b.item_code, b.name, b.initial_quantity, b.minimum_stock;

create or replace view public.v_laporan_keuangan_po with (security_invoker = true) as
select
  bk.id as booking_id,
  bk.po_number,
  bk.status as booking_status,
  bk.event_date,
  pl.id as customer_id,
  pl.name as customer_name,
  pl.phone as customer_phone,
  coalesce(inv.total_billing, 0)::bigint as total_billing,
  coalesce(pay.total_paid, 0)::bigint as total_paid,
  greatest(coalesce(inv.total_billing, 0) - coalesce(pay.total_paid, 0), 0)::bigint as remaining_balance,
  coalesce(rfd.total_refunded, 0)::bigint as total_refunded,
  coalesce(exp.total_expenses, 0)::bigint as total_expenses
from public.data_pelanggan_booking bk
join public.data_pelanggan pl on pl.id = bk.customer_id
left join (
  select f.booking_id, sum(fd.quantity * fd.unit_price) as total_billing
  from public.faktur_tagihan f
  join public.faktur_tagihan_detail fd on fd.invoice_id = f.id
  where f.cancelled_at is null
  group by f.booking_id
) inv on inv.booking_id = bk.id
left join (
  select p.booking_id, sum(p.amount) as total_paid
  from public.pembayaran p
  where p.voided_at is null
  group by p.booking_id
) pay on pay.booking_id = bk.id
left join (
  select r.booking_id, sum(r.amount) as total_refunded
  from public.data_pelanggan_refund r
  group by r.booking_id
) rfd on rfd.booking_id = bk.id
left join (
  select e.booking_id, sum(e.amount) as total_expenses
  from public.pengeluaran e
  where e.voided_at is null and e.booking_id is not null
  group by e.booking_id
) exp on exp.booking_id = bk.id
where bk.deleted_at is null;

-- -----------------------------------------------------------------------------
-- 11. TRIGGER & INDEX
-- -----------------------------------------------------------------------------
drop trigger if exists profil_bisnis_updated_at on public.profil_bisnis;
create trigger profil_bisnis_updated_at before update on public.profil_bisnis for each row execute function public.set_updated_at();

drop trigger if exists pengaturan_dropdown_updated_at on public.pengaturan_dropdown;
create trigger pengaturan_dropdown_updated_at before update on public.pengaturan_dropdown for each row execute function public.set_updated_at();

drop trigger if exists pengaturan_karyawan_updated_at on public.pengaturan_karyawan;
create trigger pengaturan_karyawan_updated_at before update on public.pengaturan_karyawan for each row execute function public.set_updated_at();

drop trigger if exists data_pelanggan_updated_at on public.data_pelanggan;
create trigger data_pelanggan_updated_at before update on public.data_pelanggan for each row execute function public.set_updated_at();

drop trigger if exists data_pelanggan_booking_updated_at on public.data_pelanggan_booking;
create trigger data_pelanggan_booking_updated_at before update on public.data_pelanggan_booking for each row execute function public.set_updated_at();

drop trigger if exists penugasan_tim_updated_at on public.penugasan_tim;
create trigger penugasan_tim_updated_at before update on public.penugasan_tim for each row execute function public.set_updated_at();

drop trigger if exists katalog_jasa_updated_at on public.katalog_jasa;
create trigger katalog_jasa_updated_at before update on public.katalog_jasa for each row execute function public.set_updated_at();

drop trigger if exists inventaris_barang_updated_at on public.inventaris_barang;
create trigger inventaris_barang_updated_at before update on public.inventaris_barang for each row execute function public.set_updated_at();

drop trigger if exists portal_pernikahan_busana_updated_at on public.portal_pernikahan_busana;
create trigger portal_pernikahan_busana_updated_at before update on public.portal_pernikahan_busana for each row execute function public.set_updated_at();

drop trigger if exists portal_pernikahan_fitting_updated_at on public.portal_pernikahan_fitting;
create trigger portal_pernikahan_fitting_updated_at before update on public.portal_pernikahan_fitting for each row execute function public.set_updated_at();

drop trigger if exists portal_pernikahan_acara_updated_at on public.portal_pernikahan_acara;
create trigger portal_pernikahan_acara_updated_at before update on public.portal_pernikahan_acara for each row execute function public.set_updated_at();

create index if not exists idx_booking_customer on public.data_pelanggan_booking(customer_id);
create index if not exists idx_booking_event_date on public.data_pelanggan_booking(event_date) where deleted_at is null;
create index if not exists idx_pesanan_booking on public.pesanan(booking_id) where cancelled_at is null;
create index if not exists idx_faktur_booking on public.faktur_tagihan(booking_id) where cancelled_at is null;
create index if not exists idx_pembayaran_booking on public.pembayaran(booking_id, paid_at) where voided_at is null;
create index if not exists idx_pengeluaran_date on public.pengeluaran(expense_date) where voided_at is null;
create index if not exists idx_mutasi_item_date on public.inventaris_mutasi_stok(inventory_item_id, movement_date);
create index if not exists idx_busana_status on public.portal_pernikahan_busana(category, status) where is_active;
create index if not exists idx_dropdown_group on public.pengaturan_dropdown(option_group, sort_order) where is_active;

-- -----------------------------------------------------------------------------
-- 12. RLS POLICIES & PERMISSIONS (LANGSUNG JALAN DENGAN PUBLISHABLE KEY)
-- Catatan: Jika suatu saat menambah Login Supabase Auth, ganti `using (true)` dengan `public.is_active_app_user()`.
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'profil_bisnis','pengaturan_dropdown','pengaturan_karyawan','pengaturan_penomoran','pengaturan_file',
    'data_pelanggan','data_pelanggan_booking','data_pelanggan_refund',
    'penugasan_tim','penugasan_tim_anggota',
    'katalog_jasa','pesanan','pesanan_detail','faktur_tagihan','faktur_tagihan_detail','pembayaran',
    'portal_pernikahan_busana','portal_pernikahan_fitting','portal_pernikahan_acara',
    'pengeluaran',
    'inventaris_barang','inventaris_barang_masuk','inventaris_barang_masuk_detail',
    'inventaris_barang_keluar','inventaris_barang_keluar_detail',
    'inventaris_stok_opname','inventaris_stok_opname_detail','inventaris_mutasi_stok',
    'laporan_log_aktivitas'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_public_access', tbl);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
      tbl || '_public_access',
      tbl
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 13. SEED DEFAULT PENGATURAN DROPDOWN & PROFIL BISNIS
-- -----------------------------------------------------------------------------
insert into public.pengaturan_dropdown (option_group, label, sort_order) values
  ('paymentMethods', 'Tunai', 1),
  ('paymentMethods', 'Transfer', 2),
  ('paymentMethods', 'QRIS', 3),
  ('paymentMethods', 'Lainnya', 4),
  ('poExpenseCategories', 'Transportasi', 1),
  ('poExpenseCategories', 'Honor Tim', 2),
  ('poExpenseCategories', 'Akomodasi', 3),
  ('poExpenseCategories', 'Perlengkapan', 4),
  ('poExpenseCategories', 'Operasional', 5),
  ('generalExpenseCategories', 'Operasional', 1),
  ('generalExpenseCategories', 'Perlengkapan', 2),
  ('generalExpenseCategories', 'Akomodasi', 3),
  ('generalExpenseCategories', 'Transportasi', 4),
  ('generalExpenseCategories', 'Honor Tim', 5)
on conflict (option_group, label) do nothing;

insert into public.profil_bisnis (id, name, tagline, phone, email, address, invoice_note)
values (
  '10000000-0000-4000-8000-000000000001',
  'AZURA',
  'MAKEUP ARTIST',
  '0812 9000 2026',
  'hello@azuramakeup.id',
  'Jakarta Selatan, DKI Jakarta',
  'Terima kasih telah mempercayakan momen spesial Anda kepada Azura Makeup Studio.'
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 14. REALTIME PUBLICATION
-- -----------------------------------------------------------------------------
do $$
declare
  rt_table text;
begin
  foreach rt_table in array array[
    'data_pelanggan','data_pelanggan_booking','data_pelanggan_refund',
    'pesanan','faktur_tagihan','pembayaran','pengeluaran',
    'penugasan_tim','penugasan_tim_anggota','pengaturan_karyawan','pengaturan_dropdown',
    'portal_pernikahan_busana','portal_pernikahan_fitting','portal_pernikahan_acara',
    'inventaris_barang','inventaris_mutasi_stok','inventaris_stok_opname'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = rt_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', rt_table);
    end if;
  end loop;
end $$;
