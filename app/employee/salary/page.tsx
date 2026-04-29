'use client';
import { useState, useEffect } from 'react';
import { EmployeeTopbar } from '@/components/employee/EmployeeTopbar';
import { Badge } from '@/components/ui/Badge';
import { useUser } from '@/lib/hooks';
import { formatCurrency, getMonthOptions, getPayrollMonthLabel } from '@/lib/utils';
import { Payroll } from '@/types';

interface WorkEntry {
  id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  adjusted_hours?: number;
  task_description?: string;
  status: string;
  admin_remark?: string;
}

interface Adjustment {
  id: string;
  adj_type: string;
  amount: number;
  reason?: string;
  adj_month: string;
  applied: boolean;
}

const TYPE_META: Record<string, { label: string; color: string; sign: string }> = {
  bonus:     { label: 'Bonus',            color: 'var(--success)', sign: '+' },
  overtime:  { label: 'Overtime Pay',     color: 'var(--success)', sign: '+' },
  allowance: { label: 'Allowance',        color: 'var(--success)', sign: '+' },
  deduction: { label: 'Deduction',        color: 'var(--danger)',  sign: '−' },
  advance:   { label: 'Advance Recovery', color: 'var(--danger)',  sign: '−' },
};

function InfoRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-2)', fontSize: 14 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: color || 'var(--text-1)', fontSize: bold ? 15 : 14 }}>{value}</span>
    </div>
  );
}

export default function SalaryPage() {
  const { user } = useUser();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payroll, setPayroll]       = useState<Payroll | null>(null);
  const [entries, setEntries]       = useState<WorkEntry[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading]       = useState(true);
  const monthOptions = getMonthOptions();

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/payroll?month=${month}`).then(r => r.json()),
      fetch(`/api/work-entries?month=${month}&status=approved`).then(r => r.json()),
      fetch(`/api/adjustments?month=${month}`).then(r => r.json()),
    ]).then(([pay, work, adj]) => {
      setPayroll(pay.data?.[0] || null);
      setEntries(work.data || []);
      setAdjustments(adj.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [month, user]);

  if (!user) return null;
  const emp = user.employee;

  // Calculate estimated salary when payroll not yet generated
  const approvedHours  = entries.reduce((s, e) => s + (e.adjusted_hours || e.total_hours), 0);
  const hourlyBase     = emp?.salary_type === 'hourly' ? approvedHours * (emp?.hourly_rate || 0) : (emp?.monthly_salary || 0);

  const adjAdditions   = adjustments.filter(a => ['bonus','overtime','allowance'].includes(a.adj_type)).reduce((s, a) => s + a.amount, 0);
  const adjDeductions  = adjustments.filter(a => ['deduction','advance'].includes(a.adj_type)).reduce((s, a) => s + a.amount, 0);
  const estimatedNet   = hourlyBase + adjAdditions - adjDeductions;

  return (
    <>
      <EmployeeTopbar
        title="My Salary"
        user={user}
        actions={
          <select className="form-select" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)}>
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        }
      />
      <div className="page-content">
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Top banner */}
            <div style={{ background: 'var(--sidebar-2)', borderRadius: 'var(--radius)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6 }}>
                  {payroll ? 'Net Pay' : 'Estimated Salary'} · {getPayrollMonthLabel(month)}
                </div>
                <div style={{ color: '#fff', fontSize: 32, fontWeight: 800 }}>
                  {payroll ? formatCurrency(payroll.net_pay) : formatCurrency(estimatedNet)}
                </div>
                {!payroll && (
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>
                    Payroll not generated yet — estimated from approved hours &amp; adjustments
                  </div>
                )}
              </div>
              {payroll ? (
                <Badge status={payroll.status}>
                  {payroll.status === 'paid' ? '✓ Salary Paid' : payroll.status === 'generated' ? '⏳ Pending Payment' : '📋 Draft'}
                </Badge>
              ) : (
                <Badge status="pending">📋 Not Generated</Badge>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* Work Hours breakdown */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>⏱ Approved Work Hours</span>
                  <span style={{ color: 'var(--primary)', fontSize: 13 }}>{approvedHours.toFixed(2)} hrs</span>
                </div>
                {entries.length === 0 ? (
                  <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>No approved entries this month</div>
                ) : (
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    <table className="data-table" style={{ fontSize: 13 }}>
                      <thead>
                        <tr><th>Date</th><th>Hours</th><th>Description</th></tr>
                      </thead>
                      <tbody>
                        {entries.map(e => (
                          <tr key={e.id}>
                            <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                              {new Date(e.entry_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'short' })}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {(e.adjusted_hours || e.total_hours).toFixed(2)}
                              {e.adjusted_hours && e.adjusted_hours !== e.total_hours && (
                                <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>
                                  (adj from {e.total_hours.toFixed(2)})
                                </span>
                              )}
                            </td>
                            <td className="muted" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {e.task_description || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {emp?.salary_type === 'hourly' && approvedHours > 0 && (
                  <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-2)' }}>{approvedHours.toFixed(2)} hrs × {formatCurrency(emp.hourly_rate || 0)}/hr</span>
                    <strong style={{ color: 'var(--success)' }}>{formatCurrency(hourlyBase)}</strong>
                  </div>
                )}
              </div>

              {/* Adjustments */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🧾 Adjustments</span>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{adjustments.length} entr{adjustments.length === 1 ? 'y' : 'ies'}</span>
                </div>
                {adjustments.length === 0 ? (
                  <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>No adjustments this month</div>
                ) : (
                  <div>
                    {adjustments.map(a => {
                      const meta = TYPE_META[a.adj_type] || { label: a.adj_type, color: 'var(--text-1)', sign: '' };
                      return (
                        <div key={a.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: meta.color }}>{meta.label}</div>
                            {a.reason && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{a.reason}</div>}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: meta.color }}>
                              {meta.sign}{formatCurrency(a.amount)}
                            </div>
                            <div style={{ fontSize: 11, marginTop: 2 }}>
                              <Badge status={a.applied ? 'active' : 'pending'}>
                                {a.applied ? 'Applied' : 'Pending'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {adjustments.length > 0 && (
                  <div style={{ padding: '10px 20px', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-2)' }}>Net from adjustments</span>
                    <strong style={{ color: adjAdditions - adjDeductions >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {adjAdditions - adjDeductions >= 0 ? '+' : '−'}{formatCurrency(Math.abs(adjAdditions - adjDeductions))}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            {/* Salary breakdown — show if payroll generated */}
            {payroll ? (
              <div className="card" style={{ padding: '20px 24px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Salary Breakdown</div>
                {(() => {
                  const hasDeductions = (payroll.advance_deduction > 0) || (payroll.leave_deductions > 0);
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: hasDeductions ? '1fr 1fr' : '1fr', gap: '0 40px' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>+ Earnings</div>
                        <InfoRow label="Basic Salary" value={formatCurrency(payroll.basic_salary)} />
                        {payroll.hra         > 0 && <InfoRow label="HRA"          value={formatCurrency(payroll.hra)} />}
                        {payroll.conveyance  > 0 && <InfoRow label="Conveyance"   value={formatCurrency(payroll.conveyance)} />}
                        {payroll.overtime_pay > 0 && <InfoRow label="Overtime Pay" value={formatCurrency(payroll.overtime_pay)} color="var(--success)" />}
                        {payroll.bonus        > 0 && <InfoRow label="Bonus"        value={formatCurrency(payroll.bonus)} color="var(--success)" />}
                        <InfoRow label="Gross Earnings" value={formatCurrency(payroll.gross_earnings)} bold color="var(--success)" />
                      </div>
                      {hasDeductions && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>− Deductions</div>
                          {payroll.advance_deduction > 0 && <InfoRow label="Advance Deduction" value={`-${formatCurrency(payroll.advance_deduction)}`} color="var(--danger)" />}
                          {payroll.leave_deductions  > 0 && <InfoRow label="Leave Deductions"  value={`-${formatCurrency(payroll.leave_deductions)}`}  color="var(--danger)" />}
                          <InfoRow label="Total Deductions" value={`-${formatCurrency(payroll.total_deductions)}`} bold color="var(--danger)" />
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* Net pay bar */}
                <div style={{ marginTop: 20, background: 'var(--primary-light)', border: '1.5px solid var(--primary)', borderRadius: 10, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Net Pay (Take Home)</span>
                  <strong style={{ fontSize: 24, color: 'var(--primary)' }}>{formatCurrency(payroll.net_pay)}</strong>
                </div>
                {payroll.status === 'paid' && (
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                    {[
                      { l: 'Payment Date', v: payroll.payment_date ? new Date(payroll.payment_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                      { l: 'Method',       v: payroll.payment_method || '—' },
                      { l: 'Reference',    v: payroll.transaction_ref || '—' },
                      { l: 'Account',      v: payroll.bank_last4 ? `••••${payroll.bank_last4}` : '—' },
                    ].map(s => (
                      <div key={s.l} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{s.l}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Estimated breakdown when payroll not yet generated */
              <div className="card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Salary Breakdown</div>
                  <Badge status="pending">📋 Not Generated</Badge>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Payroll not generated yet — this is an estimate based on current approved hours &amp; adjustments.</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>+ Earnings</div>
                  <InfoRow
                    label={emp?.salary_type === 'hourly' ? `Basic Salary (${approvedHours.toFixed(2)} hrs × ${formatCurrency(emp?.hourly_rate || 0)}/hr)` : 'Basic Salary'}
                    value={formatCurrency(hourlyBase)}
                  />
                  {adjAdditions > 0 && <InfoRow label="Bonus / Overtime" value={`+${formatCurrency(adjAdditions)}`} color="var(--success)" />}
                  <InfoRow label="Gross Earnings" value={formatCurrency(hourlyBase + adjAdditions)} bold color="var(--success)" />
                </div>
                {adjDeductions > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>− Deductions</div>
                    <InfoRow label="Advance / Deductions" value={`-${formatCurrency(adjDeductions)}`} color="var(--danger)" />
                    <InfoRow label="Total Deductions" value={`-${formatCurrency(adjDeductions)}`} bold color="var(--danger)" />
                  </div>
                )}
                <div style={{ marginTop: 20, background: 'var(--primary-light)', border: '1.5px solid var(--primary)', borderRadius: 10, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Estimated Net Pay</span>
                  <strong style={{ fontSize: 24, color: 'var(--primary)' }}>{formatCurrency(estimatedNet)}</strong>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </>
  );
}
