-- Migration: Add identity document fields to NSC_HR_employees
ALTER TABLE "NSC_HR_employees"
  ADD COLUMN IF NOT EXISTS id_type    VARCHAR(20) CHECK (id_type IN ('iqama', 'passport', 'national_id')),
  ADD COLUMN IF NOT EXISTS id_number  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS id_expiry  DATE;
