-- =============================================================================
-- AZURA MAKEUP ARTIST (Powered by DaySheet.id)
-- COMPLETE SUPABASE SCHEMA (ALL TABS) — READY TO PASTE IN SUPABASE SQL EDITOR
-- Covers:
--   1. Auth & Profil Bisnis + Upload Logo (profiles, business_profiles, business_counters, file_objects)
--   2. Pengaturan Dropdown (app_dropdown_options, employees)
--   3. Data Pelanggan & Batal PO + Refund (customers, bookings, booking_refunds)
--   4. Portal Pernikahan: Inventaris Busana, Form Fitting, Jadwal Busana (wedding_attire, wedding_fitting_forms, wedding_event_details)
--   5. Pesanan, Layanan Tambahan & Katalog Jasa (catalog_items, orders, order_items)
--   6. Penugasan Job Karyawan (employees, booking_job_assignments, booking_job_employees)
--   7. Faktur Tagihan & Pembayaran / Kwitansi (invoices, invoice_items, payments, payment_allocations)
--   8. Pengeluaran Operasional & PO (expenses)
--   9. Inventaris Barang, Masuk/Keluar Batch & Stok Opname (inventory_items, stock_in, stock_in_items, stock_out, stock_out_items, stock_opnames, stock_opname_items, stock_movements)
--  10. Laporan & Audit Log (audit_logs, views: invoice_totals, inventory_balances, po_financial_summary)
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- -----------------------------------------------------------------------------
do $$ begin create type public.app_role as enum ('owner', 'admin', 'finance', 'inventory', 'viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.booking_status as enum ('draft', 'confirmed', 'completed', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.catalog_type as enum ('core', 'additional'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_type as enum ('initial', 'additional'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_method as enum ('cash', 'transfer', 'qris', 'other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.stock_movement_type as enum ('in', 'out', 'adjustment', 'opname'); exception when duplicate_object then null; end $$;
do $$ begin create type public.file_purpose as enum ('catalog', 'payment-proof', 'expense-proof', 'inventory', 'avatar', 'business-asset', 'wedding-attire', 'business-logo'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attire_category as enum ('bride', 'groom'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attire_status as enum ('available', 'booked', 'laundry'); exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2. SHARED UTILITY FUNCTIONS & COUNTERS
-- -----------------------------------------------------------------------------
create table if not exists public.business_counters (
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
  insert into public.business_counters(counter_key, counter_year, value)
  values (p_counter_key, p_year, 1)
  on conflict (counter_key, counter_year)
  do update set value = public.business_counters.value + 1
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
-- 3. AUTH PROFILES, FILE OBJECTS & PENGATURAN PROFIL BISNIS / DROPDOWN
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

create table if not exists public.file_objects (
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

create table if not exists public.business_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null default 'AZURA',
  tagline text not null default 'MAKEUP ARTIST',
  phone text,
  email text,
  address text,
  logo_file_id uuid references public.file_objects(id) on delete set null,
  invoice_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_dropdown_options (
  id uuid primary key default extensions.gen_random_uuid(),
  option_group text not null check (option_group in ('paymentMethods', 'poExpenseCategories', 'generalExpenseCategories')),
  label text not null check (length(trim(label)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (option_group, label)
);

-- Tab Penugasan Job & Pengaturan Karyawan
create table if not exists public.employees (
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
-- 4. DATA PELANGGAN & BOOKING PO + REFUND PEMBATALAN
-- -----------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  phone text not null check (length(trim(phone)) >= 8),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  po_number text not null unique default public.next_business_code('booking', 'PO'),
  customer_id uuid not null references public.customers(id) on delete restrict,
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

create table if not exists public.booking_refunds (
  id uuid primary key default extensions.gen_random_uuid(),
  refund_number text not null unique default public.next_business_code('booking-refund', 'RFD'),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  refund_date date not null,
  amount bigint not null check (amount > 0),
  method text not null,
  proof_file_id uuid references public.file_objects(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Tab Penugasan Job Karyawan
create table if not exists public.booking_job_assignments (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_job_employees (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (booking_id, employee_id)
);

-- -----------------------------------------------------------------------------
-- 5. KATALOG JASA, PESANAN & LAYANAN TAMBAHAN, FAKTUR, PEMBAYARAN
-- -----------------------------------------------------------------------------
create table if not exists public.catalog_items (
  id uuid primary key default extensions.gen_random_uuid(),
  catalog_code text not null unique default public.next_business_code('catalog', 'CAT'),
  name text not null,
  type public.catalog_type not null,
  description text,
  catalog_price bigint not null check (catalog_price >= 0),
  unit text not null,
  image_file_id uuid references public.file_objects(id) on delete set null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  type public.order_type not null,
  order_date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  catalog_item_id uuid references public.catalog_items(id) on delete restrict,
  service_name_snapshot text not null,
  catalog_price_snapshot bigint not null check (catalog_price_snapshot >= 0),
  customer_price bigint not null check (customer_price >= 0),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_snapshot text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default extensions.gen_random_uuid(),
  invoice_number text not null unique default public.next_business_code('invoice', 'INV'),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  invoice_date date not null default current_date,
  due_date date,
  notes text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default extensions.gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  source_order_item_id uuid references public.order_items(id) on delete restrict,
  order_group_id uuid references public.orders(id) on delete set null,
  order_date date,
  service_type public.catalog_type,
  service_name_snapshot text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0),
  unit_snapshot text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  payment_number text not null unique default public.next_business_code('payment', 'PAY'),
  receipt_number text not null unique default public.next_business_code('receipt', 'KWT'),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  paid_at timestamptz not null,
  method text not null,
  amount bigint not null check (amount > 0),
  proof_file_id uuid references public.file_objects(id) on delete set null,
  notes text,
  idempotency_key uuid not null unique,
  billing_snapshot bigint not null check (billing_snapshot >= 0),
  cumulative_paid_snapshot bigint not null check (cumulative_paid_snapshot >= 0),
  balance_snapshot bigint not null check (balance_snapshot >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

create table if not exists public.payment_allocations (
  id uuid primary key default extensions.gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, invoice_id)
);

-- -----------------------------------------------------------------------------
-- 6. PORTAL PERNIKAHAN (INVENTARIS BUSANA, FORM FITTING, DETAIL ACARA)
-- -----------------------------------------------------------------------------
create table if not exists public.wedding_attire (
  id uuid primary key default extensions.gen_random_uuid(),
  attire_code text not null unique default public.next_business_code('wedding-attire', 'BTR'),
  name text not null check (length(trim(name)) >= 2),
  category public.attire_category not null,
  size text not null check (length(trim(size)) > 0),
  status public.attire_status not null default 'available',
  photo_file_id uuid references public.file_objects(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wedding_fitting_forms (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
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

create table if not exists public.wedding_event_details (
  id uuid primary key default extensions.gen_random_uuid(),
  fitting_form_id uuid not null references public.wedding_fitting_forms(id) on delete cascade,
  event_number smallint not null check (event_number between 1 and 3),
  event_name text,
  ready_time time,
  time_note text,
  bride_attire_id uuid references public.wedding_attire(id) on delete restrict,
  bride_look text,
  bride_accessories text,
  bride_shoes text,
  groom_attire_id uuid references public.wedding_attire(id) on delete restrict,
  groom_look text,
  groom_accessories text,
  groom_shoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fitting_form_id, event_number)
);

-- -----------------------------------------------------------------------------
-- 7. PENGELUARAN
-- -----------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default extensions.gen_random_uuid(),
  expense_number text not null unique default public.next_business_code('expense', 'EXP'),
  expense_date date not null,
  expense_scope text not null default 'Berdasarkan PO' check (expense_scope in ('Berdasarkan PO', 'Di Luar PO')),
  expense_type text not null,
  category text not null,
  booking_id uuid references public.bookings(id) on delete restrict,
  description text not null,
  amount bigint not null check (amount > 0),
  payment_method text not null,
  proof_file_id uuid references public.file_objects(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

-- -----------------------------------------------------------------------------
-- 8. INVENTARIS BARANG (KATALOG, BARANG MASUK/KELUAR BATCH, STOK OPNAME)
-- -----------------------------------------------------------------------------
create table if not exists public.inventory_items (
  id uuid primary key default extensions.gen_random_uuid(),
  item_code text not null unique default public.next_business_code('inventory-item', 'BRG'),
  name text not null,
  category text not null,
  brand_spec text,
  unit text not null,
  initial_quantity numeric(14, 3) not null default 0 check (initial_quantity >= 0),
  minimum_stock numeric(14, 3) not null default 0 check (minimum_stock >= 0),
  storage_location text,
  image_file_id uuid references public.file_objects(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_in (
  id uuid primary key default extensions.gen_random_uuid(),
  transaction_number text not null unique default public.next_business_code('stock-in', 'IN'),
  transaction_date date not null,
  pic_name text not null check (length(trim(pic_name)) > 0),
  supplier text,
  notes text,
  proof_file_id uuid references public.file_objects(id) on delete set null,
  idempotency_key uuid not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

create table if not exists public.stock_in_items (
  id uuid primary key default extensions.gen_random_uuid(),
  stock_in_id uuid not null references public.stock_in(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(14, 3) not null check (quantity > 0),
  unique (stock_in_id, inventory_item_id)
);

create table if not exists public.stock_out (
  id uuid primary key default extensions.gen_random_uuid(),
  transaction_number text not null unique default public.next_business_code('stock-out', 'OUT'),
  transaction_date date not null,
  pic_name text not null check (length(trim(pic_name)) > 0),
  purpose text not null,
  notes text,
  proof_file_id uuid references public.file_objects(id) on delete set null,
  idempotency_key uuid not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

create table if not exists public.stock_out_items (
  id uuid primary key default extensions.gen_random_uuid(),
  stock_out_id uuid not null references public.stock_out(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(14, 3) not null check (quantity > 0),
  unique (stock_out_id, inventory_item_id)
);

create table if not exists public.stock_opnames (
  id uuid primary key default extensions.gen_random_uuid(),
  opname_number text not null unique default public.next_business_code('stock-opname', 'SO'),
  opname_date date not null,
  pic_name text not null check (length(trim(pic_name)) > 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_opname_items (
  id uuid primary key default extensions.gen_random_uuid(),
  opname_id uuid not null references public.stock_opnames(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  system_stock numeric(14, 3) not null,
  physical_stock numeric(14, 3) not null check (physical_stock >= 0),
  diff_quantity numeric(14, 3) not null,
  notes text,
  unique (opname_id, inventory_item_id)
);

create table if not exists public.stock_movements (
  id uuid primary key default extensions.gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type public.stock_movement_type not null,
  quantity numeric(14, 3) not null check (quantity <> 0),
  stock_in_item_id uuid unique references public.stock_in_items(id) on delete restrict,
  stock_out_item_id uuid unique references public.stock_out_items(id) on delete restrict,
  opname_id uuid references public.stock_opnames(id) on delete set null,
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
-- 9. AUDIT LOGS & REPORTING VIEWS
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
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

create or replace view public.invoice_totals with (security_invoker = true) as
select
  i.id as invoice_id,
  coalesce(sum(ii.quantity * ii.unit_price), 0)::bigint as total,
  coalesce((select sum(pa.amount) from public.payment_allocations pa where pa.invoice_id = i.id), 0)::bigint as paid
from public.invoices i
left join public.invoice_items ii on ii.invoice_id = i.id
where i.cancelled_at is null
group by i.id;

create or replace view public.inventory_balances with (security_invoker = true) as
select
  item.id as inventory_item_id,
  item.initial_quantity + coalesce(sum(m.quantity), 0) as available_stock,
  item.minimum_stock
from public.inventory_items item
left join public.stock_movements m on m.inventory_item_id = item.id
group by item.id, item.initial_quantity, item.minimum_stock;

create or replace view public.po_financial_summary with (security_invoker = true) as
select
  b.id as booking_id,
  b.po_number,
  b.status as booking_status,
  b.event_date,
  c.id as customer_id,
  c.name as customer_name,
  c.phone as customer_phone,
  coalesce(inv.total_billing, 0)::bigint as total_billing,
  coalesce(pay.total_paid, 0)::bigint as total_paid,
  greatest(coalesce(inv.total_billing, 0) - coalesce(pay.total_paid, 0), 0)::bigint as remaining_balance,
  coalesce(rfd.total_refunded, 0)::bigint as total_refunded,
  coalesce(exp.total_expenses, 0)::bigint as total_expenses
from public.bookings b
join public.customers c on c.id = b.customer_id
left join (
  select i.booking_id, sum(ii.quantity * ii.unit_price) as total_billing
  from public.invoices i
  join public.invoice_items ii on ii.invoice_id = i.id
  where i.cancelled_at is null
  group by i.booking_id
) inv on inv.booking_id = b.id
left join (
  select p.booking_id, sum(p.amount) as total_paid
  from public.payments p
  where p.voided_at is null
  group by p.booking_id
) pay on pay.booking_id = b.id
left join (
  select r.booking_id, sum(r.amount) as total_refunded
  from public.booking_refunds r
  group by r.booking_id
) rfd on rfd.booking_id = b.id
left join (
  select e.booking_id, sum(e.amount) as total_expenses
  from public.expenses e
  where e.voided_at is null and e.booking_id is not null
  group by e.booking_id
) exp on exp.booking_id = b.id
where b.deleted_at is null;

-- -----------------------------------------------------------------------------
-- 10. TRIGGERS & INDEXES
-- -----------------------------------------------------------------------------
create or replace function public.enforce_allocation_booking()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare payment_booking uuid; invoice_booking uuid;
begin
  select booking_id into payment_booking from public.payments where id = new.payment_id;
  select booking_id into invoice_booking from public.invoices where id = new.invoice_id;
  if payment_booking is distinct from invoice_booking then
    raise exception 'Payment and invoice must belong to the same booking';
  end if;
  return new;
end; $$;

drop trigger if exists payment_allocation_same_booking on public.payment_allocations;
create trigger payment_allocation_same_booking
  before insert or update on public.payment_allocations
  for each row execute function public.enforce_allocation_booking();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists business_profiles_updated_at on public.business_profiles;
create trigger business_profiles_updated_at before update on public.business_profiles for each row execute function public.set_updated_at();

drop trigger if exists app_dropdown_options_updated_at on public.app_dropdown_options;
create trigger app_dropdown_options_updated_at before update on public.app_dropdown_options for each row execute function public.set_updated_at();

drop trigger if exists employees_updated_at on public.employees;
create trigger employees_updated_at before update on public.employees for each row execute function public.set_updated_at();

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();

drop trigger if exists booking_job_assignments_updated_at on public.booking_job_assignments;
create trigger booking_job_assignments_updated_at before update on public.booking_job_assignments for each row execute function public.set_updated_at();

drop trigger if exists catalog_items_updated_at on public.catalog_items;
create trigger catalog_items_updated_at before update on public.catalog_items for each row execute function public.set_updated_at();

drop trigger if exists inventory_items_updated_at on public.inventory_items;
create trigger inventory_items_updated_at before update on public.inventory_items for each row execute function public.set_updated_at();

drop trigger if exists wedding_attire_updated_at on public.wedding_attire;
create trigger wedding_attire_updated_at before update on public.wedding_attire for each row execute function public.set_updated_at();

drop trigger if exists wedding_fitting_forms_updated_at on public.wedding_fitting_forms;
create trigger wedding_fitting_forms_updated_at before update on public.wedding_fitting_forms for each row execute function public.set_updated_at();

drop trigger if exists wedding_event_details_updated_at on public.wedding_event_details;
create trigger wedding_event_details_updated_at before update on public.wedding_event_details for each row execute function public.set_updated_at();

create index if not exists bookings_customer_idx on public.bookings(customer_id);
create index if not exists bookings_event_date_idx on public.bookings(event_date) where deleted_at is null;
create index if not exists orders_booking_idx on public.orders(booking_id) where cancelled_at is null;
create index if not exists invoices_booking_idx on public.invoices(booking_id) where cancelled_at is null;
create index if not exists payments_booking_paid_at_idx on public.payments(booking_id, paid_at) where voided_at is null;
create index if not exists expenses_date_idx on public.expenses(expense_date) where voided_at is null;
create index if not exists stock_movements_item_date_idx on public.stock_movements(inventory_item_id, movement_date);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists wedding_attire_status_idx on public.wedding_attire(category, status) where is_active;
create index if not exists wedding_event_bride_attire_idx on public.wedding_event_details(bride_attire_id) where bride_attire_id is not null;
create index if not exists wedding_event_groom_attire_idx on public.wedding_event_details(groom_attire_id) where groom_attire_id is not null;
create index if not exists employees_active_idx on public.employees(active, name);
create index if not exists booking_job_employees_emp_idx on public.booking_job_employees(employee_id);
create index if not exists app_dropdown_options_group_idx on public.app_dropdown_options(option_group, sort_order) where is_active;

-- -----------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) & POLICIES
-- -----------------------------------------------------------------------------
create or replace function public.is_active_app_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active);
$$;

grant execute on function public.is_active_app_user() to authenticated;

alter table public.profiles enable row level security;
alter table public.business_profiles enable row level security;
alter table public.app_dropdown_options enable row level security;
alter table public.employees enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_refunds enable row level security;
alter table public.booking_job_assignments enable row level security;
alter table public.booking_job_employees enable row level security;
alter table public.catalog_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.wedding_attire enable row level security;
alter table public.wedding_fitting_forms enable row level security;
alter table public.wedding_event_details enable row level security;
alter table public.expenses enable row level security;
alter table public.inventory_items enable row level security;
alter table public.stock_in enable row level security;
alter table public.stock_in_items enable row level security;
alter table public.stock_out enable row level security;
alter table public.stock_out_items enable row level security;
alter table public.stock_opnames enable row level security;
alter table public.stock_opname_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.file_objects enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_read_active on public.profiles;
create policy profiles_read_active on public.profiles for select to authenticated using (public.is_active_app_user());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active_app_user()) with check (id = auth.uid());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'business_profiles','app_dropdown_options','employees','customers','bookings','booking_refunds',
    'booking_job_assignments','booking_job_employees','catalog_items','orders','order_items',
    'invoices','invoice_items','payments','payment_allocations','wedding_attire',
    'wedding_fitting_forms','wedding_event_details','expenses','inventory_items',
    'stock_in','stock_in_items','stock_out','stock_out_items','stock_opnames',
    'stock_opname_items','stock_movements','file_objects','audit_logs'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_active_user', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_active_app_user()) with check (public.is_active_app_user())',
      table_name || '_active_user',
      table_name
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 12. DEFAULT DROPDOWN & BUSINESS PROFILE SEED (SAFE IDEMPOTENT)
-- -----------------------------------------------------------------------------
insert into public.app_dropdown_options (option_group, label, sort_order) values
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

-- -----------------------------------------------------------------------------
-- 13. REALTIME PUBLICATION
-- -----------------------------------------------------------------------------
do $$
declare
  rt_table text;
begin
  foreach rt_table in array array[
    'bookings','invoices','payments','booking_refunds','inventory_items','stock_movements',
    'wedding_attire','wedding_fitting_forms','wedding_event_details',
    'employees','booking_job_assignments','booking_job_employees','app_dropdown_options','audit_logs'
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
