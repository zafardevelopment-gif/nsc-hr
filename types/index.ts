export interface User {
  id: string;
  username: string;
  role: 'admin' | 'employee';
  employee_id?: string;
  active: boolean;
  employee?: Employee;
}

export interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  mobile?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  joining_date: string;
  department?: string;
  designation?: string;
  emp_type: 'permanent' | 'part-time';
  salary_type?: 'monthly' | 'hourly' | 'fixed';
  monthly_salary?: number;
  hourly_rate?: number;
  id_type?: 'iqama' | 'passport' | 'national_id';
  id_number?: string;
  id_expiry?: string;
  active: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  username?: string;
}

export interface WorkEntry {
  id: string;
  employee_id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  task_description?: string;
  proof_url?: string;
  proof_filename?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_remark?: string;
  adjusted_hours?: number;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at?: string;
  payroll_id?: string | null;   // from NSC_HR_payroll_items join
  employee?: Employee;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  total_days: number;
  reason?: string;
  doc_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_remark?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at?: string;
  employee?: Employee;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  year: number;
  leave_type: string;
  total_days: number;
  used_days: number;
}

export interface Payroll {
  id: string;
  employee_id: string;
  payroll_month: string;
  basic_salary: number;
  hra: number;
  conveyance: number;
  overtime_pay: number;
  bonus: number;
  gross_earnings: number;
  advance_deduction: number;
  total_deductions: number;
  net_pay: number;
  approved_hours: number;
  leave_deductions: number;
  payroll_type?: 'regular' | 'supplement';
  parent_payroll_id?: string;
  status: 'draft' | 'generated' | 'paid';
  payment_method?: string;
  transaction_ref?: string;
  payment_date?: string;
  payment_notes?: string;
  bank_last4?: string;
  created_at?: string;
  updated_at?: string;
  employee?: Employee;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  target_role?: string;
  employee_id?: string;
  notification_type: 'in-app' | 'whatsapp' | 'both';
  read_status: boolean;
  read_at?: string;
  created_at?: string;
}

export interface Setting {
  id: string;
  setting_key: string;
  setting_value?: string;
  setting_type?: string;
  category?: string;
  label?: string;
}

export interface ActivityLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at?: string;
}

export interface AuthSession {
  user: User;
  token: string;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}
