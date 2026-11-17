alter type public.file_purpose add value if not exists 'wedding-attire';

create type public.attire_category as enum ('bride', 'groom');
create type public.attire_status as enum ('available', 'booked', 'laundry');

create table public.wedding_attire (
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

create table public.wedding_fitting_forms (
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

create table public.wedding_event_details (
  id uuid primary key default extensions.gen_random_uuid(),
  fitting_form_id uuid not null references public.wedding_fitting_forms(id) on delete cascade,
  event_number smallint not null check (event_number between 1 and 3),
  event_name text,
  ready_time time,
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

create index wedding_attire_status_idx on public.wedding_attire(category, status) where is_active;
create index wedding_event_bride_attire_idx on public.wedding_event_details(bride_attire_id) where bride_attire_id is not null;
create index wedding_event_groom_attire_idx on public.wedding_event_details(groom_attire_id) where groom_attire_id is not null;

create trigger wedding_attire_updated_at before update on public.wedding_attire for each row execute function public.set_updated_at();
create trigger wedding_fitting_forms_updated_at before update on public.wedding_fitting_forms for each row execute function public.set_updated_at();
create trigger wedding_event_details_updated_at before update on public.wedding_event_details for each row execute function public.set_updated_at();

alter table public.wedding_attire enable row level security;
alter table public.wedding_fitting_forms enable row level security;
alter table public.wedding_event_details enable row level security;

create policy wedding_attire_active_user on public.wedding_attire for all to authenticated
using (public.is_active_app_user()) with check (public.is_active_app_user());
create policy wedding_fitting_forms_active_user on public.wedding_fitting_forms for all to authenticated
using (public.is_active_app_user()) with check (public.is_active_app_user());
create policy wedding_event_details_active_user on public.wedding_event_details for all to authenticated
using (public.is_active_app_user()) with check (public.is_active_app_user());

alter publication supabase_realtime add table public.wedding_attire, public.wedding_fitting_forms, public.wedding_event_details;
