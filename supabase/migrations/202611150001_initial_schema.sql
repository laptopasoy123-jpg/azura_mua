create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('owner', 'admin', 'finance', 'inventory', 'viewer');
create type public.booking_status as enum ('draft', 'confirmed', 'completed', 'cancelled');
create type public.catalog_type as enum ('core', 'additional');
create type public.order_type as enum ('initial', 'additional');
create type public.payment_method as enum ('cash', 'transfer', 'qris', 'other');
create type public.stock_movement_type as enum ('in', 'out', 'adjustment');
create type public.file_purpose as enum ('catalog', 'payment-proof', 'expense-proof', 'inventory', 'avatar', 'business-asset');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) >= 2),
  phone text,
  role public.app_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  logo_file_id uuid,
  invoice_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_counters (
  counter_key text not null,
  counter_year integer not null,
  value bigint not null default 0,
  primary key (counter_key, counter_year)
);

create or replace function public.next_business_code(p_counter_key text, p_prefix text, p_year integer default extract(year from current_date)::integer)
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

create table public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  phone text not null check (length(trim(phone)) >= 8),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  po_number text not null unique default public.next_business_code('booking', 'PO'),
  customer_id uuid not null references public.customers(id) on delete restrict,
  event_location text not null,
  event_date date not null,
  event_time time,
  event_address text,
  notes text,
  status public.booking_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.catalog_items (
  id uuid primary key default extensions.gen_random_uuid(),
  catalog_code text not null unique default public.next_business_code('catalog', 'CAT'),
  name text not null,
  type public.catalog_type not null,
  description text,
  catalog_price bigint not null check (catalog_price >= 0),
  unit text not null,
  image_file_id uuid,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  type public.order_type not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create table public.order_items (
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

create table public.invoices (
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

create table public.invoice_items (
  id uuid primary key default extensions.gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  source_order_item_id uuid references public.order_items(id) on delete restrict,
  service_name_snapshot text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0),
  unit_snapshot text not null,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  payment_number text not null unique default public.next_business_code('payment', 'PAY'),
  receipt_number text not null unique default public.next_business_code('receipt', 'KWT'),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  paid_at timestamptz not null,
  method public.payment_method not null,
  amount bigint not null check (amount > 0),
  proof_file_id uuid,
  notes text,
  idempotency_key uuid not null unique,
  billing_snapshot bigint not null check (billing_snapshot >= 0),
  cumulative_paid_snapshot bigint not null check (cumulative_paid_snapshot >= 0),
  balance_snapshot bigint not null check (balance_snapshot >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

create table public.payment_allocations (
  id uuid primary key default extensions.gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, invoice_id)
);

create table public.expenses (
  id uuid primary key default extensions.gen_random_uuid(),
  expense_number text not null unique default public.next_business_code('expense', 'EXP'),
  expense_date date not null,
  expense_type text not null,
  category text not null,
  booking_id uuid references public.bookings(id) on delete restrict,
  description text not null,
  amount bigint not null check (amount > 0),
  payment_method text not null,
  proof_file_id uuid,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

create table public.inventory_items (
  id uuid primary key default extensions.gen_random_uuid(),
  item_code text not null unique default public.next_business_code('inventory-item', 'BRG'),
  name text not null,
  category text not null,
  brand_spec text,
  unit text not null,
  initial_quantity numeric(14, 3) not null default 0 check (initial_quantity >= 0),
  minimum_stock numeric(14, 3) not null default 0 check (minimum_stock >= 0),
  storage_location text,
  image_file_id uuid,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stock_in (
  id uuid primary key default extensions.gen_random_uuid(),
  transaction_number text not null unique default public.next_business_code('stock-in', 'IN'),
  transaction_date date not null,
  pic_name text not null check (length(trim(pic_name)) > 0),
  supplier text,
  notes text,
  proof_file_id uuid,
  idempotency_key uuid not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

create table public.stock_in_items (
  id uuid primary key default extensions.gen_random_uuid(),
  stock_in_id uuid not null references public.stock_in(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(14, 3) not null check (quantity > 0),
  unique (stock_in_id, inventory_item_id)
);

create table public.stock_out (
  id uuid primary key default extensions.gen_random_uuid(),
  transaction_number text not null unique default public.next_business_code('stock-out', 'OUT'),
  transaction_date date not null,
  pic_name text not null check (length(trim(pic_name)) > 0),
  purpose text not null,
  notes text,
  idempotency_key uuid not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

create table public.stock_out_items (
  id uuid primary key default extensions.gen_random_uuid(),
  stock_out_id uuid not null references public.stock_out(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(14, 3) not null check (quantity > 0),
  unique (stock_out_id, inventory_item_id)
);

create table public.stock_movements (
  id uuid primary key default extensions.gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type public.stock_movement_type not null,
  quantity numeric(14, 3) not null check (quantity <> 0),
  stock_in_item_id uuid unique references public.stock_in_items(id) on delete restrict,
  stock_out_item_id uuid unique references public.stock_out_items(id) on delete restrict,
  movement_date date not null,
  pic_name text not null,
  notes text,
  created_at timestamptz not null default now(),
  check (
    (movement_type = 'in' and quantity > 0 and stock_in_item_id is not null and stock_out_item_id is null)
    or (movement_type = 'out' and quantity < 0 and stock_out_item_id is not null and stock_in_item_id is null)
    or (movement_type = 'adjustment' and stock_in_item_id is null and stock_out_item_id is null)
  )
);

create table public.file_objects (
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

alter table public.business_profiles add constraint business_profiles_logo_file_fk foreign key (logo_file_id) references public.file_objects(id) on delete set null;
alter table public.catalog_items add constraint catalog_items_image_file_fk foreign key (image_file_id) references public.file_objects(id) on delete set null;
alter table public.payments add constraint payments_proof_file_fk foreign key (proof_file_id) references public.file_objects(id) on delete set null;
alter table public.expenses add constraint expenses_proof_file_fk foreign key (proof_file_id) references public.file_objects(id) on delete set null;
alter table public.inventory_items add constraint inventory_items_image_file_fk foreign key (image_file_id) references public.file_objects(id) on delete set null;
alter table public.stock_in add constraint stock_in_proof_file_fk foreign key (proof_file_id) references public.file_objects(id) on delete set null;

create table public.audit_logs (
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

create view public.invoice_totals with (security_invoker = true) as
select i.id as invoice_id,
       coalesce(sum(ii.quantity * ii.unit_price), 0)::bigint as total,
       coalesce((select sum(pa.amount) from public.payment_allocations pa where pa.invoice_id = i.id), 0)::bigint as paid
from public.invoices i
left join public.invoice_items ii on ii.invoice_id = i.id
where i.cancelled_at is null
group by i.id;

create view public.inventory_balances with (security_invoker = true) as
select item.id as inventory_item_id,
       item.initial_quantity + coalesce(sum(m.quantity), 0) as available_stock,
       item.minimum_stock
from public.inventory_items item
left join public.stock_movements m on m.inventory_item_id = item.id
group by item.id, item.initial_quantity, item.minimum_stock;

create or replace function public.enforce_allocation_booking()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare payment_booking uuid; invoice_booking uuid;
begin
  select booking_id into payment_booking from public.payments where id = new.payment_id;
  select booking_id into invoice_booking from public.invoices where id = new.invoice_id;
  if payment_booking is distinct from invoice_booking then raise exception 'Payment and invoice must belong to the same booking'; end if;
  return new;
end; $$;
create trigger payment_allocation_same_booking before insert or update on public.payment_allocations for each row execute function public.enforce_allocation_booking();

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();
create trigger catalog_items_updated_at before update on public.catalog_items for each row execute function public.set_updated_at();
create trigger inventory_items_updated_at before update on public.inventory_items for each row execute function public.set_updated_at();

create index bookings_customer_idx on public.bookings(customer_id);
create index bookings_event_date_idx on public.bookings(event_date) where deleted_at is null;
create index orders_booking_idx on public.orders(booking_id) where cancelled_at is null;
create index invoices_booking_idx on public.invoices(booking_id) where cancelled_at is null;
create index payments_booking_paid_at_idx on public.payments(booking_id, paid_at) where voided_at is null;
create index expenses_date_idx on public.expenses(expense_date) where voided_at is null;
create index stock_movements_item_date_idx on public.stock_movements(inventory_item_id, movement_date);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);

create or replace function public.is_active_app_user()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active);
$$;

grant execute on function public.is_active_app_user() to authenticated;

alter table public.profiles enable row level security;
alter table public.business_profiles enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.catalog_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.expenses enable row level security;
alter table public.inventory_items enable row level security;
alter table public.stock_in enable row level security;
alter table public.stock_in_items enable row level security;
alter table public.stock_out enable row level security;
alter table public.stock_out_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.file_objects enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read_active on public.profiles for select to authenticated using (public.is_active_app_user());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid() and public.is_active_app_user()) with check (id = auth.uid());

do $$
declare table_name text;
begin
  foreach table_name in array array['business_profiles','customers','bookings','catalog_items','orders','order_items','invoices','invoice_items','payments','payment_allocations','expenses','inventory_items','stock_in','stock_in_items','stock_out','stock_out_items','stock_movements','file_objects','audit_logs']
  loop
    execute format('create policy %I on public.%I for all to authenticated using (public.is_active_app_user()) with check (public.is_active_app_user())', table_name || '_active_user', table_name);
  end loop;
end $$;

alter publication supabase_realtime add table public.bookings, public.invoices, public.payments, public.inventory_items, public.stock_movements, public.audit_logs;
