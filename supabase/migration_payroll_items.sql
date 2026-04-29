-- Migration: payroll_items — explicit entry-to-payroll linkage
-- Eliminates all created_at timestamp guessing for classification.
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS "NSC_HR_payroll_items" (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id     UUID NOT NULL REFERENCES "NSC_HR_payroll"(id) ON DELETE CASCADE,
  work_entry_id  UUID NOT NULL REFERENCES "NSC_HR_work_entries"(id) ON DELETE CASCADE,
  hours          NUMERIC(6,2) NOT NULL,
  amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (work_entry_id)   -- each entry belongs to at most one payroll
);

CREATE INDEX IF NOT EXISTS idx_payroll_items_payroll    ON "NSC_HR_payroll_items"(payroll_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_entry      ON "NSC_HR_payroll_items"(work_entry_id);

-- Also drop the old UNIQUE constraint that blocked multiple supplements,
-- and add the partial index that only enforces uniqueness for regular payrolls.
-- (safe to run even if migration_supplement_v2.sql was already applied)
ALTER TABLE "NSC_HR_payroll"
  DROP CONSTRAINT IF EXISTS "NSC_HR_payroll_employee_month_type_key";

CREATE UNIQUE INDEX IF NOT EXISTS "NSC_HR_payroll_regular_unique"
  ON "NSC_HR_payroll" (employee_id, payroll_month)
  WHERE payroll_type = 'regular';

-- approved_hours column (safe if already exists)
ALTER TABLE "NSC_HR_payroll"
  ADD COLUMN IF NOT EXISTS approved_hours NUMERIC(8,2) DEFAULT 0;
