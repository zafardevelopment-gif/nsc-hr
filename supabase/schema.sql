-- NSC HR & Payroll System - Database Schema
-- All tables prefixed with NSC_HR_

-- ─── Users (custom auth, no Supabase Auth) ───
CREATE TABLE IF NOT EXISTS "NSC_HR_users" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(100) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'employee')),
  employee_id     UUID REFERENCES "NSC_HR_employees"(id) ON DELETE SET NULL,
  active          BOOLEAN DEFAULT true,
  login_attempts  INTEGER DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Employees ───
CREATE TABLE IF NOT EXISTS "NSC_HR_employees" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code   VARCHAR(20) UNIQUE NOT NULL,
  full_name       VARCHAR(200) NOT NULL,
  mobile          VARCHAR(20),
  whatsapp        VARCHAR(20),
  email           VARCHAR(200),
  address         TEXT,
  joining_date    DATE NOT NULL,
  department      VARCHAR(100),
  designation     VARCHAR(100),
  emp_type        VARCHAR(20) NOT NULL CHECK (emp_type IN ('permanent', 'part-time')),
  salary_type     VARCHAR(20) CHECK (salary_type IN ('monthly', 'hourly', 'fixed')),
  monthly_salary  NUMERIC(12,2),
  hourly_rate     NUMERIC(8,2),
  active          BOOLEAN DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Work Entries ───
CREATE TABLE IF NOT EXISTS "NSC_HR_work_entries" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES "NSC_HR_employees"(id) ON DELETE CASCADE,
  entry_date      DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  total_hours     NUMERIC(5,2) NOT NULL,
  task_description TEXT,
  proof_url       TEXT,
  proof_filename  TEXT,
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_remark    TEXT,
  adjusted_hours  NUMERIC(5,2),
  reviewed_by     UUID REFERENCES "NSC_HR_users"(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Leave Requests ───
CREATE TABLE IF NOT EXISTS "NSC_HR_leave_requests" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES "NSC_HR_employees"(id) ON DELETE CASCADE,
  leave_type      VARCHAR(50) NOT NULL,
  from_date       DATE NOT NULL,
  to_date         DATE NOT NULL,
  total_days      INTEGER NOT NULL,
  reason          TEXT,
  doc_url         TEXT,
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_remark    TEXT,
  reviewed_by     UUID REFERENCES "NSC_HR_users"(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Leave Balances ───
CREATE TABLE IF NOT EXISTS "NSC_HR_leave_balances" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES "NSC_HR_employees"(id) ON DELETE CASCADE,
  year            INTEGER NOT NULL,
  leave_type      VARCHAR(50) NOT NULL,
  total_days      INTEGER NOT NULL DEFAULT 0,
  used_days       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, year, leave_type)
);

-- ─── Payroll ───
CREATE TABLE IF NOT EXISTS "NSC_HR_payroll" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES "NSC_HR_employees"(id) ON DELETE CASCADE,
  payroll_month   VARCHAR(7) NOT NULL, -- YYYY-MM
  basic_salary    NUMERIC(12,2) DEFAULT 0,
  hra             NUMERIC(12,2) DEFAULT 0,
  conveyance      NUMERIC(12,2) DEFAULT 0,
  overtime_pay    NUMERIC(12,2) DEFAULT 0,
  bonus           NUMERIC(12,2) DEFAULT 0,
  other_allowance NUMERIC(12,2) DEFAULT 0,
  gross_earnings  NUMERIC(12,2) DEFAULT 0,
  pf_employee     NUMERIC(12,2) DEFAULT 0,
  professional_tax NUMERIC(12,2) DEFAULT 0,
  advance_deduction NUMERIC(12,2) DEFAULT 0,
  other_deductions NUMERIC(12,2) DEFAULT 0,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  net_pay         NUMERIC(12,2) DEFAULT 0,
  approved_hours  NUMERIC(6,2) DEFAULT 0,
  leave_deductions NUMERIC(12,2) DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'paid')),
  payment_method  VARCHAR(50),
  transaction_ref TEXT,
  payment_date    DATE,
  payment_notes   TEXT,
  bank_last4      VARCHAR(4),
  generated_by    UUID REFERENCES "NSC_HR_users"(id),
  paid_by         UUID REFERENCES "NSC_HR_users"(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, payroll_month)
);

-- ─── Notifications ───
CREATE TABLE IF NOT EXISTS "NSC_HR_notifications" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(200) NOT NULL,
  message         TEXT NOT NULL,
  target_role     VARCHAR(20), -- 'admin', 'employee', 'all', or NULL (specific employee)
  employee_id     UUID REFERENCES "NSC_HR_employees"(id) ON DELETE CASCADE,
  notification_type VARCHAR(20) DEFAULT 'in-app' CHECK (notification_type IN ('in-app', 'whatsapp', 'both')),
  read_status     BOOLEAN DEFAULT false,
  read_at         TIMESTAMPTZ,
  created_by      UUID REFERENCES "NSC_HR_users"(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Departments ───
CREATE TABLE IF NOT EXISTS "NSC_HR_departments" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) UNIQUE NOT NULL,
  description     TEXT,
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Settings ───
CREATE TABLE IF NOT EXISTS "NSC_HR_settings" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key     VARCHAR(100) UNIQUE NOT NULL,
  setting_value   TEXT,
  setting_type    VARCHAR(20) DEFAULT 'text',
  category        VARCHAR(50),
  label           VARCHAR(200),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Activity Logs ───
CREATE TABLE IF NOT EXISTS "NSC_HR_activity_logs" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES "NSC_HR_users"(id),
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(50),
  entity_id       UUID,
  details         JSONB,
  ip_address      VARCHAR(50),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_work_entries_employee ON "NSC_HR_work_entries"(employee_id);
CREATE INDEX IF NOT EXISTS idx_work_entries_status ON "NSC_HR_work_entries"(status);
CREATE INDEX IF NOT EXISTS idx_work_entries_date ON "NSC_HR_work_entries"(entry_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON "NSC_HR_leave_requests"(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON "NSC_HR_leave_requests"(status);
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON "NSC_HR_payroll"(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_month ON "NSC_HR_payroll"(payroll_month);
CREATE INDEX IF NOT EXISTS idx_notifications_employee ON "NSC_HR_notifications"(employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON "NSC_HR_notifications"(read_status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON "NSC_HR_activity_logs"(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_code ON "NSC_HR_employees"(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON "NSC_HR_employees"(department);
CREATE INDEX IF NOT EXISTS idx_departments_name ON "NSC_HR_departments"(name);
