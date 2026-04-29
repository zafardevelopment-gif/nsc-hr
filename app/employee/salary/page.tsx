'use client';
import { useState, useEffect } from 'react';
import { EmployeeTopbar } from '@/components/employee/EmployeeTopbar';
import { Badge } from '@/components/ui/Badge';
import { useUser } from '@/lib/hooks';
import { formatCurrency, getMonthOptions, getPayrollMonthLabel } from '@/lib/utils';
import { Payroll } from '@/types';
import {
  buildPayrollSummary,
  OVERALL_STATUS_LABEL,
  OVERALL_STATUS_BADGE,
  SALARY_STATUS_LABEL,
  SALARY_STATUS_COLOR,
  EntryRecord,
} from '@/lib/payrollStatus';

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

const PAGE_SIZE = 10;

export default function SalaryPage() {
  const { user } = useUser();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payrolls, setPayrolls]       = useState<Payroll[]>([]);
  const [entries, setEntries]         = useState<EntryRecord[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [entryPage, setEntryPage]     = useState(1);
  const [entrySearch, setEntrySearch] = useState('');
  const monthOptions = getMonthOptions();

  useEffect(() => { setEntryPage(1); setEntrySearch(''); }, [month]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/payroll?month=${month}`).then(r => r.json()),
      fetch(`/api/work-entries?month=${month}&status=approved`).then(r => r.json()),
      fetch(`/api/adjustments?month=${month}`).then(r => r.json()),
    ]).then(([pay, work, adj]) => {
      setPayrolls(pay.data || []);
      setEntries(work.data || []);
      setAdjustments(adj.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [month, user]);

  if (!user) return null;
  const emp = user.employee;

  const summary = buildPayrollSummary(payrolls, entries);
  const { regularPayroll, supplementPayroll, entriesWithStatus,
          paidHours, unpaidHours, nextCycleHours, totalApprovedHours,
          overallStatus, totalNetPay } = summary;
  // All supplement records sorted oldest→newest for display
  const allSupplements = payrolls
    .filter(p => p.payroll_type === 'supplement')
    .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()) as unknown as Payroll[];

  const adjAdditions  = adjustments.filter(a => ['bonus','overtime','allowance'].includes(a.adj_type)).reduce((s, a) => s + a.amount, 0);
  const adjDeductions = adjustments.filter(a => ['deduction','advance'].includes(a.adj_type)).reduce((s, a) => s + a.amount, 0);

  // Estimated net when no payroll exists yet
  const hourlyBase   = emp?.salary_type === 'hourly' ? totalApprovedHours * (emp?.hourly_rate || 0) : (emp?.monthly_salary || 0);
  const estimatedNet = hourlyBase + adjAdditions - adjDeductions;

  // Filtered + paginated entries for the hours table
  const filteredEntries = entriesWithStatus.filter(e =>
    !entrySearch ||
    e.task_description?.toLowerCase().includes(entrySearch.toLowerCase()) ||
    e.entry_date?.includes(entrySearch)
  );
  const totalEntryPages = Math.ceil(filteredEntries.length / PAGE_SIZE);
  const pagedEntries    = filteredEntries.slice((entryPage - 1) * PAGE_SIZE, entryPage * PAGE_SIZE);

  const displayPayroll = regularPayroll ?? (payrolls[0] as Payroll | undefined) ?? null;

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
                  {displayPayroll ? 'Net Pay' : 'Estimated Salary'} · {getPayrollMonthLabel(month)}
                </div>
                <div style={{ color: '#fff', fontSize: 32, fontWeight: 800 }}>
                  {displayPayroll ? formatCurrency(totalNetPay) : formatCurrency(estimatedNet)}
                </div>
                {allSupplements.length > 0 && (
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
                    Regular: {formatCurrency(regularPayroll?.net_pay ?? 0)}
                    {allSupplements.map((s, i) => ` + Supplement${allSupplements.length > 1 ? ` ${i + 1}` : ''}: ${formatCurrency(s.net_pay ?? 0)}`).join('')}
                  </div>
                )}
                {!displayPayroll && (
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>
                    Estimated from approved hours &amp; adjustments
                  </div>
                )}
              </div>
              <Badge status={OVERALL_STATUS_BADGE[overallStatus] as 'active' | 'pending' | 'inactive'}>
                {OVERALL_STATUS_LABEL[overallStatus]}
              </Badge>
            </div>

            {/* Hours summary strip — only when there's something to show */}
            {totalApprovedHours > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {[
                  { l: 'Total Approved',  v: `${totalApprovedHours.toFixed(2)} hrs`,  color: 'var(--primary)' },
                  { l: 'Paid Hours',      v: `${paidHours.toFixed(2)} hrs`,           color: 'var(--success)' },
                  { l: 'Unpaid Hours',    v: `${unpaidHours.toFixed(2)} hrs`,          color: '#b45309' },
                  { l: 'Next Cycle',      v: `${nextCycleHours.toFixed(2)} hrs`,       color: '#ea580c' },
                ].map(s => (
                  <div key={s.l} className="card" style={{ padding: '14px 18px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{s.l}</div>
                    <div style={{ fontWeight: 800, fontSize: 20, color: s.color }}>{s.v}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* Work Hours with pagination */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>⏱ Approved Work Hours</span>
                  <span style={{ color: 'var(--primary)', fontSize: 13 }}>{totalApprovedHours.toFixed(2)} hrs</span>
                </div>
                <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                  <input className="form-input" placeholder="Search by date or description..." value={entrySearch}
                    onChange={e => { setEntrySearch(e.target.value); setEntryPage(1); }}
                    style={{ fontSize: 12 }} />
                </div>
                {entries.length === 0 ? (
                  <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>No approved entries this month</div>
                ) : (
                  <>
                    <div>
                      <table className="data-table" style={{ fontSize: 13 }}>
                        <thead>
                          <tr><th>Date</th><th>Hours</th><th>Description</th><th>Salary</th></tr>
                        </thead>
                        <tbody>
                          {pagedEntries.length === 0 ? (
                            <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-2)' }}>No results</td></tr>
                          ) : pagedEntries.map(e => (
                            <tr key={e.id}>
                              <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                                {new Date(e.entry_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'short' })}
                              </td>
                              <td style={{ fontWeight: 600 }}>
                                {(e.adjusted_hours || e.total_hours).toFixed(2)}
                                {e.adjusted_hours && e.adjusted_hours !== e.total_hours && (
                                  <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>(adj from {e.total_hours.toFixed(2)})</span>
                                )}
                              </td>
                              <td className="muted" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {e.task_description || '—'}
                              </td>
                              <td>
                                <span style={{ fontSize: 11, fontWeight: 600, color: SALARY_STATUS_COLOR[e.salaryStatus] }}>
                                  {SALARY_STATUS_LABEL[e.salaryStatus]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination */}
                    {totalEntryPages > 1 && (
                      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-2)' }}>
                        <span>{filteredEntries.length} entries</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setEntryPage(p => Math.max(1, p - 1))} disabled={entryPage === 1}
                            style={{ padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 4, cursor: entryPage === 1 ? 'not-allowed' : 'pointer', background: 'none' }}>‹</button>
                          <span style={{ padding: '2px 8px' }}>{entryPage}/{totalEntryPages}</span>
                          <button onClick={() => setEntryPage(p => Math.min(totalEntryPages, p + 1))} disabled={entryPage === totalEntryPages}
                            style={{ padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 4, cursor: entryPage === totalEntryPages ? 'not-allowed' : 'pointer', background: 'none' }}>›</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {emp?.salary_type === 'hourly' && totalApprovedHours > 0 && (
                  <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-2)' }}>{totalApprovedHours.toFixed(2)} hrs × {formatCurrency(emp.hourly_rate || 0)}/hr</span>
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
                            <div style={{ fontWeight: 700, fontSize: 15, color: meta.color }}>{meta.sign}{formatCurrency(a.amount)}</div>
                            <div style={{ fontSize: 11, marginTop: 2 }}>
                              <Badge status={a.applied ? 'active' : 'pending'}>{a.applied ? 'Applied' : 'Pending'}</Badge>
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

            {/* Salary breakdown */}
            {displayPayroll ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Regular payroll breakdown */}
                {regularPayroll && (
                  <div className="card" style={{ padding: '20px 24px' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Salary Breakdown</span>
                      {supplementPayroll && <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 400 }}>Regular payroll</span>}
                    </div>
                    {(() => {
                      const p = regularPayroll as unknown as Payroll;
                      const hasD = (p.advance_deduction > 0) || (p.leave_deductions > 0);
                      return (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: hasD ? '1fr 1fr' : '1fr', gap: '0 40px' }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>+ Earnings</div>
                              <InfoRow label="Basic Salary" value={formatCurrency(p.basic_salary)} />
                              {p.hra          > 0 && <InfoRow label="HRA"          value={formatCurrency(p.hra)} />}
                              {p.conveyance   > 0 && <InfoRow label="Conveyance"   value={formatCurrency(p.conveyance)} />}
                              {p.overtime_pay > 0 && <InfoRow label="Overtime Pay" value={formatCurrency(p.overtime_pay)} color="var(--success)" />}
                              {p.bonus        > 0 && <InfoRow label="Bonus"        value={formatCurrency(p.bonus)} color="var(--success)" />}
                              <InfoRow label="Gross Earnings" value={formatCurrency(p.gross_earnings)} bold color="var(--success)" />
                            </div>
                            {hasD && (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>− Deductions</div>
                                {p.advance_deduction > 0 && <InfoRow label="Advance Deduction" value={`-${formatCurrency(p.advance_deduction)}`} color="var(--danger)" />}
                                {p.leave_deductions  > 0 && <InfoRow label="Leave Deductions"  value={`-${formatCurrency(p.leave_deductions)}`}  color="var(--danger)" />}
                                <InfoRow label="Total Deductions" value={`-${formatCurrency(p.total_deductions)}`} bold color="var(--danger)" />
                              </div>
                            )}
                          </div>
                          <div style={{ marginTop: 20, background: 'var(--primary-light)', border: '1.5px solid var(--primary)', borderRadius: 10, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Net Pay</span>
                            <strong style={{ fontSize: 24, color: 'var(--primary)' }}>{formatCurrency(p.net_pay)}</strong>
                          </div>
                          {p.status === 'paid' && (
                            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                              {[
                                { l: 'Payment Date', v: p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                                { l: 'Method',       v: p.payment_method || '—' },
                                { l: 'Reference',    v: p.transaction_ref || '—' },
                                { l: 'Account',      v: p.bank_last4 ? `••••${p.bank_last4}` : '—' },
                              ].map(s => (
                                <div key={s.l} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
                                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{s.l}</div>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.v}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* All supplement payroll breakdowns */}
                {allSupplements.map((supp, idx) => (
                  <div key={supp.id} className="card" style={{ padding: '20px 24px', border: '1.5px solid #6366f1' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, background: '#6366f1', color: '#fff', borderRadius: 4, padding: '1px 7px', fontWeight: 700 }}>SUPPLEMENT{allSupplements.length > 1 ? ` ${idx + 1}` : ''}</span>
                      <span>Additional Payroll</span>
                      <Badge status={supp.status === 'paid' ? 'active' : 'pending'}>{supp.status === 'paid' ? '✓ Paid' : '⏳ Unpaid'}</Badge>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Covers approved work entries submitted after the previous payroll was generated.</div>
                    <div style={{ background: 'var(--primary-light)', border: '1.5px solid var(--primary)', borderRadius: 10, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Supplement Net Pay</span>
                      <strong style={{ fontSize: 24, color: 'var(--primary)' }}>{formatCurrency(supp.net_pay ?? 0)}</strong>
                    </div>
                    {supp.status === 'paid' && (
                      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                        {[
                          { l: 'Payment Date', v: supp.payment_date ? new Date(supp.payment_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                          { l: 'Method',       v: supp.payment_method || '—' },
                          { l: 'Reference',    v: supp.transaction_ref || '—' },
                          { l: 'Account',      v: supp.bank_last4 ? `••••${supp.bank_last4}` : '—' },
                        ].map(s => (
                          <div key={s.l} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{s.l}</div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{s.v}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Estimated breakdown when no payroll yet */
              <div className="card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Salary Breakdown</div>
                  <Badge status="pending">📋 Not Generated</Badge>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Estimated from current approved hours &amp; adjustments.</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>+ Earnings</div>
                  <InfoRow
                    label={emp?.salary_type === 'hourly' ? `Basic Salary (${totalApprovedHours.toFixed(2)} hrs × ${formatCurrency(emp?.hourly_rate || 0)}/hr)` : 'Basic Salary'}
                    value={formatCurrency(hourlyBase)}
                  />
                  {adjAdditions > 0 && <InfoRow label="Bonus / Overtime" value={`+${formatCurrency(adjAdditions)}`} color="var(--success)" />}
                  <InfoRow label="Gross Earnings" value={formatCurrency(hourlyBase + adjAdditions)} bold color="var(--success)" />
                </div>
                {adjDeductions > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>− Deductions</div>
                    <InfoRow label="Advance / Deductions" value={`-${formatCurrency(adjDeductions)}`} color="var(--danger)" />
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
