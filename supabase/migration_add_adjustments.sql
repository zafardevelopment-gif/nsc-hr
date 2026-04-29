-- Migration: Add NSC_HR_adjustments table
CREATE TABLE IF NOT EXISTS "NSC_HR_adjustments" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES "NSC_HR_employees"(id) ON DELETE CASCADE,
  adj_month       VARCHAR(7) NOT NULL,
  adj_type        VARCHAR(20) NOT NULL CHECK (adj_type IN ('bonus', 'overtime', 'allowance', 'deduction', 'advance')),
  amount          NUMERIC(12,2) NOT NULL,
  reason          TEXT,
  applied         BOOLEAN DEFAULT false,
  created_by      UUID REFERENCES "NSC_HR_users"(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adjustments_employee ON "NSC_HR_adjustments"(employee_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_month    ON "NSC_HR_adjustments"(adj_month);
CREATE INDEX IF NOT EXISTS idx_adjustments_applied  ON "NSC_HR_adjustments"(applied);
