-- =============================================
-- Invitations System for EasyWork
-- Run this in your Supabase SQL Editor
-- =============================================

-- =============================================
-- Invitations Table
-- =============================================
create table if not exists invitations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations on delete cascade not null,
  email text not null,
  role text default 'employee' check (role in ('admin', 'employee')),
  token uuid default uuid_generate_v4() unique not null,
  invited_by uuid references profiles on delete set null,
  status text default 'pending' check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at timestamp with time zone default (timezone('utc'::text, now()) + interval '7 days') not null,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for faster lookups
create index if not exists idx_invitations_token on invitations(token);
create index if not exists idx_invitations_email on invitations(email);
create index if not exists idx_invitations_org on invitations(organization_id);

-- =============================================
-- RLS Policies for Invitations
-- =============================================
alter table invitations enable row level security;

-- Admins can view invitations for their organization
create policy "Admins can view invitations"
  on invitations for select
  using (
    organization_id = get_user_organization_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- Admins can create invitations
create policy "Admins can create invitations"
  on invitations for insert
  with check (
    organization_id = get_user_organization_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- Admins can update invitations (cancel)
create policy "Admins can update invitations"
  on invitations for update
  using (
    organization_id = get_user_organization_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- Admins can delete invitations
create policy "Admins can delete invitations"
  on invitations for delete
  using (
    organization_id = get_user_organization_id()
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- Anyone can view invitation by token (for accepting)
create policy "Anyone can view invitation by token"
  on invitations for select
  using (true);

-- =============================================
-- Update Profiles Policy for new users
-- =============================================

-- Allow new users to create their own profile
create policy "Users can create their own profile"
  on profiles for insert
  with check (id = auth.uid());

-- Allow users without organization to update their own profile (to set organization_id)
create policy "Users can set their organization"
  on profiles for update
  using (id = auth.uid());

-- =============================================
-- Allow anyone to create an organization (for new users)
-- =============================================
create policy "Anyone can create organization"
  on organizations for insert
  with check (true);

-- =============================================
-- Function to accept invitation
-- =============================================
create or replace function accept_invitation(invitation_token uuid)
returns json
language plpgsql
security definer
as $$
declare
  inv record;
  user_id uuid;
begin
  -- Get current user
  user_id := auth.uid();
  
  if user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;
  
  -- Get invitation
  select * into inv
  from invitations
  where token = invitation_token
    and status = 'pending'
    and expires_at > now();
  
  if inv is null then
    return json_build_object('success', false, 'error', 'Invalid or expired invitation');
  end if;
  
  -- Update user profile with organization
  update profiles
  set 
    organization_id = inv.organization_id,
    role = inv.role,
    updated_at = now()
  where id = user_id;
  
  -- Mark invitation as accepted
  update invitations
  set 
    status = 'accepted',
    accepted_at = now()
  where id = inv.id;
  
  return json_build_object(
    'success', true, 
    'organization_id', inv.organization_id,
    'role', inv.role
  );
end;
$$;

-- =============================================
-- Function to create organization and set user as owner
-- =============================================
create or replace function create_organization_with_owner(
  org_name text,
  org_email text default null,
  org_phone text default null,
  org_number text default null,
  org_address text default null,
  org_postal_code text default null,
  org_city text default null
)
returns json
language plpgsql
security definer
as $$
declare
  user_id uuid;
  new_org_id uuid;
  user_email text;
begin
  -- Get current user
  user_id := auth.uid();
  
  if user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;
  
  -- Get user email from auth
  select email into user_email from auth.users where id = user_id;
  
  -- Check if user already has an organization
  if exists (select 1 from profiles where id = user_id and organization_id is not null) then
    return json_build_object('success', false, 'error', 'User already belongs to an organization');
  end if;
  
  -- Create organization
  insert into organizations (name, email, phone, org_number, address, postal_code, city)
  values (org_name, org_email, org_phone, org_number, org_address, org_postal_code, org_city)
  returning id into new_org_id;
  
  -- Update profile with organization and owner role
  update profiles
  set 
    organization_id = new_org_id,
    role = 'owner',
    email = coalesce(profiles.email, user_email),
    updated_at = now()
  where id = user_id;
  
  -- If profile doesn't exist, create it
  if not found then
    insert into profiles (id, organization_id, role, email)
    values (user_id, new_org_id, 'owner', user_email);
  end if;
  
  return json_build_object(
    'success', true, 
    'organization_id', new_org_id
  );
end;
$$;

-- =============================================
-- Trigger to create profile on user signup
-- =============================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

-- Drop existing trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
