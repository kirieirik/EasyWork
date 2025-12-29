-- =====================================================
-- EasyWork - Row Level Security (RLS) Policies
-- Run this in Supabase SQL Editor
-- =====================================================

-- Helper function to get current user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if current user is owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'owner'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if current user is owner or admin
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'admin')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- PROFILES
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update employee roles" ON profiles;

CREATE POLICY "Users can view profiles in their organization"
ON profiles FOR SELECT
USING (
  organization_id = public.get_user_organization_id()
  OR id = auth.uid()
);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update employee roles"
ON profiles FOR UPDATE
USING (
  public.is_admin_or_owner() 
  AND organization_id = public.get_user_organization_id()
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (role != 'owner' OR id = auth.uid())
);

-- =====================================================
-- ORGANIZATIONS
-- =====================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
DROP POLICY IF EXISTS "Owner can update organization" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;

CREATE POLICY "Users can view own organization"
ON organizations FOR SELECT
USING (id = public.get_user_organization_id());

CREATE POLICY "Owner can update organization"
ON organizations FOR UPDATE
USING (
  id = public.get_user_organization_id() 
  AND public.is_owner()
);

CREATE POLICY "Users can create organizations"
ON organizations FOR INSERT
WITH CHECK (true);

-- =====================================================
-- CUSTOMERS
-- =====================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view customers in organization" ON customers;
DROP POLICY IF EXISTS "Users can create customers" ON customers;
DROP POLICY IF EXISTS "Users can update customers" ON customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON customers;

CREATE POLICY "Users can view customers in organization"
ON customers FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can create customers"
ON customers FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update customers"
ON customers FOR UPDATE
USING (organization_id = public.get_user_organization_id())
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can delete customers"
ON customers FOR DELETE
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_admin_or_owner()
);

-- =====================================================
-- JOBS
-- =====================================================
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view jobs in organization" ON jobs;
DROP POLICY IF EXISTS "Users can create jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update jobs" ON jobs;
DROP POLICY IF EXISTS "Admins can delete jobs" ON jobs;

CREATE POLICY "Users can view jobs in organization"
ON jobs FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can create jobs"
ON jobs FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update jobs"
ON jobs FOR UPDATE
USING (organization_id = public.get_user_organization_id())
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can delete jobs"
ON jobs FOR DELETE
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_admin_or_owner()
);

-- =====================================================
-- JOB_NOTES
-- =====================================================
ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view job notes" ON job_notes;
DROP POLICY IF EXISTS "Users can create job notes" ON job_notes;
DROP POLICY IF EXISTS "Users can update own job notes" ON job_notes;
DROP POLICY IF EXISTS "Users can delete own job notes" ON job_notes;

CREATE POLICY "Users can view job notes"
ON job_notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_notes.job_id 
    AND jobs.organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Users can create job notes"
ON job_notes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_notes.job_id 
    AND jobs.organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Users can update own job notes"
ON job_notes FOR UPDATE
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own job notes"
ON job_notes FOR DELETE
USING (
  profile_id = auth.uid() 
  OR public.is_admin_or_owner()
);

-- =====================================================
-- QUOTES
-- =====================================================
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view quotes in organization" ON quotes;
DROP POLICY IF EXISTS "Users can create quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update quotes" ON quotes;
DROP POLICY IF EXISTS "Admins can delete quotes" ON quotes;

CREATE POLICY "Users can view quotes in organization"
ON quotes FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can create quotes"
ON quotes FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update quotes"
ON quotes FOR UPDATE
USING (organization_id = public.get_user_organization_id())
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can delete quotes"
ON quotes FOR DELETE
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_admin_or_owner()
);

-- =====================================================
-- QUOTE_LINES
-- =====================================================
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view quote lines" ON quote_lines;
DROP POLICY IF EXISTS "Users can create quote lines" ON quote_lines;
DROP POLICY IF EXISTS "Users can update quote lines" ON quote_lines;
DROP POLICY IF EXISTS "Users can delete quote lines" ON quote_lines;

CREATE POLICY "Users can view quote lines"
ON quote_lines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM quotes 
    WHERE quotes.id = quote_lines.quote_id 
    AND quotes.organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Users can create quote lines"
ON quote_lines FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM quotes 
    WHERE quotes.id = quote_lines.quote_id 
    AND quotes.organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Users can update quote lines"
ON quote_lines FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM quotes 
    WHERE quotes.id = quote_lines.quote_id 
    AND quotes.organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Users can delete quote lines"
ON quote_lines FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM quotes 
    WHERE quotes.id = quote_lines.quote_id 
    AND quotes.organization_id = public.get_user_organization_id()
  )
);

-- =====================================================
-- ARTICLES
-- =====================================================
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view articles in organization" ON articles;
DROP POLICY IF EXISTS "Users can create articles" ON articles;
DROP POLICY IF EXISTS "Users can update articles" ON articles;
DROP POLICY IF EXISTS "Admins can delete articles" ON articles;

CREATE POLICY "Users can view articles in organization"
ON articles FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can create articles"
ON articles FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update articles"
ON articles FOR UPDATE
USING (organization_id = public.get_user_organization_id())
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can delete articles"
ON articles FOR DELETE
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_admin_or_owner()
);

-- =====================================================
-- UNITS
-- =====================================================
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view units in organization" ON units;
DROP POLICY IF EXISTS "Admins can create units" ON units;
DROP POLICY IF EXISTS "Admins can update units" ON units;
DROP POLICY IF EXISTS "Admins can delete units" ON units;

CREATE POLICY "Users can view units in organization"
ON units FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can create units"
ON units FOR INSERT
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND public.is_admin_or_owner()
);

CREATE POLICY "Admins can update units"
ON units FOR UPDATE
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_admin_or_owner()
);

CREATE POLICY "Admins can delete units"
ON units FOR DELETE
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_admin_or_owner()
);

-- =====================================================
-- TIME_ENTRIES
-- =====================================================
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view time entries in organization" ON time_entries;
DROP POLICY IF EXISTS "Users can create time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can update own time entries" ON time_entries;
DROP POLICY IF EXISTS "Admins can update time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can delete own time entries" ON time_entries;

CREATE POLICY "Users can view time entries in organization"
ON time_entries FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can create time entries"
ON time_entries FOR INSERT
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND profile_id = auth.uid()
);

CREATE POLICY "Users can update own time entries"
ON time_entries FOR UPDATE
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Admins can update time entries"
ON time_entries FOR UPDATE
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_admin_or_owner()
);

CREATE POLICY "Users can delete own time entries"
ON time_entries FOR DELETE
USING (
  profile_id = auth.uid() 
  OR (organization_id = public.get_user_organization_id() AND public.is_admin_or_owner())
);

-- =====================================================
-- VEHICLES
-- =====================================================
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view vehicles in organization" ON vehicles;
DROP POLICY IF EXISTS "Admins can create vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can delete vehicles" ON vehicles;

CREATE POLICY "Users can view vehicles in organization"
ON vehicles FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can create vehicles"
ON vehicles FOR INSERT
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND public.is_admin_or_owner()
);

CREATE POLICY "Admins can update vehicles"
ON vehicles FOR UPDATE
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_admin_or_owner()
);

CREATE POLICY "Admins can delete vehicles"
ON vehicles FOR DELETE
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_admin_or_owner()
);

-- =====================================================
-- VEHICLE_SERVICE_LOG
-- =====================================================
ALTER TABLE vehicle_service_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view vehicle service logs" ON vehicle_service_log;
DROP POLICY IF EXISTS "Users can create vehicle service logs" ON vehicle_service_log;
DROP POLICY IF EXISTS "Users can update vehicle service logs" ON vehicle_service_log;
DROP POLICY IF EXISTS "Admins can delete vehicle service logs" ON vehicle_service_log;

CREATE POLICY "Users can view vehicle service logs"
ON vehicle_service_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM vehicles 
    WHERE vehicles.id = vehicle_service_log.vehicle_id 
    AND vehicles.organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Users can create vehicle service logs"
ON vehicle_service_log FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM vehicles 
    WHERE vehicles.id = vehicle_service_log.vehicle_id 
    AND vehicles.organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Users can update vehicle service logs"
ON vehicle_service_log FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM vehicles 
    WHERE vehicles.id = vehicle_service_log.vehicle_id 
    AND vehicles.organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Admins can delete vehicle service logs"
ON vehicle_service_log FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM vehicles 
    WHERE vehicles.id = vehicle_service_log.vehicle_id 
    AND vehicles.organization_id = public.get_user_organization_id()
  )
  AND public.is_admin_or_owner()
);

-- =====================================================
-- DOCUMENTS
-- =====================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view documents in organization" ON documents;
DROP POLICY IF EXISTS "Users can create documents" ON documents;
DROP POLICY IF EXISTS "Users can update documents" ON documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON documents;

CREATE POLICY "Users can view documents in organization"
ON documents FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can create documents"
ON documents FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update documents"
ON documents FOR UPDATE
USING (organization_id = public.get_user_organization_id())
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can delete documents"
ON documents FOR DELETE
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_admin_or_owner()
);

-- =====================================================
-- VERIFY RLS IS ENABLED
-- =====================================================
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
