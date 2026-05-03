-- Migration: Project-Based Work System
-- Run this in your Supabase SQL editor

-- 1. Projects master table
CREATE TABLE IF NOT EXISTS NSC_HR_projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  project_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON NSC_HR_projects(status);

-- 2. Project work logs (temporary employees only)
CREATE TABLE IF NOT EXISTS NSC_HR_project_work_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES NSC_HR_employees(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES NSC_HR_projects(id) ON DELETE RESTRICT,
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  rate        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) GENERATED ALWAYS AS (quantity * rate) STORED,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_by  UUID REFERENCES NSC_HR_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pwl_employee  ON NSC_HR_project_work_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_pwl_project   ON NSC_HR_project_work_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_pwl_date      ON NSC_HR_project_work_logs(date);

-- 3. Add project_id (nullable) to finance entries
ALTER TABLE NSC_HR_finance_entries
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES NSC_HR_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_project ON NSC_HR_finance_entries(project_id);

-- 4. Add role_type to NSC_HR_users to support restricted-admin
ALTER TABLE NSC_HR_users
  ADD COLUMN IF NOT EXISTS role_type TEXT NOT NULL DEFAULT 'super_admin'
    CHECK (role_type IN ('super_admin','restricted_admin'));

-- 5. Project P&L view
CREATE OR REPLACE VIEW NSC_HR_project_reports AS
SELECT
  p.id                                                          AS project_id,
  p.project_name,
  p.project_rate,
  p.status,
  COALESCE(SUM(f_in.amount)   FILTER (WHERE f_in.type = 'earning'), 0)  AS total_income,
  COALESCE(SUM(f_out.amount)  FILTER (WHERE f_out.type = 'expense'), 0) AS total_expense,
  COALESCE(SUM(wl.total_amount), 0)                                       AS salary_expense,
  COALESCE(SUM(f_in.amount)   FILTER (WHERE f_in.type = 'earning'), 0)
    - COALESCE(SUM(f_out.amount) FILTER (WHERE f_out.type = 'expense'), 0)
    - COALESCE(SUM(wl.total_amount), 0)                                   AS net_profit
FROM NSC_HR_projects p
LEFT JOIN NSC_HR_finance_entries f_in  ON f_in.project_id  = p.id AND f_in.type  = 'earning'
LEFT JOIN NSC_HR_finance_entries f_out ON f_out.project_id = p.id AND f_out.type = 'expense'
LEFT JOIN NSC_HR_project_work_logs wl  ON wl.project_id    = p.id
GROUP BY p.id, p.project_name, p.project_rate, p.status;
