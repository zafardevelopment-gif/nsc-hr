-- Migration: support supplemental payroll records for entries approved after payroll was paid
-- Run this in Supabase SQL editor

-- 1. Add payroll_type column (regular | supplement)
ALTER TABLE "NSC_HR_payroll"
  ADD COLUMN IF NOT EXISTS payroll_type VARCHAR(20) NOT NULL DEFAULT 'regular'
    CHECK (payroll_type IN ('regular', 'supplement'));

-- 2. Add parent_payroll_id for traceability
ALTER TABLE "NSC_HR_payroll"
  ADD COLUMN IF NOT EXISTS parent_payroll_id UUID REFERENCES "NSC_HR_payroll"(id) ON DELETE SET NULL;

-- 3. Drop old unique constraint (one record per employee per month)
ALTER TABLE "NSC_HR_payroll"
  DROP CONSTRAINT IF EXISTS "NSC_HR_payroll_employee_id_payroll_month_key";

-- 4. New unique constraint: one record per (employee, month, type)
ALTER TABLE "NSC_HR_payroll"
  ADD CONSTRAINT "NSC_HR_payroll_employee_month_type_key"
  UNIQUE (employee_id, payroll_month, payroll_type);
