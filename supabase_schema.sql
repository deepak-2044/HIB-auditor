-- HIB Medical Auditor Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database

-- 1. Main items table (The HIB 2081 Formulary)
CREATE TABLE IF NOT EXISTS hib_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  generic_name TEXT,
  category TEXT,
  rate DECIMAL(10, 2),
  code TEXT,
  rules TEXT,
  reimbursement_status TEXT DEFAULT 'listed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Audit history table
CREATE TABLE IF NOT EXISTS audit_history (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  patient_id TEXT,
  claim_date DATE,
  total_amount DECIMAL(10, 2),
  audit_status TEXT, -- 'approved', 'flagged', 'rejected'
  findings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Sample Data (Optional)
-- INSERT INTO hib_items (name, generic_name, category, rate, code) VALUES
-- ('Amoxicillin 500mg', 'Amoxicillin', 'Antibiotic', 15.50, 'A001'),
-- ('Paracetamol 500mg', 'Paracetamol', 'Analgesic', 2.00, 'P002');
