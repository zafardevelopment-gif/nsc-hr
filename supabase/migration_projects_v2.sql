-- Migration v2: Project-Based Work System (Employee-specific rates)
-- Run this AFTER migration_projects_v1.sql
-- OR run the full block if starting fresh

-- ============================================================
-- If v1 already ran, apply these ALTER statements:
-- ============================================================

-- Drop project_rate from projects (project has no single rate)
ALTER TABLE NSC_HR_projects DROP COLUMN IF EXISTS project_rate;

-- Add project budget/cost fields (optional metadata)
ALTER TABLE NSC_HR_projects
  ADD COLUMN IF NOT EXISTS project_cost  NUMERIC(14,2) DEFAULT 0,   -- total cost/budget of project
  ADD COLUMN IF NOT EXISTS client_name   TEXT,
  ADD COLUMN IF NOT EXISTS start_date    DATE,
  ADD COLUMN IF NOT EXISTS end_date      DATE;

-- ============================================================
-- NEW TABLE: Employee-Project Assignments with individual rate
-- ============================================================
CREATE TABLE IF NOT EXISTS NSC_HR_project_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES NSC_HR_projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES NSC_HR_employees(id) ON DELETE CASCADE,
  rate        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rate >= 0),  -- employee-specific rate for this project
  rate_type   TEXT NOT NULL DEFAULT 'per_unit'
                CHECK (rate_type IN ('per_unit', 'per_hour', 'per_day', 'fixed')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active      BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (project_id, employee_id)  -- one assignment per employee per project
);

CREATE INDEX IF NOT EXISTS idx_pa_project  ON NSC_HR_project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_pa_employee ON NSC_HR_project_assignments(employee_id);

-- ============================================================
-- Drop generated column and recreate work_logs with rate from assignment
-- (rate is still stored at log time so history is preserved)
-- ============================================================

-- If the column exists as GENERATED, we need to drop & recreate it as regular
-- (Postgres doesn't allow altering generated columns directly)
ALTER TABLE NSC_HR_project_work_logs
  DROP COLUMN IF EXISTS total_amount;

ALTER TABLE NSC_HR_project_work_logs
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Add assignment_id reference (nullable — existing logs won't have it)
ALTER TABLE NSC_HR_project_work_logs
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES NSC_HR_project_assignments(id) ON DELETE SET NULL;

-- ============================================================
-- Re-create P&L view (no project_rate column)
-- ============================================================
CREATE OR REPLACE VIEW NSC_HR_project_reports AS
SELECT
  p.id                                                                        AS project_id,
  p.project_name,
  p.project_cost,
  p.status,
  COALESCE(SUM(DISTINCT f_in.amount)  FILTER (WHERE f_in.type  = 'earning'), 0) AS total_income,
  COALESCE(SUM(DISTINCT f_out.amount) FILTER (WHERE f_out.type = 'expense'), 0) AS total_finance_expense,
  COALESCE((SELECT SUM(wl2.total_amount) FROM NSC_HR_project_work_logs wl2
            WHERE wl2.project_id = p.id), 0)                                   AS salary_expense,
  COALESCE(SUM(DISTINCT f_in.amount)  FILTER (WHERE f_in.type  = 'earning'), 0)
    - COALESCE(SUM(DISTINCT f_out.amount) FILTER (WHERE f_out.type = 'expense'), 0)
    - COALESCE((SELECT SUM(wl3.total_amount) FROM NSC_HR_project_work_logs wl3
                WHERE wl3.project_id = p.id), 0)                               AS net_profit
FROM NSC_HR_projects p
LEFT JOIN NSC_HR_finance_entries f_in  ON f_in.project_id  = p.id AND f_in.type  = 'earning'
LEFT JOIN NSC_HR_finance_entries f_out ON f_out.project_id = p.id AND f_out.type = 'expense'
GROUP BY p.id, p.project_name, p.project_cost, p.status;

-- ============================================================
-- Full fresh schema (if v1 was never run):
-- ============================================================
-- CREATE TABLE IF NOT EXISTS NSC_HR_projects ( ... same as v1 minus project_rate + new cols )
-- CREATE TABLE IF NOT EXISTS NSC_HR_project_assignments ( ... as above )
-- CREATE TABLE IF NOT EXISTS NSC_HR_project_work_logs ( ... as above )
-- ALTER TABLE NSC_HR_finance_entries ADD COLUMN IF NOT EXISTS project_id UUID ...
-- ALTER TABLE NSC_HR_users ADD COLUMN IF NOT EXISTS role_type TEXT ...
