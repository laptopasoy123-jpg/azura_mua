-- Incremental migration: align schema with ALL application tabs
-- Tabs covered: Pengaturan Dropdown & Profil Bisnis (+ Logo), Penugasan Job Karyawan,
-- Pembayaran/Refund metode dinamis, Pengeluaran (Berdasarkan PO / Di Luar PO), Inventaris Opname link.

alter type public.file_purpose add value if not exists 'business-logo';
alter type public.stock_movement_type add value if not exists 'opname';

alter table public.business_profiles
  add column if not exists tagline text not null default 'MAKEUP ARTIST';

alter table public.expenses
  add column if not exists expense_scope text not null default 'Berdasarkan PO'
    check (expense_scope in ('Berdasarkan PO', 'Di Luar PO'));

-- Convert payment method columns to text so configurable dropdown options (Tunai, Transfer, QRIS, custom) work seamlessly
alter table public.payments
  alter column method type text using method::text;

alter table public.booking_refunds
  alter column method type text using method::text;

-- Link stock opname ledger entries cleanly when opname is edited/deleted
alter table public.stock_movements
  add column if not exists opname_id uuid references public.stock_opnames(id) on delete set null;

-- Employees / Karyawan master list (Pengaturan Dropdown & Penugasan Job Karyawan)
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

-- Job assignment notes & timestamps per PO (Tab Penugasan Job)
create table if not exists public.booking_job_assignments (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Many-to-many assignment of karyawan to booking PO
create table if not exists public.booking_job_employees (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (booking_id, employee_id)
);

-- Configurable dropdown options (Metode Pembayaran, Kategori Pengeluaran PO, Kategori Pengeluaran Umum)
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

-- Default dropdown options seed
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

-- Updated_at triggers
drop trigger if exists business_profiles_updated_at on public.business_profiles;
create trigger business_profiles_updated_at before update on public.business_profiles for each row execute function public.set_updated_at();

drop trigger if exists employees_updated_at on public.employees;
create trigger employees_updated_at before update on public.employees for each row execute function public.set_updated_at();

drop trigger if exists booking_job_assignments_updated_at on public.booking_job_assignments;
create trigger booking_job_assignments_updated_at before update on public.booking_job_assignments for each row execute function public.set_updated_at();

drop trigger if exists app_dropdown_options_updated_at on public.app_dropdown_options;
create trigger app_dropdown_options_updated_at before update on public.app_dropdown_options for each row execute function public.set_updated_at();

-- Indexes
create index if not exists employees_active_idx on public.employees(active, name);
create index if not exists booking_job_employees_emp_idx on public.booking_job_employees(employee_id);
create index if not exists app_dropdown_options_group_idx on public.app_dropdown_options(option_group, sort_order) where is_active;

-- Summary view across all bookings (used by Dashboard, Database Customer, Pesanan, Faktur, Laporan)
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

-- RLS policies
alter table public.employees enable row level security;
alter table public.booking_job_assignments enable row level security;
alter table public.booking_job_employees enable row level security;
alter table public.app_dropdown_options enable row level security;

drop policy if exists employees_active_user on public.employees;
create policy employees_active_user on public.employees for all to authenticated
  using (public.is_active_app_user()) with check (public.is_active_app_user());

drop policy if exists booking_job_assignments_active_user on public.booking_job_assignments;
create policy booking_job_assignments_active_user on public.booking_job_assignments for all to authenticated
  using (public.is_active_app_user()) with check (public.is_active_app_user());

drop policy if exists booking_job_employees_active_user on public.booking_job_employees;
create policy booking_job_employees_active_user on public.booking_job_employees for all to authenticated
  using (public.is_active_app_user()) with check (public.is_active_app_user());

drop policy if exists app_dropdown_options_active_user on public.app_dropdown_options;
create policy app_dropdown_options_active_user on public.app_dropdown_options for all to authenticated
  using (public.is_active_app_user()) with check (public.is_active_app_user());

-- Realtime updates
alter publication supabase_realtime add table
  public.employees,
  public.booking_job_assignments,
  public.booking_job_employees,
  public.app_dropdown_options;
