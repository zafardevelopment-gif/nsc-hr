-- ============================================================
-- NSC HR - Clean All Data (Keep Admin User Only)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Delete all transactional data (child tables first)
DELETE FROM "NSC_HR_activity_logs";
DELETE FROM "NSC_HR_notifications";
DELETE FROM "NSC_HR_payroll";
DELETE FROM "NSC_HR_leave_requests";
DELETE FROM "NSC_HR_leave_balances";
DELETE FROM "NSC_HR_work_entries";

-- Step 2: Delete employee users (role = 'employee') only
DELETE FROM "NSC_HR_users"
WHERE role = 'employee';

-- Step 3: Delete all employees
DELETE FROM "NSC_HR_employees";

-- ============================================================
-- Verify: Admin user should still be here
-- ============================================================
SELECT id, username, role, active FROM "NSC_HR_users";
