-- NSC HR - Migration: Employee Documents + Finance Entries
-- Run this after the main schema

-- ─── Employee Documents (ID Expiry System) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "NSC_HR_employee_documents" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES "NSC_HR_employees"(id) ON DELETE CASCADE,
  document_type   VARCHAR(50) NOT NULL CHECK (document_type IN ('iqama', 'passport', 'national_id', 'driving_license', 'work_permit', 'visa', 'other')),
  number          VARCHAR(100) NOT NULL,
  issue_date      DATE,
  expiry_date     DATE,
  file_url        TEXT,
  file_name       TEXT,
  notes           TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expiring', 'expired')),
  created_by      UUID REFERENCES "NSC_HR_users"(id),
  updated_by      UUID REFERENCES "NSC_HR_users"(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_docs_employee   ON "NSC_HR_employee_documents"(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_docs_status     ON "NSC_HR_employee_documents"(status);
CREATE INDEX IF NOT EXISTS idx_emp_docs_expiry     ON "NSC_HR_employee_documents"(expiry_date);
CREATE INDEX IF NOT EXISTS idx_emp_docs_type       ON "NSC_HR_employee_documents"(document_type);

-- ─── Finance Entries (Earnings & Expenses) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "NSC_HR_finance_entries" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            VARCHAR(10) NOT NULL CHECK (type IN ('earning', 'expense')),
  date            DATE NOT NULL,
  description     VARCHAR(300) NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  -- earning-specific
  received_from   VARCHAR(200),
  -- expense-specific
  paid_to         VARCHAR(200),
  category        VARCHAR(100),
  -- shared
  payment_mode    VARCHAR(50) CHECK (payment_mode IN ('cash', 'bank_transfer', 'cheque', 'online', 'other')),
  reference       VARCHAR(100),
  notes           TEXT,
  created_by      UUID REFERENCES "NSC_HR_users"(id),
  updated_by      UUID REFERENCES "NSC_HR_users"(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_type    ON "NSC_HR_finance_entries"(type);
CREATE INDEX IF NOT EXISTS idx_finance_date    ON "NSC_HR_finance_entries"(date);
CREATE INDEX IF NOT EXISTS idx_finance_cat     ON "NSC_HR_finance_entries"(category);
