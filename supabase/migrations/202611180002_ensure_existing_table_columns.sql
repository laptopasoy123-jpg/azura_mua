-- Incremental alignment for EXISTING Supabase tables:
-- Run this in Supabase SQL Editor if base tables already existed before adding new columns.

alter type public.file_purpose add value if not exists 'business-logo';
alter type public.stock_movement_type add value if not exists 'opname';

alter table public.business_profiles
  add column if not exists tagline text not null default 'MAKEUP ARTIST',
  add column if not exists logo_url text;

alter table public.bookings
  add column if not exists styling_type text check (styling_type in ('Hijabdo', 'Hairdo')),
  add column if not exists cancelled_paid_amount bigint not null default 0;

alter table public.orders
  add column if not exists order_date date not null default current_date;

alter table public.invoice_items
  add column if not exists order_group_id uuid references public.orders(id) on delete set null,
  add column if not exists order_date date,
  add column if not exists service_type public.catalog_type;

alter table public.expenses
  add column if not exists expense_scope text not null default 'Berdasarkan PO'
    check (expense_scope in ('Berdasarkan PO', 'Di Luar PO')),
  add column if not exists proof_url text;

alter table public.catalog_items
  add column if not exists image_url text;

alter table public.wedding_attire
  add column if not exists image_url text;

alter table public.wedding_event_details
  add column if not exists time_note text;

alter table public.booking_refunds
  add column if not exists proof_url text;

alter table public.stock_in
  add column if not exists proof_url text;

alter table public.stock_out
  add column if not exists proof_file_id uuid references public.file_objects(id) on delete set null,
  add column if not exists proof_url text;

alter table public.stock_movements
  add column if not exists opname_id uuid references public.stock_opnames(id) on delete set null;

do $$ begin
  alter table public.payments alter column method type text using method::text;
exception when others then null;
end $$;

do $$ begin
  alter table public.booking_refunds alter column method type text using method::text;
exception when others then null;
end $$;
