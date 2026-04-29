// Shared payroll status logic — single source of truth for all pages.
// Classification is based on explicit payroll_id linkage (NSC_HR_payroll_items),
// NOT on created_at timestamp comparisons.

export interface PayrollRecord {
  id: string;
  payroll_type?: string;       // 'regular' | 'supplement'
  created_at?: string;
  status: string;              // 'draft' | 'generated' | 'paid'
  net_pay?: number;
  payment_date?: string;
  payment_method?: string;
}

export interface EntryRecord {
  id: string;
  employee_id?: string;
  entry_date: string;
  total_hours: number;
  adjusted_hours?: number;
  task_description?: string;
  status: string;              // 'pending' | 'approved' | 'rejected'
  created_at?: string;
  admin_remark?: string;
  // Set by callers after fetching payroll_items — which payroll this entry is linked to
  payroll_id?: string | null;
}

// Per-entry salary status — what the employee/admin sees in each row
export type EntrySalaryStatus =
  | 'pending_approval'   // not yet approved
  | 'rejected'           // rejected by admin
  | 'no_payroll'         // approved but no payroll linked
  | 'paid'               // linked payroll is paid
  | 'unpaid'             // linked payroll is generated but not paid
  | 'next_cycle';        // approved but no payroll at all yet (alias of no_payroll, used for badge)

export interface EntryWithStatus extends EntryRecord {
  salaryStatus: EntrySalaryStatus;
}

export interface PayrollSummary {
  regularPayroll: PayrollRecord | null;
  supplementPayroll: PayrollRecord | null;   // latest supplement (for compat)

  // Hour buckets — only approved entries
  paidHours: number;
  unpaidHours: number;
  nextCycleHours: number;    // approved entries with no payroll linkage
  pendingHours: number;
  totalApprovedHours: number;

  overallStatus: 'paid' | 'unpaid' | 'pending_generation' | 'no_payroll' | 'partial';
  totalNetPay: number;
  entriesWithStatus: EntryWithStatus[];
}

// Classify each work entry using its explicit payroll_id link.
// payrolls is a map: payroll.id → PayrollRecord for O(1) lookup.
export function classifyEntries(
  entries: EntryRecord[],
  payrollMap: Map<string, PayrollRecord>,
  hasAnyPayroll: boolean,
): EntryWithStatus[] {
  return entries.map(e => {
    if (e.status === 'rejected') return { ...e, salaryStatus: 'rejected' as const };
    if (e.status === 'pending')  return { ...e, salaryStatus: 'pending_approval' as const };

    // Approved entry
    if (!e.payroll_id) {
      // Not linked to any payroll
      return { ...e, salaryStatus: (hasAnyPayroll ? 'next_cycle' : 'no_payroll') as EntrySalaryStatus };
    }

    const pay = payrollMap.get(e.payroll_id);
    if (!pay) {
      // Linked payroll not in our dataset (shouldn't happen, but guard)
      return { ...e, salaryStatus: 'no_payroll' as const };
    }

    const sal: EntrySalaryStatus = pay.status === 'paid' ? 'paid' : 'unpaid';
    return { ...e, salaryStatus: sal };
  });
}

export function buildPayrollSummary(
  allPayrolls: PayrollRecord[],
  entries: EntryRecord[],
): PayrollSummary {
  const regularPayroll = allPayrolls.find(p => (p.payroll_type ?? 'regular') === 'regular') ?? null;
  const supplements = allPayrolls.filter(p => p.payroll_type === 'supplement');
  const supplementPayroll = supplements
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0] ?? null;

  const payrollMap = new Map<string, PayrollRecord>(allPayrolls.map(p => [p.id, p]));
  const hasAnyPayroll = allPayrolls.length > 0;

  const annotated = classifyEntries(entries, payrollMap, hasAnyPayroll);

  const hours = (status: EntrySalaryStatus) =>
    annotated
      .filter(e => e.salaryStatus === status)
      .reduce((s, e) => s + (e.adjusted_hours || e.total_hours), 0);

  const paidHours      = hours('paid');
  const unpaidHours    = hours('unpaid');
  const nextCycleHours = hours('next_cycle') + hours('no_payroll');
  const pendingHours   = hours('pending_approval');
  const totalApprovedHours = annotated
    .filter(e => e.status === 'approved')
    .reduce((s, e) => s + (e.adjusted_hours || e.total_hours), 0);

  const totalNetPay = allPayrolls.reduce((s, p) => s + (p.net_pay ?? 0), 0);

  let overallStatus: PayrollSummary['overallStatus'] = 'no_payroll';
  if (regularPayroll) {
    const regPaid      = regularPayroll.status === 'paid';
    const allSuppPaid  = supplements.length === 0 || supplements.every(p => p.status === 'paid');
    const anyUnpaidSupp = supplements.some(p => p.status !== 'paid');
    const hasUnlinked   = nextCycleHours > 0;

    if (regPaid && allSuppPaid && !hasUnlinked) {
      overallStatus = 'paid';
    } else if (regPaid && (anyUnpaidSupp || hasUnlinked)) {
      overallStatus = 'partial';
    } else {
      overallStatus = 'unpaid';
    }
  } else if (totalApprovedHours > 0) {
    overallStatus = 'pending_generation';
  }

  return {
    regularPayroll,
    supplementPayroll,
    paidHours,
    unpaidHours,
    nextCycleHours,
    pendingHours,
    totalApprovedHours,
    overallStatus,
    totalNetPay,
    entriesWithStatus: annotated,
  };
}

// UI helpers
export const SALARY_STATUS_LABEL: Record<EntrySalaryStatus, string> = {
  paid:             '✓ Paid',
  unpaid:           '⏳ Unpaid',
  next_cycle:       'Next Cycle',
  no_payroll:       'Not Generated',
  pending_approval: 'Pending Approval',
  rejected:         'Rejected',
};

export const SALARY_STATUS_COLOR: Record<EntrySalaryStatus, string> = {
  paid:             'var(--success)',
  unpaid:           '#b45309',
  next_cycle:       '#ea580c',
  no_payroll:       'var(--text-3)',
  pending_approval: 'var(--primary)',
  rejected:         'var(--danger)',
};

export const OVERALL_STATUS_LABEL: Record<PayrollSummary['overallStatus'], string> = {
  paid:               '✓ Salary Paid',
  unpaid:             '⏳ Pending Payment',
  partial:            '⚠ Partially Paid',
  pending_generation: '📋 Pending Generation',
  no_payroll:         '📋 Not Generated',
};

export const OVERALL_STATUS_BADGE: Record<PayrollSummary['overallStatus'], string> = {
  paid:               'active',
  unpaid:             'pending',
  partial:            'pending',
  pending_generation: 'pending',
  no_payroll:         'inactive',
};
