'use client';
import { useState, useEffect } from 'react';
import { EmployeeTopbar } from '@/components/employee/EmployeeTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useUser } from '@/lib/hooks';
import { formatCurrency, getMonthOptions, getPayrollMonthLabel } from '@/lib/utils';
import { Payroll } from '@/types';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface WorkEntry {
  id: string;
  entry_date: string;
  total_hours: number;
  adjusted_hours?: number;
  task_description?: string;
  status: string;
}

interface Adjustment {
  id: string;
  adj_type: string;
  amount: number;
  reason?: string;
  applied: boolean;
}

const ADJ_META: Record<string, { label: string; color: string; sign: string }> = {
  bonus:     { label: 'Bonus',            color: 'var(--success)', sign: '+' },
  overtime:  { label: 'Overtime Pay',     color: 'var(--success)', sign: '+' },
  allowance: { label: 'Allowance',        color: 'var(--success)', sign: '+' },
  deduction: { label: 'Deduction',        color: 'var(--danger)',  sign: '−' },
  advance:   { label: 'Advance Recovery', color: 'var(--danger)',  sign: '−' },
};

export default function PayslipPage() {
  const { user } = useUser();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payroll, setPayroll]         = useState<Payroll | null>(null);
  const [entries, setEntries]         = useState<WorkEntry[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<'payslip' | 'entries'>('payslip');
  const monthOptions = getMonthOptions();

  useEffect(() => { setActiveTab('payslip'); }, [month]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/payroll?month=${month}`).then(r => r.json()),
      fetch(`/api/work-entries?month=${month}`).then(r => r.json()),
      fetch(`/api/adjustments?month=${month}`).then(r => r.json()),
    ]).then(([pay, work, adj]) => {
      setPayroll(pay.data?.[0] || null);
      setEntries(work.data || []);
      setAdjustments(adj.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [month, user]);

  function downloadPDF() {
    if (!payroll || !user) return;
    const emp = user.employee;
    const doc = new jsPDF();

    // Header
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 44, 'F');
    doc.setFillColor(27, 168, 154);
    doc.rect(0, 0, 5, 44, 'F');
    doc.setDrawColor(230, 246, 245);
    doc.setLineWidth(0.5);
    doc.line(0, 44, 210, 44);
    try { doc.addImage('/nsc-logo.png', 'PNG', 12, 8, 26, 20); } catch {}
    doc.setTextColor(27, 168, 154);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('NSC Employee — Payslip', 46, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`${getPayrollMonthLabel(month)}`, 46, 28);
    doc.text(emp?.full_name || user.username, 204, 18, { align: 'right' });
    doc.text(`${emp?.employee_code || ''} · ${emp?.department || ''}`, 204, 28, { align: 'right' });

    // Employee details table
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text('Employee Details', 14, 56);
    autoTable(doc, {
      startY: 60,
      head: [['Field', 'Value']],
      body: [
        ['Name',          emp?.full_name || user.username],
        ['Employee Code', emp?.employee_code || '—'],
        ['Department',    emp?.department || '—'],
        ['Designation',   emp?.designation || '—'],
        ['Employee Type', emp?.emp_type === 'part-time' ? 'Part-Time' : emp?.emp_type === 'permanent' ? 'Permanent' : emp?.emp_type || '—'],
      ],
      theme: 'striped', styles: { fontSize: 9 },
      headStyles: { fillColor: [27, 168, 154] },
    });

    let y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Earnings & Deductions — hide deductions columns if none exist
    {
      const eRows: string[][] = [
        ['Basic Salary', formatCurrency(payroll.basic_salary)],
        ...(payroll.hra          > 0 ? [['HRA',          formatCurrency(payroll.hra)]]          : []),
        ...(payroll.conveyance   > 0 ? [['Conveyance',   formatCurrency(payroll.conveyance)]]   : []),
        ...(payroll.overtime_pay > 0 ? [['Overtime Pay', formatCurrency(payroll.overtime_pay)]] : []),
        ...(payroll.bonus        > 0 ? [['Bonus',        formatCurrency(payroll.bonus)]]        : []),
      ];
      const dRows: string[][] = [
        ...(payroll.advance_deduction > 0 ? [['Advance Deduction', formatCurrency(payroll.advance_deduction)]] : []),
        ...(payroll.leave_deductions  > 0 ? [['Leave Deductions',  formatCurrency(payroll.leave_deductions)]]  : []),
      ];
      if (dRows.length > 0) {
        const maxR = Math.max(eRows.length, dRows.length);
        const rows: string[][] = Array.from({ length: maxR }, (_, i) => [
          eRows[i]?.[0] ?? '', eRows[i]?.[1] ?? '',
          dRows[i]?.[0] ?? '', dRows[i]?.[1] ?? '',
        ]);
        rows.push(['GROSS EARNINGS', formatCurrency(payroll.gross_earnings), 'TOTAL DEDUCTIONS', formatCurrency(payroll.total_deductions)]);
        autoTable(doc, {
          startY: y, head: [['Earnings', 'Amount', 'Deductions', 'Amount']], body: rows,
          foot: [['NET PAY (TAKE HOME)', formatCurrency(payroll.net_pay), '', '']],
          theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [27, 168, 154] },
          footStyles: { fillColor: [230, 246, 245], textColor: [27, 168, 154], fontStyle: 'bold', fontSize: 10 },
        });
      } else {
        const rows = eRows.concat([['GROSS EARNINGS', formatCurrency(payroll.gross_earnings)]]);
        autoTable(doc, {
          startY: y, head: [['Earnings', 'Amount']], body: rows,
          foot: [['NET PAY (TAKE HOME)', formatCurrency(payroll.net_pay)]],
          theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [27, 168, 154] },
          footStyles: { fillColor: [230, 246, 245], textColor: [27, 168, 154], fontStyle: 'bold', fontSize: 10 },
        });
      }
    }

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    // Work entries
    if (entries.length > 0) {
      const totalHours = entries.filter(e => e.status === 'approved').reduce((s, e) => s + (e.adjusted_hours || e.total_hours), 0);
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
      doc.text('Approved Work Entries', 14, y + 6); y += 10;
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Hours', 'Task Description']],
        body: entries.map(e => [
          new Date(e.entry_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' }),
          (e.adjusted_hours || e.total_hours).toFixed(2),
          e.task_description || '—',
        ]),
        foot: [['', `Total: ${totalHours.toFixed(2)} hrs`, '']],
        theme: 'grid', styles: { fontSize: 8 },
        headStyles: { fillColor: [27, 168, 154] },
        footStyles: { fillColor: [230, 246, 245], textColor: [13, 148, 136], fontStyle: 'bold' },
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // Adjustments
    if (adjustments.length > 0) {
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
      doc.text('Adjustments', 14, y + 6); y += 10;
      autoTable(doc, {
        startY: y,
        head: [['Type', 'Amount', 'Reason', 'Status']],
        body: adjustments.map(a => [
          a.adj_type.charAt(0).toUpperCase() + a.adj_type.slice(1),
          ((['deduction','advance'].includes(a.adj_type) ? '−' : '+') + formatCurrency(a.amount)),
          a.reason || '—',
          a.applied ? 'Applied' : 'Pending',
        ]),
        theme: 'grid', styles: { fontSize: 8 },
        headStyles: { fillColor: [27, 168, 154] },
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // Net Pay
    doc.setFillColor(230, 246, 245);
    doc.rect(14, y, 182, 18, 'F');
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(27, 168, 154);
    doc.text('Net Pay (Take Home)', 18, y + 12);
    doc.text(formatCurrency(payroll.net_pay), 196, y + 12, { align: 'right' });

    if (payroll.status === 'paid') {
      const payDate = payroll.payment_date ? new Date(payroll.payment_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      const payRows: string[][] = [
        ['Payment Date', payDate],
        ['Method', payroll.payment_method || '—'],
        ...(payroll.transaction_ref ? [['Reference No.', payroll.transaction_ref]] : []),
        ...(payroll.bank_last4      ? [['Account',       `••••${payroll.bank_last4}`]] : []),
        ...(payroll.payment_notes   ? [['Remarks',       payroll.payment_notes]] : []),
      ];
      autoTable(doc, {
        startY: y + 24,
        head: [['Payment Details', '']],
        body: payRows,
        theme: 'striped', styles: { fontSize: 9 },
        headStyles: { fillColor: [22, 163, 74] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
      });
    }

    // Footer
    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text('This is a computer-generated payslip. For queries, contact HR.', 105, 285, { align: 'center' });

    doc.save(`payslip-${month}-${emp?.full_name || user.username}.pdf`);
    toast.success('Payslip downloaded!');
  }

  if (!user) return null;
  const emp = user.employee;
  const totalHours = entries.filter(e => e.status === 'approved').reduce((s, e) => s + (e.adjusted_hours || e.total_hours), 0);
  // Entries included in payroll (generated_at time) vs new entries after payroll
  const payrollGeneratedAt = payroll?.updated_at || payroll?.created_at;
  const includedEntries = payrollGeneratedAt
    ? entries.filter(e => new Date(e.entry_date + 'T23:59:59') <= new Date(payrollGeneratedAt))
    : entries;
  const newEntries = payrollGeneratedAt
    ? entries.filter(e => new Date(e.entry_date + 'T23:59:59') > new Date(payrollGeneratedAt))
    : [];

  return (
    <>
      <EmployeeTopbar title="Payslips" user={user}
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <select className="form-select" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)}>
              {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <Button variant="outline" icon="⬇" onClick={downloadPDF} disabled={!payroll}>Download PDF</Button>
          </div>
        }
      />
      <div className="page-content">
        {/* Tabs — always visible */}
        <div className="card" style={{ padding: 0, marginBottom: 20 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {([
              { key: 'payslip' as const, label: loading ? 'Payslip' : payroll ? (payroll.status === 'paid' ? '✓ Salary Paid' : '⏳ Salary Generated') : '📋 Not Generated' },
              { key: 'entries' as const, label: loading ? 'Work Entries' : `Work Entries${newEntries.length > 0 ? ` (+${newEntries.length} new)` : entries.length > 0 ? ` (${entries.length})` : ''}` },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                style={{ padding: '14px 24px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                  color: activeTab === t.key ? 'var(--primary)' : 'var(--text-2)',
                  borderBottom: activeTab === t.key ? '3px solid var(--primary)' : '3px solid transparent',
                  marginBottom: -1 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
        ) : activeTab === 'entries' ? (
          /* ── Work Entries Tab ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {entries.length === 0 ? (
              <div className="empty-state card" style={{ padding: 60 }}>
                <div className="empty-icon">📋</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>No work entries for {getPayrollMonthLabel(month)}</div>
              </div>
            ) : (
              <>
                {newEntries.length > 0 && (
                  <div className="alert alert-info" style={{ margin: 0 }}>
                    ⚠️ <strong>{newEntries.length} new entr{newEntries.length > 1 ? 'ies' : 'y'}</strong> submitted after payroll was generated — will be included in next payroll cycle.
                  </div>
                )}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Work Entries — {getPayrollMonthLabel(month)}</span>
                    <span style={{ color: 'var(--primary)', fontSize: 13 }}>{totalHours.toFixed(2)} approved hrs</span>
                  </div>
                  <table className="data-table" style={{ fontSize: 13 }}>
                    <thead><tr><th>Date</th><th>Hours</th><th>Task Description</th><th>Entry Status</th><th>Salary</th></tr></thead>
                    <tbody>
                      {entries.map(e => {
                        const isNew = payrollGeneratedAt && new Date(e.entry_date + 'T23:59:59') > new Date(payrollGeneratedAt);
                        return (
                          <tr key={e.id} style={{ background: isNew ? 'rgba(245,158,11,0.05)' : '' }}>
                            <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                              {new Date(e.entry_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {isNew && <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--warning, #f59e0b)', color: '#fff', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>NEW</span>}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {(e.adjusted_hours || e.total_hours).toFixed(2)}
                              {e.adjusted_hours && e.adjusted_hours !== e.total_hours && (
                                <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>(orig: {e.total_hours.toFixed(2)})</span>
                              )}
                            </td>
                            <td className="muted">{e.task_description || '—'}</td>
                            <td><Badge status={e.status === 'approved' ? 'active' : e.status === 'rejected' ? 'inactive' : 'pending'}>{e.status === 'approved' ? '✓ Approved' : e.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}</Badge></td>
                            <td>
                              {isNew
                                ? <span style={{ fontSize: 12, color: 'var(--warning, #b45309)', fontWeight: 600 }}>Next Cycle</span>
                                : !payroll
                                ? <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Not Generated</span>
                                : payroll.status === 'paid'
                                ? <Badge status="active">✓ Paid</Badge>
                                : <Badge status="pending">⏳ Unpaid</Badge>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--primary-light)' }}>
                        <td style={{ padding: '8px 16px', fontWeight: 700, color: 'var(--primary)' }}></td>
                        <td style={{ padding: '8px 16px', fontWeight: 700, color: 'var(--primary)' }}>Total: {totalHours.toFixed(2)} hrs</td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        ) : !payroll ? (
          <div className="empty-state card" style={{ padding: 60 }}>
            <div className="empty-icon">💰</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>No payslip for {getPayrollMonthLabel(month)}</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Payroll has not been generated for this month yet.</div>
            {entries.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-2)' }}>
                You have <strong>{entries.filter(e => e.status === 'approved').length} approved</strong> work entries — switch to the Work Entries tab to view them.
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Payslip Header ── */}
            <div className="payslip-paper" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="payslip-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff', fontWeight: 800, flexShrink: 0 }}>﷼</div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 2 }}>NSC Employee — Payslip</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{getPayrollMonthLabel(month)}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{emp?.full_name || user.username}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{emp?.employee_code} · {emp?.department}</div>
                  <div style={{ marginTop: 6 }}>
                    <Badge status={payroll.status}>
                      {payroll.status === 'paid' ? '✓ Salary Paid' : payroll.status === 'generated' ? '⏳ Pending Payment' : '📋 Draft'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* ── Employee Details Table ── */}
              <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee Details</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--primary)', color: '#fff' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Field</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { f: 'Name',          v: emp?.full_name || user.username },
                      { f: 'Employee Code', v: emp?.employee_code || '—' },
                      { f: 'Department',    v: emp?.department || '—' },
                      { f: 'Designation',   v: emp?.designation || '—' },
                      { f: 'Employee Type', v: emp?.emp_type === 'part-time' ? 'Part-Time' : emp?.emp_type === 'permanent' ? 'Permanent' : emp?.emp_type || '—' },
                    ].map((row, i) => (
                      <tr key={row.f} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--primary)', fontWeight: 500 }}>{row.f}</td>
                        <td style={{ padding: '8px 12px' }}>{row.v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Earnings & Deductions ── */}
              {(() => {
                const earningsRows = [
                  { label: 'Basic Salary', value: payroll.basic_salary },
                  ...(payroll.hra         > 0 ? [{ label: 'HRA',         value: payroll.hra }]         : []),
                  ...(payroll.conveyance  > 0 ? [{ label: 'Conveyance',  value: payroll.conveyance }]  : []),
                  ...(payroll.overtime_pay > 0 ? [{ label: 'Overtime Pay', value: payroll.overtime_pay }] : []),
                  ...(payroll.bonus        > 0 ? [{ label: 'Bonus',        value: payroll.bonus }]        : []),
                ];
                const deductionRows = [
                  ...(payroll.advance_deduction > 0 ? [{ label: 'Advance Deduction', value: payroll.advance_deduction }] : []),
                  ...(payroll.leave_deductions  > 0 ? [{ label: 'Leave Deductions',  value: payroll.leave_deductions }]  : []),
                ];
                const hasDeductions = deductionRows.length > 0;
                const maxRows = Math.max(earningsRows.length, deductionRows.length);
                return (
                  <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--primary)', color: '#fff' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, width: hasDeductions ? '30%' : '60%' }}>Earnings</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, width: hasDeductions ? '20%' : '40%' }}>Amount</th>
                          {hasDeductions && <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, width: '30%' }}>Deductions</th>}
                          {hasDeductions && <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, width: '20%' }}>Amount</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: maxRows }, (_, i) => {
                          const e = earningsRows[i];
                          const d = deductionRows[i];
                          return (
                            <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--primary)', fontWeight: 500 }}>{e?.label ?? ''}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{e ? formatCurrency(e.value) : ''}</td>
                              {hasDeductions && <td style={{ padding: '8px 12px', color: 'var(--primary)', fontWeight: 500 }}>{d?.label ?? ''}</td>}
                              {hasDeductions && <td style={{ padding: '8px 12px', textAlign: 'right' }}>{d ? formatCurrency(d.value) : ''}</td>}
                            </tr>
                          );
                        })}
                        <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--success)' }}>GROSS EARNINGS</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(payroll.gross_earnings)}</td>
                          {hasDeductions && <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--danger)' }}>TOTAL DEDUCTIONS</td>}
                          {hasDeductions && <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(payroll.total_deductions)}</td>}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* ── Net Pay ── */}
              <div style={{ background: 'var(--primary-light)', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>Net Pay (Take Home)</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(payroll.net_pay)}</div>
              </div>

              {/* ── Payment details ── */}
              {payroll.status === 'paid' && (
                <div className="payslip-payment-grid">
                  {[
                    { l: 'Payment Date', v: payroll.payment_date ? new Date(payroll.payment_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'long', year: 'numeric' }) : '—' },
                    { l: 'Method',       v: payroll.payment_method || '—' },
                    ...(payroll.transaction_ref ? [{ l: 'Reference No.', v: payroll.transaction_ref }] : []),
                    ...(payroll.bank_last4      ? [{ l: 'Account',       v: `••••${payroll.bank_last4}` }] : []),
                    ...(payroll.payment_notes   ? [{ l: 'Remarks',       v: payroll.payment_notes }] : []),
                  ].map(s => (
                    <div key={s.l}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{s.l}</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* ── Work Entries ── */}
            {entries.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Work Entries</span>
                  <span style={{ color: 'var(--primary)', fontSize: 13 }}>{totalHours.toFixed(2)} approved hrs</span>
                </div>
                <table className="data-table" style={{ fontSize: 13 }}>
                  <thead><tr><th>Date</th><th>Hours</th><th>Task Description</th><th>Status</th></tr></thead>
                  <tbody>
                    {entries.map(e => (
                      <tr key={e.id}>
                        <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(e.entry_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td style={{ fontWeight: 600 }}>
                          {(e.adjusted_hours || e.total_hours).toFixed(2)}
                          {e.adjusted_hours && e.adjusted_hours !== e.total_hours && (
                            <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>(orig: {e.total_hours.toFixed(2)})</span>
                          )}
                        </td>
                        <td className="muted">{e.task_description || '—'}</td>
                        <td><Badge status={e.status === 'approved' ? 'active' : e.status === 'rejected' ? 'inactive' : 'pending'}>{e.status === 'approved' ? '✓ Approved' : e.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--primary-light)' }}>
                      <td style={{ padding: '8px 16px', fontWeight: 700, color: 'var(--primary)' }}></td>
                      <td style={{ padding: '8px 16px', fontWeight: 700, color: 'var(--primary)' }}>Total: {totalHours.toFixed(2)} hrs</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* ── Adjustments ── */}
            {adjustments.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>Adjustments</div>
                <table className="data-table" style={{ fontSize: 13 }}>
                  <thead><tr><th>Type</th><th>Amount</th><th>Reason</th><th>Status</th></tr></thead>
                  <tbody>
                    {adjustments.map(a => {
                      const meta = ADJ_META[a.adj_type] || { label: a.adj_type, color: 'var(--text-1)', sign: '' };
                      return (
                        <tr key={a.id}>
                          <td style={{ fontWeight: 600, color: meta.color }}>{meta.label}</td>
                          <td style={{ fontWeight: 700, color: meta.color }}>{meta.sign}{formatCurrency(a.amount)}</td>
                          <td className="muted">{a.reason || '—'}</td>
                          <td><Badge status={a.applied ? 'active' : 'pending'}>{a.applied ? 'Applied' : 'Pending'}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}
      </div>
    </>
  );
}
