-- =====================================================
-- EasyWork - Settings Schema Extension
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add new columns to organizations table for settings
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS iban text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS swift_bic text;

-- Invoice settings
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT '';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS invoice_start_number integer DEFAULT 1;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_payment_days integer DEFAULT 14;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_vat_rate numeric(5,2) DEFAULT 25.00;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_invoice_terms text DEFAULT 'Betaling innen forfallsdato. Ved forsinket betaling påløper forsinkelsesrenter.';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_invoice_notes text;

-- Integration settings
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS integration_provider text CHECK (integration_provider IN ('none', 'tripletex', 'duett', 'visma', 'fiken', 'poweroffice'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS integration_api_key text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS integration_enabled boolean DEFAULT false;

-- Additional company info
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country text DEFAULT 'Norge';

-- Verify columns added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
ORDER BY ordinal_position;
