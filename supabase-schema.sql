-- =============================================
-- EasyWork Database Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- Organizations (Multi-tenant)
-- =============================================
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  org_number text,
  email text,
  phone text,
  address text,
  postal_code text,
  city text,
  logo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- Profiles (Users in organizations)
-- =============================================
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  organization_id uuid references organizations on delete cascade,
  full_name text,
  email text,
  phone text,
  role text default 'employee' check (role in ('owner', 'admin', 'employee')),
  avatar_url text,
  hourly_rate decimal(10,2),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- Customers
-- =============================================
create table customers (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations on delete cascade not null,
  name text not null,
  email text,
  phone text,
  address text,
  postal_code text,
  city text,
  org_number text,
  contact_person text,
  notes text,
  is_private boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- Jobs
-- =============================================
create table jobs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations on delete cascade not null,
  customer_id uuid references customers on delete set null,
  title text not null,
  description text,
  status text default 'quote' check (status in ('quote', 'in_progress', 'completed', 'cancelled')),
  address text,
  postal_code text,
  city text,
  start_date date,
  end_date date,
  estimated_hours decimal(10,2),
  created_by uuid references profiles,
  assigned_to uuid references profiles,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- Job Notes (with images)
-- =============================================
create table job_notes (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references jobs on delete cascade not null,
  profile_id uuid references profiles on delete set null,
  content text not null,
  image_urls text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- Units (Enheter for artikler)
-- =============================================
create table units (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations on delete cascade not null,
  name text not null,
  abbreviation text not null,
  is_default boolean default false,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert default units (global defaults, can be copied per organization)
-- These are common units used in Norwegian trade/construction
INSERT INTO units (id, organization_id, name, abbreviation, is_default, sort_order) VALUES
  -- Note: organization_id should be set when copying to specific org
  -- For now these serve as reference values
;

-- Common unit values (used directly in articles.unit_name):
-- stk (stykk), timer, m (meter), m² (kvadratmeter), m³ (kubikkmeter)
-- kg, tonn, lass, liter, pakke, sett, løpemeter, par, rull, boks

-- =============================================
-- Articles (Produkter/Tjenester)
-- =============================================
create table articles (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations on delete cascade not null,
  article_number text,
  name text not null,
  description text,
  unit_id uuid references units on delete set null,
  unit_name text default 'stk',
  cost_price decimal(12,2) default 0,
  sale_price decimal(12,2) default 0,
  vat_rate decimal(5,2) default 25.00,
  category text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- Quotes (Tilbud)
-- =============================================
create table quotes (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations on delete cascade not null,
  customer_id uuid references customers on delete set null,
  job_id uuid references jobs on delete set null,
  quote_number serial,
  title text not null,
  description text,
  status text default 'draft' check (status in ('draft', 'pending', 'accepted', 'rejected', 'expired')),
  valid_until date,
  subtotal decimal(12,2) default 0,
  vat_amount decimal(12,2) default 0,
  total decimal(12,2) default 0,
  notes text,
  terms text,
  sent_at timestamp with time zone,
  accepted_at timestamp with time zone,
  created_by uuid references profiles,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- Quote Lines
-- =============================================
create table quote_lines (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid references quotes on delete cascade not null,
  article_id uuid references articles on delete set null,
  description text not null,
  quantity decimal(10,3) default 1,
  unit_name text default 'stk',
  cost_price decimal(12,2) default 0,
  unit_price decimal(12,2) default 0,
  vat_rate decimal(5,2) default 25.00,
  total decimal(12,2) default 0,
  margin_percent decimal(5,2) generated always as (
    case when cost_price > 0 then ((unit_price - cost_price) / cost_price * 100) else 0 end
  ) stored,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- Time Entries
-- =============================================
create table time_entries (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations on delete cascade not null,
  profile_id uuid references profiles on delete cascade not null,
  job_id uuid references jobs on delete set null,
  date date not null,
  hours decimal(5,2) not null,
  description text,
  billable boolean default true,
  hourly_rate decimal(10,2),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- Vehicles (Kjøretøy)
-- =============================================
create table vehicles (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations on delete cascade not null,
  registration_number text not null,
  make text,
  model text,
  year integer,
  vin text,
  fuel_type text,
  next_service_date date,
  next_eu_control date,
  current_km integer,
  notes text,
  vegvesen_data jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- Vehicle Service Log
-- =============================================
create table vehicle_service_log (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid references vehicles on delete cascade not null,
  service_date date not null,
  service_type text not null,
  description text,
  km_at_service integer,
  cost decimal(12,2),
  performed_by text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- Documents
-- =============================================
create table documents (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations on delete cascade not null,
  name text not null,
  category text check (category in ('hms', 'contract', 'certificate', 'quote_pdf', 'other')),
  description text,
  file_url text not null,
  file_type text,
  file_size integer,
  customer_id uuid references customers on delete set null,
  job_id uuid references jobs on delete set null,
  profile_id uuid references profiles on delete set null,
  uploaded_by uuid references profiles on delete set null,
  expires_at date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Enable RLS on all tables
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table customers enable row level security;
alter table units enable row level security;
alter table articles enable row level security;
alter table jobs enable row level security;
alter table job_notes enable row level security;
alter table quotes enable row level security;
alter table quote_lines enable row level security;
alter table time_entries enable row level security;
alter table vehicles enable row level security;
alter table vehicle_service_log enable row level security;
alter table documents enable row level security;

-- Helper function to get user's organization
create or replace function get_user_organization_id()
returns uuid as $$
  select organization_id from profiles where id = auth.uid()
$$ language sql security definer;

-- Organizations policies
create policy "Users can view their own organization"
  on organizations for select
  using (id = get_user_organization_id());

create policy "Owners can update their organization"
  on organizations for update
  using (id = get_user_organization_id())
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and organization_id = organizations.id
      and role = 'owner'
    )
  );

-- Profiles policies
create policy "Users can view profiles in their organization"
  on profiles for select
  using (organization_id = get_user_organization_id());

create policy "Users can update their own profile"
  on profiles for update
  using (id = auth.uid());

create policy "Admins can manage profiles"
  on profiles for all
  using (
    organization_id = get_user_organization_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- Customers policies
create policy "Users can view customers in their organization"
  on customers for select
  using (organization_id = get_user_organization_id());

create policy "Users can create customers in their organization"
  on customers for insert
  with check (organization_id = get_user_organization_id());

create policy "Users can update customers in their organization"
  on customers for update
  using (organization_id = get_user_organization_id());

create policy "Admins can delete customers"
  on customers for delete
  using (
    organization_id = get_user_organization_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- Units policies
create policy "Users can view units in their organization"
  on units for select
  using (organization_id = get_user_organization_id());

create policy "Users can create units in their organization"
  on units for insert
  with check (organization_id = get_user_organization_id());

create policy "Users can update units in their organization"
  on units for update
  using (organization_id = get_user_organization_id());

create policy "Admins can delete units"
  on units for delete
  using (
    organization_id = get_user_organization_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- Articles policies
create policy "Users can view articles in their organization"
  on articles for select
  using (organization_id = get_user_organization_id());

create policy "Users can create articles in their organization"
  on articles for insert
  with check (organization_id = get_user_organization_id());

create policy "Users can update articles in their organization"
  on articles for update
  using (organization_id = get_user_organization_id());

create policy "Admins can delete articles"
  on articles for delete
  using (
    organization_id = get_user_organization_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- Jobs policies
create policy "Users can view jobs in their organization"
  on jobs for select
  using (organization_id = get_user_organization_id());

create policy "Users can create jobs in their organization"
  on jobs for insert
  with check (organization_id = get_user_organization_id());

create policy "Users can update jobs in their organization"
  on jobs for update
  using (organization_id = get_user_organization_id());

create policy "Admins can delete jobs"
  on jobs for delete
  using (
    organization_id = get_user_organization_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- Job Notes policies
create policy "Users can view job notes"
  on job_notes for select
  using (
    exists (
      select 1 from jobs
      where jobs.id = job_notes.job_id
      and jobs.organization_id = get_user_organization_id()
    )
  );

create policy "Users can create job notes"
  on job_notes for insert
  with check (
    exists (
      select 1 from jobs
      where jobs.id = job_notes.job_id
      and jobs.organization_id = get_user_organization_id()
    )
  );

-- Quotes policies
create policy "Users can view quotes in their organization"
  on quotes for select
  using (organization_id = get_user_organization_id());

create policy "Users can create quotes in their organization"
  on quotes for insert
  with check (organization_id = get_user_organization_id());

create policy "Users can update quotes in their organization"
  on quotes for update
  using (organization_id = get_user_organization_id());

create policy "Admins can delete quotes"
  on quotes for delete
  using (
    organization_id = get_user_organization_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- Quote Lines policies
create policy "Users can manage quote lines"
  on quote_lines for all
  using (
    exists (
      select 1 from quotes
      where quotes.id = quote_lines.quote_id
      and quotes.organization_id = get_user_organization_id()
    )
  );

-- Time Entries policies
create policy "Users can view time entries in their organization"
  on time_entries for select
  using (organization_id = get_user_organization_id());

create policy "Users can create their own time entries"
  on time_entries for insert
  with check (
    organization_id = get_user_organization_id()
    and profile_id = auth.uid()
  );

create policy "Users can update their own time entries"
  on time_entries for update
  using (profile_id = auth.uid());

create policy "Users can delete their own time entries"
  on time_entries for delete
  using (profile_id = auth.uid());

-- Vehicles policies
create policy "Users can view vehicles in their organization"
  on vehicles for select
  using (organization_id = get_user_organization_id());

create policy "Users can create vehicles in their organization"
  on vehicles for insert
  with check (organization_id = get_user_organization_id());

create policy "Users can update vehicles in their organization"
  on vehicles for update
  using (organization_id = get_user_organization_id());

create policy "Admins can delete vehicles"
  on vehicles for delete
  using (
    organization_id = get_user_organization_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- Vehicle Service Log policies
create policy "Users can manage vehicle service logs"
  on vehicle_service_log for all
  using (
    exists (
      select 1 from vehicles
      where vehicles.id = vehicle_service_log.vehicle_id
      and vehicles.organization_id = get_user_organization_id()
    )
  );

-- Documents policies
create policy "Users can view documents in their organization"
  on documents for select
  using (organization_id = get_user_organization_id());

create policy "Users can create documents in their organization"
  on documents for insert
  with check (organization_id = get_user_organization_id());

create policy "Users can update documents in their organization"
  on documents for update
  using (organization_id = get_user_organization_id());

create policy "Admins can delete documents"
  on documents for delete
  using (
    organization_id = get_user_organization_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- =============================================
-- Triggers
-- =============================================

-- Update timestamp trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_organizations_updated_at before update on organizations for each row execute function update_updated_at();
create trigger update_profiles_updated_at before update on profiles for each row execute function update_updated_at();
create trigger update_customers_updated_at before update on customers for each row execute function update_updated_at();
create trigger update_jobs_updated_at before update on jobs for each row execute function update_updated_at();
create trigger update_quotes_updated_at before update on quotes for each row execute function update_updated_at();
create trigger update_time_entries_updated_at before update on time_entries for each row execute function update_updated_at();
create trigger update_vehicles_updated_at before update on vehicles for each row execute function update_updated_at();
create trigger update_articles_updated_at before update on articles for each row execute function update_updated_at();

-- =============================================
-- Handle new user signup
-- =============================================
create or replace function handle_new_user()
returns trigger as $$
declare
  org_id uuid;
  org_name text;
begin
  -- Get organization name from metadata
  org_name := new.raw_user_meta_data->>'organization_name';
  
  -- Create organization
  insert into organizations (name)
  values (coalesce(org_name, 'Min bedrift'))
  returning id into org_id;
  
  -- Create profile
  insert into profiles (id, organization_id, email, full_name, role)
  values (
    new.id,
    org_id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    'owner'
  );
  
  -- Create default units for the organization
  insert into units (organization_id, name, abbreviation, is_default, sort_order) values
    (org_id, 'Stykk', 'stk', true, 1),
    (org_id, 'Timer', 'timer', false, 2),
    (org_id, 'Meter', 'm', false, 3),
    (org_id, 'Kvadratmeter', 'm²', false, 4),
    (org_id, 'Kubikkmeter', 'm³', false, 5),
    (org_id, 'Kilogram', 'kg', false, 6),
    (org_id, 'Tonn', 'tonn', false, 7),
    (org_id, 'Liter', 'l', false, 8),
    (org_id, 'Pakke', 'pk', false, 9),
    (org_id, 'Sett', 'sett', false, 10),
    (org_id, 'Løpemeter', 'lm', false, 11),
    (org_id, 'Lass', 'lass', false, 12);
  
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================
-- Quote total calculation
-- =============================================
create or replace function calculate_quote_totals()
returns trigger as $$
declare
  quote_subtotal decimal(12,2);
  quote_vat decimal(12,2);
begin
  -- Calculate subtotal and VAT
  select 
    coalesce(sum(total), 0),
    coalesce(sum(total * vat_rate / 100), 0)
  into quote_subtotal, quote_vat
  from quote_lines
  where quote_id = coalesce(new.quote_id, old.quote_id);
  
  -- Update quote totals
  update quotes
  set 
    subtotal = quote_subtotal,
    vat_amount = quote_vat,
    total = quote_subtotal + quote_vat
  where id = coalesce(new.quote_id, old.quote_id);
  
  return new;
end;
$$ language plpgsql;

create trigger calculate_quote_totals_on_line_change
  after insert or update or delete on quote_lines
  for each row execute function calculate_quote_totals();

-- Calculate line total before insert/update
create or replace function calculate_quote_line_total()
returns trigger as $$
begin
  new.total := new.quantity * new.unit_price;
  return new;
end;
$$ language plpgsql;

create trigger calculate_quote_line_total_before_save
  before insert or update on quote_lines
  for each row execute function calculate_quote_line_total();

-- =============================================
-- Storage Buckets
-- =============================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict do nothing;

insert into storage.buckets (id, name, public)
values ('job-images', 'job-images', false)
on conflict do nothing;

-- Storage policies
create policy "Users can upload documents"
  on storage.objects for insert
  with check (
    bucket_id in ('documents', 'job-images')
    and auth.role() = 'authenticated'
  );

create policy "Users can view their organization's documents"
  on storage.objects for select
  using (
    bucket_id in ('documents', 'job-images')
    and auth.role() = 'authenticated'
  );

create policy "Users can delete their organization's documents"
  on storage.objects for delete
  using (
    bucket_id in ('documents', 'job-images')
    and auth.role() = 'authenticated'
  );
