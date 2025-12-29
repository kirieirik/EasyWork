-- =====================================================
-- EasyWork - Job Lines & Invoices Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- JOB_LINES - Arbeidslinjer for jobber
-- (Strukturelt lik quote_lines for konsistens)
-- =====================================================
CREATE TABLE IF NOT EXISTS job_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  article_id uuid REFERENCES articles(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity decimal(10,3) DEFAULT 1,
  unit_name text DEFAULT 'stk',
  cost_price decimal(12,2) DEFAULT 0,
  unit_price decimal(12,2) DEFAULT 0,
  vat_rate decimal(5,2) DEFAULT 25.00,
  total decimal(12,2) DEFAULT 0,
  margin_percent decimal(5,2) GENERATED ALWAYS AS (
    CASE WHEN cost_price > 0 THEN ((unit_price - cost_price) / cost_price * 100) ELSE 0 END
  ) STORED,
  sort_order integer DEFAULT 0,
  -- For tracking partial invoicing (delfakturering)
  quantity_invoiced decimal(10,3) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_job_lines_job_id ON job_lines(job_id);

-- =====================================================
-- INVOICES - Fakturaer
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  
  -- Invoice details
  invoice_number integer NOT NULL,
  title text,
  description text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  
  -- Dates
  invoice_date date DEFAULT CURRENT_DATE,
  due_date date,
  sent_at timestamptz,
  paid_at timestamptz,
  
  -- Amounts (calculated from lines)
  subtotal numeric(12,2) DEFAULT 0,
  vat_amount numeric(12,2) DEFAULT 0,
  total numeric(12,2) DEFAULT 0,
  
  -- Payment info
  payment_reference text, -- KID number or reference
  
  -- Additional info
  notes text,
  terms text,
  
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- =====================================================
-- INVOICE_LINES - Fakturalinjer
-- (Strukturelt lik quote_lines/job_lines for konsistens)
-- =====================================================
CREATE TABLE IF NOT EXISTS invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  job_line_id uuid REFERENCES job_lines(id) ON DELETE SET NULL, -- Link back to job line
  article_id uuid REFERENCES articles(id) ON DELETE SET NULL,
  
  description text NOT NULL,
  quantity decimal(10,3) DEFAULT 1,
  unit_name text DEFAULT 'stk',
  cost_price decimal(12,2) DEFAULT 0,
  unit_price decimal(12,2) DEFAULT 0,
  vat_rate decimal(5,2) DEFAULT 25.00,
  total decimal(12,2) DEFAULT 0,
  margin_percent decimal(5,2) GENERATED ALWAYS AS (
    CASE WHEN cost_price > 0 THEN ((unit_price - cost_price) / cost_price * 100) ELSE 0 END
  ) STORED,
  
  -- Calculated VAT amount
  vat_amount decimal(12,2) GENERATED ALWAYS AS (total * vat_rate / 100) STORED,
  
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);

-- =====================================================
-- AUTO-INCREMENT INVOICE NUMBER PER ORGANIZATION
-- =====================================================
CREATE OR REPLACE FUNCTION get_next_invoice_number(org_id uuid)
RETURNS integer AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(invoice_number), 0) + 1 INTO next_num
  FROM invoices
  WHERE organization_id = org_id;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UPDATE INVOICE TOTALS TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices
  SET 
    subtotal = (SELECT COALESCE(SUM(total), 0) FROM invoice_lines WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)),
    vat_amount = (SELECT COALESCE(SUM(vat_amount), 0) FROM invoice_lines WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)),
    total = (SELECT COALESCE(SUM(total + vat_amount), 0) FROM invoice_lines WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)),
    updated_at = now()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_invoice_totals ON invoice_lines;
CREATE TRIGGER trigger_update_invoice_totals
AFTER INSERT OR UPDATE OR DELETE ON invoice_lines
FOR EACH ROW
EXECUTE FUNCTION update_invoice_totals();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- JOB_LINES RLS
ALTER TABLE job_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view job lines" ON job_lines;
DROP POLICY IF EXISTS "Users can create job lines" ON job_lines;
DROP POLICY IF EXISTS "Users can update job lines" ON job_lines;
DROP POLICY IF EXISTS "Users can delete job lines" ON job_lines;

CREATE POLICY "Users can view job lines"
ON job_lines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_lines.job_id 
    AND jobs.organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Users can create job lines"
ON job_lines FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_lines.job_id 
    AND jobs.organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Users can update job lines"
ON job_lines FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_lines.job_id 
    AND jobs.organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Users can delete job lines"
ON job_lines FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_lines.job_id 
    AND jobs.organization_id = public.get_user_organization_id()
  )
);

-- INVOICES RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invoices in organization" ON invoices;
DROP POLICY IF EXISTS "Users can create invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can delete invoices" ON invoices;

CREATE POLICY "Users can view invoices in organization"
ON invoices FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can create invoices"
ON invoices FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update invoices"
ON invoices FOR UPDATE
USING (organization_id = public.get_user_organization_id())
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can delete invoices"
ON invoices FOR DELETE
USING (
  organization_id = public.get_user_organization_id()
  AND public.is_admin_or_owner()
);

-- INVOICE_LINES RLS
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invoice lines" ON invoice_lines;
DROP POLICY IF EXISTS "Users can create invoice lines" ON invoice_lines;
DROP POLICY IF EXISTS "Users can update invoice lines" ON invoice_lines;
DROP POLICY IF EXISTS "Users can delete invoice lines" ON invoice_lines;

CREATE POLICY "Users can view invoice lines"
ON invoice_lines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_lines.invoice_id 
    AND invoices.organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Users can create invoice lines"
ON invoice_lines FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_lines.invoice_id 
    AND invoices.organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Users can update invoice lines"
ON invoice_lines FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_lines.invoice_id 
    AND invoices.organization_id = public.get_user_organization_id()
  )
);

CREATE POLICY "Users can delete invoice lines"
ON invoice_lines FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_lines.invoice_id 
    AND invoices.organization_id = public.get_user_organization_id()
  )
);

-- =====================================================
-- VERIFY TABLES CREATED
-- =====================================================
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('job_lines', 'invoices', 'invoice_lines');
