-- Align database schema with Wedding Portal, Booking styling type, and chronological Order Groups

alter table public.bookings
  add column if not exists styling_type text check (styling_type in ('Hijabdo', 'Hairdo'));

alter table public.wedding_event_details
  add column if not exists time_note text;

alter table public.orders
  add column if not exists order_date date not null default current_date;

alter table public.invoice_items
  add column if not exists order_date date,
  add column if not exists order_group_id uuid references public.orders(id) on delete set null,
  add column if not exists service_type public.catalog_type;

alter table public.stock_out
  add column if not exists proof_file_id uuid references public.file_objects(id) on delete set null;

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

alter table public.stock_opnames enable row level security;
alter table public.stock_opname_items enable row level security;

create policy stock_opnames_active_user on public.stock_opnames for all to authenticated
using (public.is_active_app_user()) with check (public.is_active_app_user());
create policy stock_opname_items_active_user on public.stock_opname_items for all to authenticated
using (public.is_active_app_user()) with check (public.is_active_app_user());

alter table public.bookings
  add column if not exists cancelled_paid_amount bigint not null default 0;

create table if not exists public.booking_refunds (
  id uuid primary key default extensions.gen_random_uuid(),
  refund_number text not null unique default public.next_business_code('booking-refund', 'RFD'),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  refund_date date not null,
  amount bigint not null check (amount > 0),
  method public.payment_method not null,
  proof_file_id uuid references public.file_objects(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.booking_refunds enable row level security;
create policy booking_refunds_active_user on public.booking_refunds for all to authenticated
using (public.is_active_app_user()) with check (public.is_active_app_user());
