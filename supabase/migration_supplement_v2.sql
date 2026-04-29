-- Migration v2: allow multiple supplements per employee per month
-- Run this in Supabase SQL editor

-- 1. Drop the per-type unique constraint (blocks chain supplements)
ALTER TABLE "NSC_HR_payroll"
  DROP CONSTRAINT IF EXISTS "NSC_HR_payroll_employee_month_type_key";

-- 2. Keep only the original regular-payroll uniqueness via partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS "NSC_HR_payroll_regular_unique"
  ON "NSC_HR_payroll" (employee_id, payroll_month)
  WHERE payroll_type = 'regular';

-- 3. Add approved_hours column if missing
ALTER TABLE "NSC_HR_payroll"
  ADD COLUMN IF NOT EXISTS approved_hours NUMERIC(8,2) DEFAULT 0;
