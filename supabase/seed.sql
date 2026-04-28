-- NSC HR System — Seed Data
-- Run this AFTER schema.sql

-- ─── Settings ───
INSERT INTO "NSC_HR_settings" (setting_key, setting_value, setting_type, category, label) VALUES
  ('company_name',       'NSC Company',            'text',   'general',   'Company Name'),
  ('company_address',    '123 Business Park, Mumbai — 400001', 'textarea', 'general', 'Company Address'),
  ('company_email',      'hr@nsc.com',             'email',  'general',   'HR Email'),
  ('company_phone',      '+91 9000000000',         'text',   'general',   'Company Phone'),
  ('currency',           'INR',                    'select', 'general',   'Currency'),
  ('currency_symbol',    '₹',                      'text',   'general',   'Currency Symbol'),
  ('financial_year',     'April',                  'select', 'general',   'Financial Year Start'),
  ('working_hours_day',  '8',                      'number', 'general',   'Working Hours Per Day'),
  ('timezone',           'Asia/Kolkata',            'select', 'general',   'Timezone'),
  ('pf_rate',            '12',                     'number', 'payroll',   'PF Rate (%)'),
  ('professional_tax',   '200',                    'number', 'payroll',   'Professional Tax (fixed)'),
  ('hra_rate',           '25',                     'number', 'payroll',   'HRA Rate (% of basic)'),
  ('conveyance',         '3000',                   'number', 'payroll',   'Conveyance Allowance'),
  ('casual_leave_days',  '12',                     'number', 'leave',     'Casual Leave Days/Year'),
  ('sick_leave_days',    '6',                      'number', 'leave',     'Sick Leave Days/Year'),
  ('emergency_leave_days','3',                     'number', 'leave',     'Emergency Leave Days/Year'),
  ('whatsapp_api_url',   '',                       'text',   'integrations', 'WhatsApp API URL'),
  ('whatsapp_api_key',   '',                       'text',   'integrations', 'WhatsApp API Key')
ON CONFLICT (setting_key) DO NOTHING;

-- ─── Employees ───
INSERT INTO "NSC_HR_employees" (id, employee_code, full_name, mobile, whatsapp, email, address, joining_date, department, designation, emp_type, salary_type, monthly_salary, hourly_rate, active) VALUES
  ('11111111-1111-1111-1111-111111111101', 'NSC001', 'Rahul Kumar',  '+91 9001001001', '+91 9001001001', 'rahul@nsc.com',  'Mumbai, MH', '2023-01-15', 'Engineering', 'Senior Developer',    'permanent', 'monthly', 45000, NULL, true),
  ('11111111-1111-1111-1111-111111111102', 'NSC002', 'Priya Sharma', '+91 9002002002', '+91 9002002002', 'priya@nsc.com',  'Pune, MH',   '2023-03-10', 'Design',      'UI/UX Designer',      'part-time', 'monthly', 25000, NULL, true),
  ('11111111-1111-1111-1111-111111111103', 'NSC003', 'Ahmed Malik',  '+91 9003003003', '+91 9003003003', 'ahmed@nsc.com',  'Delhi, DL',  '2023-06-01', 'Sales',       'Sales Executive',     'part-time', 'hourly',  NULL,  180,  true),
  ('11111111-1111-1111-1111-111111111104', 'NSC004', 'Neha Patel',   '+91 9004004004', '+91 9004004004', 'neha@nsc.com',   'Ahmedabad, GJ','2022-02-20','HR',         'HR Manager',          'permanent', 'monthly', 38000, NULL, true),
  ('11111111-1111-1111-1111-111111111105', 'NSC005', 'Suresh Reddy', '+91 9005005005', '+91 9005005005', 'suresh@nsc.com', 'Hyderabad, TS','2021-11-05','Finance',    'Finance Manager',     'permanent', 'monthly', 52000, NULL, true),
  ('11111111-1111-1111-1111-111111111106', 'NSC006', 'Kavya Nair',   '+91 9006006006', '+91 9006006006', 'kavya@nsc.com',  'Kochi, KL',  '2023-09-01', 'Marketing',   'Marketing Executive', 'part-time', 'monthly', 30000, NULL, true),
  ('11111111-1111-1111-1111-111111111107', 'NSC007', 'Rajan Pillai', '+91 9007007007', '+91 9007007007', 'rajan@nsc.com',  'Chennai, TN','2022-04-12', 'Engineering', 'Backend Developer',   'permanent', 'monthly', 48000, NULL, true),
  ('11111111-1111-1111-1111-111111111108', 'NSC008', 'Sneha Gupta',  '+91 9008008008', '+91 9008008008', 'sneha@nsc.com',  'Jaipur, RJ', '2024-01-08', 'Design',      'Graphic Designer',    'part-time', 'hourly',  NULL,  200,  true)
ON CONFLICT (employee_code) DO NOTHING;

-- ─── Users ───
-- Passwords: admin123 / emp123 (bcrypt hashed, cost 10)
INSERT INTO "NSC_HR_users" (id, username, password_hash, role, employee_id, active) VALUES
  ('22222222-2222-2222-2222-222222222201', 'admin',  '$2b$10$8wwpxOx0qB5Oc4T5UzD85e1asMaLDfFwYSRgzasTYdAFEotEstzIq', 'admin',    NULL,                                     true),
  ('22222222-2222-2222-2222-222222222202', 'rahul',  '$2b$10$BfEusviJH0NnQzLPEphZ4ONpm59gpQTpUr4VS4lX.tps3Au1AvgfO', 'employee', '11111111-1111-1111-1111-111111111101', true),
  ('22222222-2222-2222-2222-222222222203', 'priya',  '$2b$10$BfEusviJH0NnQzLPEphZ4ONpm59gpQTpUr4VS4lX.tps3Au1AvgfO', 'employee', '11111111-1111-1111-1111-111111111102', true),
  ('22222222-2222-2222-2222-222222222204', 'ahmed',  '$2b$10$BfEusviJH0NnQzLPEphZ4ONpm59gpQTpUr4VS4lX.tps3Au1AvgfO', 'employee', '11111111-1111-1111-1111-111111111103', true),
  ('22222222-2222-2222-2222-222222222205', 'neha',   '$2b$10$BfEusviJH0NnQzLPEphZ4ONpm59gpQTpUr4VS4lX.tps3Au1AvgfO', 'employee', '11111111-1111-1111-1111-111111111104', true),
  ('22222222-2222-2222-2222-222222222206', 'suresh', '$2b$10$BfEusviJH0NnQzLPEphZ4ONpm59gpQTpUr4VS4lX.tps3Au1AvgfO', 'employee', '11111111-1111-1111-1111-111111111105', true),
  ('22222222-2222-2222-2222-222222222207', 'kavya',  '$2b$10$BfEusviJH0NnQzLPEphZ4ONpm59gpQTpUr4VS4lX.tps3Au1AvgfO', 'employee', '11111111-1111-1111-1111-111111111106', true),
  ('22222222-2222-2222-2222-222222222208', 'rajan',  '$2b$10$BfEusviJH0NnQzLPEphZ4ONpm59gpQTpUr4VS4lX.tps3Au1AvgfO', 'employee', '11111111-1111-1111-1111-111111111107', true),
  ('22222222-2222-2222-2222-222222222209', 'sneha',  '$2b$10$BfEusviJH0NnQzLPEphZ4ONpm59gpQTpUr4VS4lX.tps3Au1AvgfO', 'employee', '11111111-1111-1111-1111-111111111108', true)
ON CONFLICT (username) DO NOTHING;
-- admin password: admin123 | employee passwords: emp123

-- ─── Leave Balances (current year) ───
INSERT INTO "NSC_HR_leave_balances" (employee_id, year, leave_type, total_days, used_days) VALUES
  ('11111111-1111-1111-1111-111111111101', 2026, 'Casual Leave',    12, 3),
  ('11111111-1111-1111-1111-111111111101', 2026, 'Sick Leave',       6, 1),
  ('11111111-1111-1111-1111-111111111101', 2026, 'Emergency Leave',  3, 0),
  ('11111111-1111-1111-1111-111111111102', 2026, 'Casual Leave',    12, 2),
  ('11111111-1111-1111-1111-111111111102', 2026, 'Sick Leave',       6, 0),
  ('11111111-1111-1111-1111-111111111102', 2026, 'Emergency Leave',  3, 0),
  ('11111111-1111-1111-1111-111111111103', 2026, 'Casual Leave',    12, 1),
  ('11111111-1111-1111-1111-111111111103', 2026, 'Sick Leave',       6, 2),
  ('11111111-1111-1111-1111-111111111103', 2026, 'Emergency Leave',  3, 0),
  ('11111111-1111-1111-1111-111111111104', 2026, 'Casual Leave',    12, 5),
  ('11111111-1111-1111-1111-111111111104', 2026, 'Sick Leave',       6, 1),
  ('11111111-1111-1111-1111-111111111104', 2026, 'Emergency Leave',  3, 0),
  ('11111111-1111-1111-1111-111111111105', 2026, 'Casual Leave',    12, 2),
  ('11111111-1111-1111-1111-111111111105', 2026, 'Sick Leave',       6, 0),
  ('11111111-1111-1111-1111-111111111105', 2026, 'Emergency Leave',  3, 0),
  ('11111111-1111-1111-1111-111111111106', 2026, 'Casual Leave',    12, 1),
  ('11111111-1111-1111-1111-111111111106', 2026, 'Sick Leave',       6, 0),
  ('11111111-1111-1111-1111-111111111106', 2026, 'Emergency Leave',  3, 0),
  ('11111111-1111-1111-1111-111111111107', 2026, 'Casual Leave',    12, 0),
  ('11111111-1111-1111-1111-111111111107', 2026, 'Sick Leave',       6, 0),
  ('11111111-1111-1111-1111-111111111107', 2026, 'Emergency Leave',  3, 0),
  ('11111111-1111-1111-1111-111111111108', 2026, 'Casual Leave',    12, 0),
  ('11111111-1111-1111-1111-111111111108', 2026, 'Sick Leave',       6, 0),
  ('11111111-1111-1111-1111-111111111108', 2026, 'Emergency Leave',  3, 0)
ON CONFLICT (employee_id, year, leave_type) DO NOTHING;

-- ─── Work Entries ───
INSERT INTO "NSC_HR_work_entries" (employee_id, entry_date, start_time, end_time, total_hours, task_description, status) VALUES
  ('11111111-1111-1111-1111-111111111101', '2026-04-24', '09:00', '17:00', 8.0,  'Frontend development - React components', 'pending'),
  ('11111111-1111-1111-1111-111111111102', '2026-04-24', '10:00', '16:30', 6.5,  'UI/UX design mockups for client',          'pending'),
  ('11111111-1111-1111-1111-111111111103', '2026-04-23', '09:30', '16:30', 7.0,  'Sales calls & lead generation',            'pending'),
  ('11111111-1111-1111-1111-111111111106', '2026-04-23', '09:00', '13:00', 4.0,  'Social media content creation',            'pending'),
  ('11111111-1111-1111-1111-111111111107', '2026-04-22', '09:00', '18:00', 9.0,  'Backend API development + testing',        'approved'),
  ('11111111-1111-1111-1111-111111111108', '2026-04-22', '11:00', '15:00', 4.0,  'Logo design iterations',                   'rejected'),
  ('11111111-1111-1111-1111-111111111101', '2026-04-23', '09:30', '17:00', 7.5,  'API integration work',                     'approved'),
  ('11111111-1111-1111-1111-111111111101', '2026-04-22', '10:00', '16:00', 6.0,  'Client meeting + docs',                    'approved');

-- ─── Leave Requests ───
INSERT INTO "NSC_HR_leave_requests" (employee_id, leave_type, from_date, to_date, total_days, reason, status) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Casual Leave',    '2026-04-28', '2026-04-29', 2, 'Personal work',      'pending'),
  ('11111111-1111-1111-1111-111111111102', 'Sick Leave',      '2026-04-27', '2026-04-27', 1, 'Medical appointment','pending'),
  ('11111111-1111-1111-1111-111111111105', 'Emergency Leave', '2026-04-30', '2026-04-30', 1, 'Family emergency',   'pending'),
  ('11111111-1111-1111-1111-111111111106', 'Casual Leave',    '2026-05-02', '2026-05-03', 2, 'Travel',             'approved'),
  ('11111111-1111-1111-1111-111111111103', 'Sick Leave',      '2026-04-20', '2026-04-21', 2, 'Fever',              'approved');

-- ─── Payroll for April 2026 ───
INSERT INTO "NSC_HR_payroll" (employee_id, payroll_month, basic_salary, hra, conveyance, overtime_pay, bonus, gross_earnings, pf_employee, professional_tax, advance_deduction, total_deductions, net_pay, approved_hours, status, payment_method, transaction_ref, payment_date) VALUES
  ('11111111-1111-1111-1111-111111111101', '2026-04', 45000, 11250, 3000, 2000, 5000, 66250, 5400, 200, 1000, 6600, 59650, 0,    'generated', 'Bank Transfer', 'TXN2604250001', '2026-04-30'),
  ('11111111-1111-1111-1111-111111111102', '2026-04', 25000, 6250,  3000, 0,    0,    34250, 3000, 200, 0,    3200, 31050, 0,    'paid',      'UPI',           'UPI2604250002', '2026-04-28'),
  ('11111111-1111-1111-1111-111111111103', '2026-04', 0,     0,     0,    1500, 0,    18900, 0,    0,   0,    0,    18900, 105,  'draft',     NULL,             NULL,            NULL),
  ('11111111-1111-1111-1111-111111111104', '2026-04', 38000, 9500,  3000, 0,    0,    50500, 4560, 200, 0,    4760, 45740, 0,    'paid',      'Bank Transfer', 'TXN2604250004', '2026-04-28'),
  ('11111111-1111-1111-1111-111111111105', '2026-04', 52000, 13000, 3000, 3000, 8000, 79000, 6240, 200, 2000, 8440, 70560, 0,    'generated', 'Bank Transfer', NULL,             '2026-04-30')
ON CONFLICT (employee_id, payroll_month) DO NOTHING;

-- ─── Notifications ───
INSERT INTO "NSC_HR_notifications" (title, message, target_role, notification_type, read_status, created_at) VALUES
  ('Salary Generated',       'April 2026 salary has been generated for all employees.',    'all',      'in-app', false, NOW() - INTERVAL '2 hours'),
  ('Work Entry Approved',    'Your Apr 24 work entry has been approved.',                   'employee', 'in-app', false, NOW() - INTERVAL '3 hours'),
  ('Leave Approved',         'Your leave request for Apr 28-29 has been approved.',         'employee', 'in-app', true,  NOW() - INTERVAL '5 hours'),
  ('Office Holiday',         'Office will be closed on May 1 — Labour Day holiday.',        'all',      'in-app', false, NOW() - INTERVAL '2 days'),
  ('Payment Completed',      'Salary has been transferred successfully for April 2026.',    'employee', 'in-app', true,  NOW() - INTERVAL '3 days');
