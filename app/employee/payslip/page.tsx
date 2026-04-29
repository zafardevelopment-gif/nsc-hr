'use client';
import { useState, useEffect, useRef } from 'react';
import { EmployeeTopbar } from '@/components/employee/EmployeeTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useUser } from '@/lib/hooks';
import { formatCurrency, getMonthOptions, getPayrollMonthLabel } from '@/lib/utils';
import { Payroll } from '@/types';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function PayslipPage() {
  const { user } = useUser();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [loading, setLoading] = useState(true);
  const monthOptions = getMonthOptions();
  const payslipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/payroll?month=${month}`);
        const json = await res.json();
        setPayroll(json.data?.[0] || null);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, [month]);

  function downloadPDF() {
    if (!payroll || !user) return;
    const emp = user.employee;
    const doc = new jsPDF();

    // Header — white background with teal accent bar
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

    // Employee info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text('Employee Details', 14, 56);
    autoTable(doc, {
      startY: 60,
      head: [['Field', 'Value']],
      body: [
        ['Name', emp?.full_name || user.username],
        ['Employee Code', emp?.employee_code || '—'],
        ['Department', emp?.department || '—'],
        ['Designation', emp?.designation || '—'],
        ['Employee Type', emp?.emp_type || '—'],
      ],
      theme: 'striped', styles: { fontSize: 9 },
      headStyles: { fillColor: [27, 168, 154] },
    });

    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Earnings & Deductions
    autoTable(doc, {
      startY: finalY,
      head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
      body: [
        ['Basic Salary', formatCurrency(payroll.basic_salary), 'PF (Employee)', formatCurrency(payroll.pf_employee)],
        ['HRA', formatCurrency(payroll.hra), 'Professional Tax', formatCurrency(payroll.professional_tax)],
        ['Conveyance', formatCurrency(payroll.conveyance), 'Advance Deduction', formatCurrency(payroll.advance_deduction)],
        ...(payroll.overtime_pay ? [['Overtime', formatCurrency(payroll.overtime_pay), '', '']] : []),
        ...(payroll.bonus ? [['Bonus', formatCurrency(payroll.bonus), '', '']] : []),
        ['', '', '', ''],
        ['GROSS EARNINGS', formatCurrency(payroll.gross_earnings), 'TOTAL DEDUCTIONS', formatCurrency(payroll.total_deductions)],
      ],
      theme: 'grid', styles: { fontSize: 9 },
      headStyles: { fillColor: [27, 168, 154] },
    });

    const finalY2 = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Net Pay
    doc.setFillColor(230, 246, 245);
    doc.rect(14, finalY2, 182, 18, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(27, 168, 154);
    doc.text('Net Pay (Take Home)', 18, finalY2 + 12);
    doc.text(formatCurrency(payroll.net_pay), 196, finalY2 + 12, { align: 'right' });

    if (payroll.status === 'paid') {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Payment Date: ${payroll.payment_date || '—'}`, 14, finalY2 + 28);
      doc.text(`Method: ${payroll.payment_method || '—'}`, 80, finalY2 + 28);
      doc.text(`Ref: ${payroll.transaction_ref || '—'}`, 140, finalY2 + 28);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('This is a computer-generated payslip. For queries, contact HR.', 105, 285, { align: 'center' });

    doc.save(`payslip-${month}-${emp?.full_name || user.username}.pdf`);
    toast.success('Payslip downloaded!');
  }

  if (!user) return null;
  const emp = user.employee;

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
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-2)' }}>Loading payslip...</div>
        ) : !payroll ? (
          <div className="empty-state card" style={{ padding: 60 }}>
            <div className="empty-icon">💰</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>No payslip for {getPayrollMonthLabel(month)}</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Payroll has not been generated for this month yet.</div>
          </div>
        ) : (
          <div className="payslip-paper" ref={payslipRef}>
            {/* Header */}
            <div className="payslip-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff', fontWeight: 800, flexShrink: 0 }}>﷼</div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 2 }}>NSC Employee</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Payslip · {getPayrollMonthLabel(month)}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{emp?.full_name || user.username}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{emp?.employee_code} · {emp?.department}</div>
                <div style={{ marginTop: 6 }}>
                  <Badge status={emp?.emp_type || ''}>{emp?.emp_type === 'permanent' ? 'Permanent' : 'Part-Time'}</Badge>
                </div>
              </div>
            </div>

            {/* Earnings + Deductions */}
            <div className="payslip-breakdown">
              <div className="payslip-section">
                <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 12 }}>Earnings</div>
                {[
                  { label: 'Basic Salary',       value: payroll.basic_salary },
                  { label: 'HRA',                value: payroll.hra },
                  { label: 'Conveyance',         value: payroll.conveyance },
                  ...(payroll.overtime_pay ? [{ label: 'Overtime Pay', value: payroll.overtime_pay }] : []),
                  ...(payroll.bonus ? [{ label: 'Performance Bonus', value: payroll.bonus }] : []),
                  ...(payroll.other_allowance ? [{ label: 'Other Allowance', value: payroll.other_allowance }] : []),
                ].map(e => (
                  <div key={e.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ color: 'var(--text-2)', fontSize: 14 }}>{e.label}</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(e.value)}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 10, marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>Gross Earnings</span>
                  <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: 16 }}>{formatCurrency(payroll.gross_earnings)}</span>
                </div>
              </div>

              <div className="payslip-section payslip-section-right">
                <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 12 }}>Deductions</div>
                {[
                  { label: 'PF (Employee)',    value: payroll.pf_employee },
                  { label: 'Professional Tax', value: payroll.professional_tax },
                  ...(payroll.advance_deduction ? [{ label: 'Advance Deduction', value: payroll.advance_deduction }] : []),
                  ...(payroll.leave_deductions  ? [{ label: 'Leave Deductions',  value: payroll.leave_deductions  }] : []),
                  ...(payroll.other_deductions  ? [{ label: 'Other Deductions',  value: payroll.other_deductions  }] : []),
                ].map(d => (
                  <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ color: 'var(--text-2)', fontSize: 14 }}>{d.label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--danger)' }}>-{formatCurrency(d.value)}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 10, marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, color: 'var(--danger)' }}>Total Deductions</span>
                  <span style={{ fontWeight: 800, color: 'var(--danger)', fontSize: 16 }}>{formatCurrency(payroll.total_deductions)}</span>
                </div>
              </div>
            </div>

            {/* Net Pay */}
            <div style={{ background: 'var(--primary-light)', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, marginBottom: 2 }}>Net Pay (Take Home)</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(payroll.net_pay)}</div>
              </div>
              <Badge status={payroll.status}>
                {payroll.status === 'paid' ? '✓ Salary Paid' : payroll.status === 'generated' ? '⏳ Pending Payment' : '📋 Draft'}
              </Badge>
            </div>

            {/* Payment details */}
            {payroll.status === 'paid' && (
              <div className="payslip-payment-grid">
                {[
                  { l: 'Payment Date', v: payroll.payment_date ? new Date(payroll.payment_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'long', year: 'numeric' }) : '—' },
                  { l: 'Method',       v: payroll.payment_method || '—' },
                  { l: 'Reference No', v: payroll.transaction_ref || '—' },
                  { l: 'Account',      v: payroll.bank_last4 ? `••••${payroll.bank_last4}` : '—' },
                ].map(s => (
                  <div key={s.l}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{s.l}</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.v}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer note */}
            <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center' }}>
              This is a computer-generated payslip. For queries, contact HR at hr@nsc.com
            </div>
          </div>
        )}
      </div>
    </>
  );
}
