-- ============================================================
-- COMPLETE PROJECT SYSTEM MIGRATION (Fresh Install)
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- 1. Add role_type to NSC_HR_users
ALTER TABLE "NSC_HR_users"
  ADD COLUMN IF NOT EXISTS role_type TEXT NOT NULL DEFAULT 'super_admin'
    CHECK (role_type IN ('super_admin', 'restricted_admin'));

-- 2. Projects master table
CREATE TABLE IF NOT EXISTS "NSC_HR_projects" (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  project_cost NUMERIC(14,2) DEFAULT 0,
  client_name  TEXT,
  start_date   DATE,
  end_date     DATE,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON "NSC_HR_projects"(status);

-- 3. Employee-Project Assignments (individual rate per employee per project)
CREATE TABLE IF NOT EXISTS "NSC_HR_project_assignments" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES "NSC_HR_projects"(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES "NSC_HR_employees"(id) ON DELETE CASCADE,
  rate        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  rate_type   TEXT NOT NULL DEFAULT 'per_unit'
                CHECK (rate_type IN ('per_unit', 'per_hour', 'per_day', 'fixed')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active      BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (project_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_pa_project  ON "NSC_HR_project_assignments"(project_id);
CREATE INDEX IF NOT EXISTS idx_pa_employee ON "NSC_HR_project_assignments"(employee_id);

-- 4. Project work logs
CREATE TABLE IF NOT EXISTS "NSC_HR_project_work_logs" (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES "NSC_HR_employees"(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES "NSC_HR_projects"(id) ON DELETE RESTRICT,
  assignment_id UUID REFERENCES "NSC_HR_project_assignments"(id) ON DELETE SET NULL,
  quantity      NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  rate          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_by    UUID REFERENCES "NSC_HR_users"(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pwl_employee  ON "NSC_HR_project_work_logs"(employee_id);
CREATE INDEX IF NOT EXISTS idx_pwl_project   ON "NSC_HR_project_work_logs"(project_id);
CREATE INDEX IF NOT EXISTS idx_pwl_date      ON "NSC_HR_project_work_logs"(date);

-- 5. Add project_id to finance entries
ALTER TABLE "NSC_HR_finance_entries"
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES "NSC_HR_projects"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_project ON "NSC_HR_finance_entries"(project_id);

-- 6. Project P&L View
CREATE OR REPLACE VIEW "NSC_HR_project_reports" AS
SELECT
  p.id           AS project_id,
  p.project_name,
  p.project_cost,
  p.status,
  COALESCE((
    SELECT SUM(f.amount) FROM "NSC_HR_finance_entries" f
    WHERE f.project_id = p.id AND f.type = 'earning'
  ), 0) AS total_income,
  COALESCE((
    SELECT SUM(f.amount) FROM "NSC_HR_finance_entries" f
    WHERE f.project_id = p.id AND f.type = 'expense'
  ), 0) AS total_finance_expense,
  COALESCE((
    SELECT SUM(wl.total_amount) FROM "NSC_HR_project_work_logs" wl
    WHERE wl.project_id = p.id
  ), 0) AS salary_expense,
  COALESCE((
    SELECT SUM(f.amount) FROM "NSC_HR_finance_entries" f
    WHERE f.project_id = p.id AND f.type = 'earning'
  ), 0)
  - COALESCE((
    SELECT SUM(f.amount) FROM "NSC_HR_finance_entries" f
    WHERE f.project_id = p.id AND f.type = 'expense'
  ), 0)
  - COALESCE((
    SELECT SUM(wl.total_amount) FROM "NSC_HR_project_work_logs" wl
    WHERE wl.project_id = p.id
  ), 0) AS net_profit
FROM "NSC_HR_projects" p;
