'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { useUser } from '@/lib/hooks';
import { Payroll } from '@/types';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency, getMonthOptions, getPayrollMonthLabel } from '@/lib/utils';
import { buildPayrollSummary, EntryRecord } from '@/lib/payrollStatus';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Employee { id: string; employee_code: string; full_name: string; department: string; emp_type: string; salary_type?: string; monthly_salary?: number; hourly_rate?: number; }

export default function PayrollPage() {
  const { user } = useUser();
  const [tab, setTab] = useState<'generated' | 'not-generated'>('generated');
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPay, setSelectedPay] = useState<Payroll | null>(null);
  const [detailEntries, setDetailEntries] = useState<{id:string;entry_date:string;total_hours:number;adjusted_hours?:number|null;task_description?:string;status:string;created_at?:string;project_id?:string|null;project?:{project_name:string}|null}[]>([]);
  const [detailAdjs, setDetailAdjs] = useState<{id:string;adj_type:string;amount:number;reason?:string;applied:boolean}[]>([]);
  const [payForm, setPayForm] = useState({ method: 'Bank Transfer', ref: '', date: new Date().toISOString().split('T')[0], notes: '', bank_last4: '' });
  const [adjForm, setAdjForm] = useState({ overtime_pay: '', bonus: '', advance_deduction: '', payment_notes: '' });
  const [pendingAdjs, setPendingAdjs] = useState<{ id: string; adj_type: string; amount: number; reason?: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // Maps employeeId → { payrollId, payrollCreatedAt } for supplement generation
  const [newEntryMap, setNewEntryMap] = useState<Map<string, { payrollId: string; payrollCreatedAt: string }>>(new Map());
  // Entry-level status counts per employee: used for accurate summary banner
  const [entryStatusByEmp, setEntryStatusByEmp] = useState<Map<string, { paid: number; unpaid: number; notGenerated: number; nextCycle: number }>>(new Map());
  const PAGE_SIZE = 10;

  const monthOptions = getMonthOptions();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [payRes, empRes, workRes] = await Promise.all([
        fetch(`/api/payroll?month=${month}`).then(r => r.json()),
        fetch('/api/employees?active=true&limit=200').then(r => r.json()),
        fetch(`/api/work-entries?month=${month}&status=approved&limit=500`).then(r => r.json()),
      ]);
      const payrollData: Payroll[] = payRes.data || [];
      // work entries already include payroll_id from the API join
      const workEntries: EntryRecord[] = (workRes.data || []).map((e: EntryRecord) => ({ ...e, status: 'approved' }));
      setPayroll(payrollData);
      setAllEmployees(empRes.data || []);

      // Entry-level status per employee — using explicit payroll_id linkage
      const empIds = new Set<string>([
        ...payrollData.map(p => p.employee_id),
        ...workEntries.map(e => e.employee_id).filter((id): id is string => !!id),
      ]);

      const empStatusMap = new Map<string, { paid: number; unpaid: number; notGenerated: number; nextCycle: number }>();
      const newMap = new Map<string, { payrollId: string; payrollCreatedAt: string }>();

      for (const empId of empIds) {
        const empPayrolls = payrollData.filter(p => p.employee_id === empId);
        const empEntries  = workEntries.filter(e => e.employee_id === empId);
        const summary = buildPayrollSummary(empPayrolls, empEntries);

        const counts = { paid: 0, unpaid: 0, notGenerated: 0, nextCycle: 0 };
        for (const e of summary.entriesWithStatus) {
          if (e.salaryStatus === 'paid')        counts.paid++;
          else if (e.salaryStatus === 'unpaid')  counts.unpaid++;
          else if (e.salaryStatus === 'next_cycle' || e.salaryStatus === 'no_payroll') {
            counts.notGenerated++;
            if (e.salaryStatus === 'next_cycle') counts.nextCycle++;
          }
        }
        empStatusMap.set(empId, counts);

        // For the "Generate Supplement" button: employee has unlinked approved entries
        // and a regular payroll exists.
        const hasUnlinked = summary.nextCycleHours > 0;
        if (hasUnlinked) {
          const regularPay = empPayrolls.find(p => (p.payroll_type ?? 'regular') === 'regular');
          if (regularPay) {
            newMap.set(empId, { payrollId: regularPay.id, payrollCreatedAt: regularPay.created_at ?? '' });
          }
        }
      }
      setEntryStatusByEmp(empStatusMap);
      setNewEntryMap(newMap);
    } catch { toast.error('Failed to load payroll'); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); setSearch(''); }, [tab, month]);

  async function generateAll() {
    setGenerating(true);
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success(json.message);
      setTab('generated');
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function generateForEmployee(empId: string, isSupplement = false) {
    setGeneratingId(empId);
    try {
      const body = isSupplement
        ? { month, empId, supplement: true }
        : { month, empId };
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success(json.message || 'Payroll generated');
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setGeneratingId(null);
    }
  }

  async function markPaid() {
    if (!selectedPay) return;
    setSubmitting(true);
    try {
      // Fetch any pending adjustments not yet applied
      const adjRes = await fetch(`/api/adjustments?empId=${selectedPay.employee_id}&month=${selectedPay.payroll_month}&applied=false`);
      const adjJson = await adjRes.json();
      const pendingForPay: { id: string; adj_type: string; amount: number }[] = adjJson.data || [];

      // If there are pending adjustments, apply them first
      if (pendingForPay.length > 0) {
        const sum = (type: string) => pendingForPay.filter(a => a.adj_type === type).reduce((s, a) => s + a.amount, 0);
        // Fetch already-applied to get true base values
        const appliedRes = await fetch(`/api/adjustments?empId=${selectedPay.employee_id}&month=${selectedPay.payroll_month}&applied=true`).then(r => r.json());
        const alreadyApplied: { adj_type: string; amount: number }[] = appliedRes.data || [];
        const appliedSum = (type: string) => alreadyApplied.filter(a => a.adj_type === type).reduce((s, a) => s + a.amount, 0);
        const adjBody: Record<string, unknown> = {
          overtime_pay:      Math.max(0, (selectedPay.overtime_pay      || 0) - appliedSum('overtime'))  + sum('overtime'),
          bonus:             Math.max(0, (selectedPay.bonus             || 0) - appliedSum('bonus'))      + sum('bonus'),
          advance_deduction: Math.max(0, (selectedPay.advance_deduction || 0) - appliedSum('advance')) + sum('advance'),
          adj_ids: pendingForPay.map(a => a.id),
        };
        const adjUpdate = await fetch(`/api/payroll/${selectedPay.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(adjBody),
        });
        const adjUpdateJson = await adjUpdate.json();
        if (adjUpdateJson.error) throw new Error(adjUpdateJson.error);
      }

      // Now mark paid
      const res = await fetch(`/api/payroll/${selectedPay.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_paid',
          payment_method: payForm.method,
          transaction_ref: payForm.ref,
          payment_date: payForm.date,
          payment_notes: payForm.notes,
          bank_last4: payForm.bank_last4,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success('Payment marked');
      setShowPayModal(false);
      setSelectedPay(json.data || null);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAdjustment() {
    if (!selectedPay) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        overtime_pay:      parseFloat(adjForm.overtime_pay)      || 0,
        bonus:             parseFloat(adjForm.bonus)             || 0,
        advance_deduction: parseFloat(adjForm.advance_deduction) || 0,
        payment_notes:     adjForm.payment_notes,
      };
      if (pendingAdjs.length > 0) body.adj_ids = pendingAdjs.map(a => a.id);

      const res = await fetch(`/api/payroll/${selectedPay.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success('Payroll adjusted & deduction applied');
      setShowAdjModal(false);
      setPendingAdjs([]);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally { setSubmitting(false); }
  }

  function downloadDetailPDF() {
    if (!selectedPay) return;
    const emp = selectedPay.employee as { full_name: string; employee_code: string; department: string; emp_type: string; salary_type?: string; hourly_rate?: number } | undefined;
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
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('NSC Employee — Payroll Details', 46, 18);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`${getPayrollMonthLabel(selectedPay.payroll_month)}  ·  Status: ${selectedPay.status.toUpperCase()}`, 46, 30);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-SA')}`, 204, 30, { align: 'right' });

    // Employee info
    doc.setTextColor(0, 0, 0);
    autoTable(doc, {
      startY: 52,
      head: [['Employee', 'Code', 'Department', 'Type']],
      body: [[emp?.full_name || '—', emp?.employee_code || '—', emp?.department || '—', emp?.emp_type === 'part-time' ? 'Part-Time' : emp?.emp_type === 'permanent' ? 'Permanent' : emp?.emp_type || '—']],
      theme: 'striped', styles: { fontSize: 9 },
      headStyles: { fillColor: [27, 168, 154] },
    });

    let y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    // Work entries
    if (detailEntries.length > 0) {
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Approved Work Entries', 14, y + 6); y += 10;
      const approvedEntries = detailEntries.filter(e => e.status === 'approved');
      const totalHours = approvedEntries.reduce((s, e) => s + (e.adjusted_hours || e.total_hours), 0);
      const isPartTime = emp?.emp_type === 'part-time';
      autoTable(doc, {
        startY: y,
        head: [isPartTime ? ['Date', 'Project', 'Hours', 'Task Description'] : ['Date', 'Hours', 'Task Description']],
        body: approvedEntries.map(e => {
          const hrs = (e.adjusted_hours || e.total_hours).toFixed(2);
          const hrsStr = hrs + (e.adjusted_hours && e.adjusted_hours !== e.total_hours ? ` (orig: ${e.total_hours.toFixed(2)})` : '');
          if (isPartTime) {
            return [
              new Date(e.entry_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' }),
              e.project?.project_name || '—',
              hrsStr,
              e.task_description || '—',
            ];
          }
          return [
            new Date(e.entry_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' }),
            hrsStr,
            e.task_description || '—',
          ];
        }),
        foot: [isPartTime
          ? ['', '', `Total: ${totalHours.toFixed(2)} hrs`, `Basic: ${formatCurrency(selectedPay.basic_salary)}`]
          : ['', `Total: ${totalHours.toFixed(2)} hrs`, '']
        ],
        theme: 'grid', styles: { fontSize: 8 },
        headStyles: { fillColor: [27, 168, 154] },
        footStyles: { fillColor: [230, 246, 245], textColor: [13, 148, 136], fontStyle: 'bold' },
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // Adjustments
    if (detailAdjs.length > 0) {
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Adjustments', 14, y + 6); y += 10;
      autoTable(doc, {
        startY: y,
        head: [['Type', 'Amount', 'Reason', 'Status']],
        body: detailAdjs.map(a => [
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

    // Salary breakdown — side-by-side earnings/deductions
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('Salary Breakdown', 14, y + 6); y += 10;

    const pdfEarnings: string[][] = [
      ['Basic Salary', formatCurrency(selectedPay.basic_salary)],
      ...(selectedPay.hra          > 0 ? [['HRA',          formatCurrency(selectedPay.hra)]]          : []),
      ...(selectedPay.conveyance   > 0 ? [['Conveyance',   formatCurrency(selectedPay.conveyance)]]   : []),
      ...(selectedPay.overtime_pay > 0 ? [['Overtime Pay', formatCurrency(selectedPay.overtime_pay)]] : []),
      ...(selectedPay.bonus        > 0 ? [['Bonus',        formatCurrency(selectedPay.bonus)]]        : []),
    ];
    const pdfDeductions: string[][] = [
      ...(selectedPay.advance_deduction > 0 ? [['Advance Deduction', formatCurrency(selectedPay.advance_deduction)]] : []),
      ...(selectedPay.leave_deductions  > 0 ? [['Leave Deductions',  formatCurrency(selectedPay.leave_deductions)]]  : []),
    ];
    const pdfHasD = pdfDeductions.length > 0;
    if (pdfHasD) {
      const pdfMaxRows = Math.max(pdfEarnings.length, pdfDeductions.length);
      const pdfSideRows: string[][] = Array.from({ length: pdfMaxRows }, (_, i) => [
        pdfEarnings[i]?.[0] ?? '', pdfEarnings[i]?.[1] ?? '',
        pdfDeductions[i]?.[0] ?? '', pdfDeductions[i]?.[1] ?? '',
      ]);
      pdfSideRows.push(['GROSS EARNINGS', formatCurrency(selectedPay.gross_earnings), 'TOTAL DEDUCTIONS', formatCurrency(selectedPay.total_deductions)]);
      autoTable(doc, {
        startY: y,
        head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
        body: pdfSideRows,
        foot: [['NET PAY (TAKE HOME)', formatCurrency(selectedPay.net_pay), '', '']],
        theme: 'grid', styles: { fontSize: 9 },
        headStyles: { fillColor: [27, 168, 154] },
        footStyles: { fillColor: [230, 246, 245], textColor: [27, 168, 154], fontStyle: 'bold', fontSize: 10 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.raw) {
            const row = data.row.raw as string[];
            if (row[0] === 'GROSS EARNINGS') { data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = [22, 163, 74]; }
            if (row[2] === 'TOTAL DEDUCTIONS') { data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = [220, 38, 38]; }
          }
        },
      });
    } else {
      const pdfRows = pdfEarnings.concat([['GROSS EARNINGS', formatCurrency(selectedPay.gross_earnings)]]);
      autoTable(doc, {
        startY: y,
        head: [['Earnings', 'Amount']],
        body: pdfRows,
        foot: [['NET PAY (TAKE HOME)', formatCurrency(selectedPay.net_pay)]],
        theme: 'grid', styles: { fontSize: 9 },
        headStyles: { fillColor: [27, 168, 154] },
        footStyles: { fillColor: [230, 246, 245], textColor: [27, 168, 154], fontStyle: 'bold', fontSize: 10 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.raw) {
            const row = data.row.raw as string[];
            if (row[0] === 'GROSS EARNINGS') { data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = [22, 163, 74]; }
          }
        },
      });
    }

    // Payment details if paid
    {
      let py = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      if (selectedPay.status === 'paid') {
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
        doc.text('Payment Details', 14, py + 6);
        const payDate = selectedPay.payment_date ? new Date(selectedPay.payment_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
        const payRows: string[][] = [
          ['Payment Date', payDate],
          ['Method',       selectedPay.payment_method || '—'],
          ...(selectedPay.transaction_ref ? [['Reference No.', selectedPay.transaction_ref]] : []),
          ...(selectedPay.bank_last4      ? [['Account',       `••••${selectedPay.bank_last4}`]] : []),
          ...(selectedPay.payment_notes   ? [['Remarks',       selectedPay.payment_notes]] : []),
        ];
        autoTable(doc, {
          startY: py + 10,
          head: [['Field', 'Details']],
          body: payRows,
          theme: 'striped', styles: { fontSize: 9 },
          headStyles: { fillColor: [22, 163, 74] },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
        });
        py = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      }

      // Supplement payroll section (if exists for this employee+month)
      const suppRecord = payroll.find(p => p.employee_id === selectedPay.employee_id && p.payroll_type === 'supplement' && p.payroll_month === selectedPay.payroll_month);
      if (suppRecord) {
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(99, 102, 241);
        doc.text('Supplemental Payroll', 14, py + 6);
        const suppRows: string[][] = [
          ['Net Pay',  formatCurrency(suppRecord.net_pay || 0)],
          ['Status',   suppRecord.status === 'paid' ? 'Paid' : 'Pending Payment'],
          ...(suppRecord.status === 'paid' && suppRecord.payment_date
            ? [['Payment Date', new Date(suppRecord.payment_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' })]]
            : []),
          ...(suppRecord.status === 'paid' && suppRecord.payment_method
            ? [['Method', suppRecord.payment_method]]
            : []),
          ...(suppRecord.transaction_ref ? [['Reference No.', suppRecord.transaction_ref]] : []),
        ];
        autoTable(doc, {
          startY: py + 10,
          head: [['Field', 'Details']],
          body: suppRows,
          theme: 'striped', styles: { fontSize: 9 },
          headStyles: { fillColor: [99, 102, 241] },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
        });
      }
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'normal');
      doc.text('NSC HR System — Computer generated document', 105, 290, { align: 'center' });
    }

    doc.save(`payroll-detail-${selectedPay.payroll_month}-${emp?.full_name || 'employee'}.pdf`);
    toast.success('PDF downloaded');
  }

  const total = payroll.reduce((s, p) => s + (p.net_pay || 0), 0);

  // ── Entry-level summary counts ──────────────────────────────────────────
  // Count distinct employees in each bucket (an employee can be in multiple)
  let paidEmpCount = 0, unpaidEmpCount = 0, notGeneratedEmpCount = 0, newEntryCount = 0;
  for (const [, counts] of entryStatusByEmp) {
    if (counts.paid > 0)         paidEmpCount++;
    if (counts.unpaid > 0)       unpaidEmpCount++;
    if (counts.notGenerated > 0) notGeneratedEmpCount++;
    if (counts.nextCycle > 0)    newEntryCount++;
  }

  // Employees who have NO payroll record at all (not captured in entryStatusByEmp yet)
  const generatedEmpIds = new Set(payroll.map(p => p.employee_id));
  const noPayrollEmployees = allEmployees.filter(e => !generatedEmpIds.has(e.id));
  // Also count active employees with no approved entries and no payroll
  for (const emp of noPayrollEmployees) {
    if (!entryStatusByEmp.has(emp.id)) notGeneratedEmpCount++;
  }

  // "Not Generated" tab: employees with unprocessed approved entries OR no payroll at all
  type NotGenItem =
    | { kind: 'no-payroll'; emp: Employee }
    | { kind: 'new-entry';  payroll: Payroll; emp: Employee };

  // Employees with next_cycle entries (have payroll but entries added after)
  const empsWithNextCycle = [...entryStatusByEmp.entries()]
    .filter(([, c]) => c.nextCycle > 0)
    .map(([empId]) => empId);

  const notGenItems: NotGenItem[] = [
    // True no-payroll employees
    ...noPayrollEmployees.map(e => ({ kind: 'no-payroll' as const, emp: e })),
    // Employees with payroll but unprocessed next-cycle entries
    ...empsWithNextCycle.map(empId => {
      const p = payroll.find(p => p.employee_id === empId && (p.payroll_type ?? 'regular') === 'regular')!;
      const emp = (p?.employee as Employee | undefined) || allEmployees.find(e => e.id === empId)!;
      return { kind: 'new-entry' as const, payroll: p, emp };
    }).filter(item => item.emp), // guard against missing employee data
  ];

  // Generated count = number of distinct employees with any payroll record
  const generatedCount = new Set(payroll.map(p => p.employee_id)).size;

  const filtered = tab === 'generated'
    ? payroll.filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        const emp = p.employee as { full_name: string; department: string; employee_code: string } | undefined;
        return emp?.full_name?.toLowerCase().includes(q) || emp?.department?.toLowerCase().includes(q) || emp?.employee_code?.toLowerCase().includes(q);
      })
    : notGenItems.filter(item => {
        if (!search) return true;
        const q = search.toLowerCase();
        const e = item.emp;
        return e.full_name?.toLowerCase().includes(q) || e.department?.toLowerCase().includes(q) || e.employee_code?.toLowerCase().includes(q);
      });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(payroll.map(p => {
      const emp = p.employee as { full_name: string; department: string; employee_code: string; emp_type: string } | undefined;
      return { Code: emp?.employee_code, Name: emp?.full_name, Department: emp?.department, Type: emp?.emp_type, 'Basic Salary': p.basic_salary, Overtime: p.overtime_pay, Bonus: p.bonus, 'Total Deductions': p.total_deductions, 'Net Pay': p.net_pay, Status: p.status };
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
    XLSX.writeFile(wb, `payroll-${month}.xlsx`);
    toast.success('Excel exported');
  }

  if (!user) return null;

  return (
    <>
      <AdminTopbar
        title={`Payroll — ${getPayrollMonthLabel(month)}`}
        user={user}
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" icon="📊" onClick={exportExcel}>Export Excel</Button>
            <Button icon="⚡" loading={generating} onClick={generateAll}>Auto-Generate All</Button>
          </div>
        }
      />
      <div className="page-content">
        {/* Summary banner */}
        <div style={{ background: 'var(--sidebar-2)', borderRadius: 'var(--radius)', padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 16 }}>
          {[
            { l: 'Total Payroll',  v: formatCurrency(total),       warn: false },
            { l: 'Generated',      v: generatedCount,              warn: false },
            { l: 'Paid',           v: paidEmpCount,                warn: false },
            { l: 'Unpaid',         v: unpaidEmpCount,              warn: unpaidEmpCount > 0 },
            { l: 'Not Generated',  v: notGeneratedEmpCount,        warn: notGeneratedEmpCount > 0 },
            { l: 'New Entries',    v: newEntryCount,               warn: newEntryCount > 0 },
          ].map(s => (
            <div key={s.l}>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 4 }}>{s.l}</div>
              <div style={{ color: s.warn ? '#fbbf24' : '#fff', fontSize: 24, fontWeight: 800 }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Tabs + Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Tab buttons */}
          <div className="card" style={{ padding: 0, display: 'flex', overflow: 'hidden', flexShrink: 0 }}>
            <button onClick={() => setTab('generated')}
              style={{ padding: '9px 18px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                background: tab === 'generated' ? 'var(--primary)' : 'transparent',
                color: tab === 'generated' ? '#fff' : 'var(--text-2)' }}>
              ✓ Generated ({generatedCount})
            </button>
            <button onClick={() => setTab('not-generated')}
              style={{ padding: '9px 18px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                background: tab === 'not-generated' ? 'var(--danger)' : 'transparent',
                color: tab === 'not-generated' ? '#fff' : 'var(--text-2)' }}>
              ✗ Not Generated ({notGeneratedEmpCount})
            </button>
          </div>
          <select className="form-select" style={{ width: 'auto' }} value={month} onChange={e => { setMonth(e.target.value); setPage(1); }}>
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <input className="form-input" placeholder="Search employee..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 220 }} />
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            {tab === 'not-generated' ? (
              <table className="data-table">
                <thead>
                  <tr><th>Employee</th><th>Type</th><th>Department</th><th>Salary</th><th>Reason</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6}><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div></td></tr>
                  ) : (paged as NotGenItem[]).length === 0 ? (
                    <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">✅</div><div>All employees have payroll generated for this month</div></div></td></tr>
                  ) : (paged as NotGenItem[]).map(item => {
                    const e = item.emp;
                    const isNewEntry = item.kind === 'new-entry';
                    return (
                    <tr key={e.id} style={{ background: isNewEntry ? 'rgba(245,158,11,0.06)' : '' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={e.full_name} size="sm" />
                          <div>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {e.full_name}
                              {isNewEntry && <span style={{ fontSize: 10, background: '#f59e0b', color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>⚠ NEW ENTRY</span>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{e.employee_code}</div>
                          </div>
                        </div>
                      </td>
                      <td><Badge status="pending">{e.emp_type === 'part-time' ? 'Part-Time' : 'Permanent'}</Badge></td>
                      <td className="muted">{e.department}</td>
                      <td className="muted">{e.salary_type === 'hourly' ? `${formatCurrency(e.hourly_rate || 0)}/hr` : formatCurrency(e.monthly_salary || 0)}</td>
                      <td>
                        {isNewEntry
                          ? <span style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>
                              {item.payroll?.status === 'paid'
                                ? 'Unlinked entries after paid payroll — supplement needed'
                                : `Unlinked entries — payroll is ${item.payroll?.status ?? 'generated'}, recalculate to include`}
                            </span>
                          : <span style={{ fontSize: 12, color: e.emp_type === 'part-time' && !e.hourly_rate ? 'var(--danger)' : 'var(--text-2)' }}>
                              {e.emp_type === 'part-time' && !e.hourly_rate
                                ? '⚠ No rate/project assignment — payroll cannot be generated'
                                : 'No payroll generated'}
                            </span>}
                      </td>
                      <td>
                        <Button variant="success" size="xs" loading={generatingId === e.id}
                          onClick={() => {
                            if (isNewEntry) {
                              // Regular paid → supplement; regular unpaid → recalculate regular
                              const regularPaid = item.payroll?.status === 'paid';
                              generateForEmployee(e.id, regularPaid);
                            } else {
                              generateForEmployee(e.id, false);
                            }
                          }}>
                          {isNewEntry ? (item.payroll?.status === 'paid' ? '↻ Generate Supplement' : '↻ Recalculate') : '⚡ Generate'}
                        </Button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
            <table className="data-table">
              <thead>
                <tr><th>Employee</th><th>Base</th><th>OT</th><th>Bonus</th><th>Deductions</th><th>Net Pay</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8}><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div></td></tr>
                ) : (paged as Payroll[]).length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon">💰</div><div>No payroll generated for this month</div><div style={{ fontSize: 13 }}>Click "Auto-Generate All" to create payroll</div></div></td></tr>
                ) : (paged as Payroll[]).map(p => {
                  const emp = p.employee as { full_name: string; emp_type: string; department: string } | undefined;
                  const isRegular = (p.payroll_type ?? 'regular') === 'regular';
                  const isSupplement = p.payroll_type === 'supplement';
                  // Show ⚠ badge only on regular records that still have new entries (no supplement yet)
                  const hasNewEntries = isRegular && newEntryMap.has(p.employee_id);
                  return (
                    <tr key={p.id} style={{ background: isSupplement ? 'rgba(99,102,241,0.05)' : hasNewEntries ? 'rgba(245,158,11,0.06)' : '' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={emp?.full_name || ''} size="sm" />
                          <div>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {emp?.full_name}
                              {isSupplement && <span style={{ fontSize: 10, background: '#6366f1', color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>SUPPLEMENT</span>}
                              {hasNewEntries && <span title="New work entries added after payroll generation" style={{ fontSize: 10, background: '#f59e0b', color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>⚠ NEW ENTRY</span>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{emp?.emp_type === 'part-time' ? 'Part-Time' : emp?.emp_type === 'permanent' ? 'Permanent' : emp?.emp_type} · {emp?.department}</div>
                          </div>
                        </div>
                      </td>
                      <td>{p.basic_salary ? formatCurrency(p.basic_salary) : <span style={{ color: 'var(--text-3)' }}>Hourly</span>}</td>
                      <td>{p.overtime_pay ? <span style={{ color: 'var(--success)' }}>+{formatCurrency(p.overtime_pay)}</span> : '—'}</td>
                      <td>{p.bonus ? <span style={{ color: 'var(--success)' }}>+{formatCurrency(p.bonus)}</span> : '—'}</td>
                      <td>{(() => {
                        const ded = (p.total_deductions || 0) || (p.advance_deduction || 0);
                        return ded > 0
                          ? <span style={{ color: 'var(--danger)' }}>-{formatCurrency(ded)}</span>
                          : '—';
                      })()}</td>
                      <td><strong style={{ fontSize: 15 }}>{formatCurrency(p.net_pay)}</strong></td>
                      <td><Badge status={p.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button variant="ghost" size="xs" onClick={async () => {
                            setSelectedPay(p);
                            const [wRes, aRes] = await Promise.all([
                              fetch(`/api/work-entries?empId=${p.employee_id}&month=${p.payroll_month}`).then(r => r.json()),
                              fetch(`/api/adjustments?empId=${p.employee_id}&month=${p.payroll_month}`).then(r => r.json()),
                            ]);
                            setDetailEntries(wRes.data || []);
                            setDetailAdjs(aRes.data || []);
                            setShowDetailModal(true);
                          }}>Details</Button>
                          {p.status !== 'paid' && (
                            <Button variant="success" size="xs" onClick={() => { setSelectedPay(p); setShowPayModal(true); }}>Mark Paid</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>
          <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} label="records" />
        </div>

        {/* Adjust Payroll Modal */}
        <Modal open={showAdjModal} onClose={() => setShowAdjModal(false)} title="Adjust Payroll"
          maxWidth={520}
          footer={<>
            <Button variant="ghost" onClick={() => setShowAdjModal(false)}>Cancel</Button>
            <Button loading={submitting} onClick={saveAdjustment}>Save Adjustments</Button>
          </>}
        >
          {selectedPay && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="alert alert-info">
                Adjusting payroll for <strong>{(selectedPay.employee as { full_name: string })?.full_name}</strong> — {selectedPay.payroll_month}
              </div>

              {/* Pending adjustments notice */}
              {pendingAdjs.length > 0 && (
                <div style={{ background: 'var(--warning-bg, #fffbea)', border: '1.5px solid var(--warning, #f59e0b)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--warning, #b45309)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    ⚡ {pendingAdjs.length} Pending Adjustment{pendingAdjs.length > 1 ? 's' : ''} — pre-filled below
                  </div>
                  {pendingAdjs.map(a => (
                    <div key={a.id} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: 'var(--text-1)' }}>
                      <span style={{ textTransform: 'capitalize' }}>{a.adj_type}{a.reason ? ` — ${a.reason}` : ''}</span>
                      <strong style={{ color: ['deduction','advance'].includes(a.adj_type) ? 'var(--danger)' : 'var(--success)' }}>
                        {['deduction','advance'].includes(a.adj_type) ? '−' : '+'}{formatCurrency(a.amount)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}

              {/* Base info */}
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>BASIC</div><div style={{ fontWeight: 700 }}>{formatCurrency(selectedPay.basic_salary || 0)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>CURRENT NET</div><div style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(selectedPay.net_pay || 0)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>STATUS</div><div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{selectedPay.status}</div></div>
              </div>

              {/* Additions */}
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--success)', marginBottom: -6 }}>+ Additions</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Overtime Pay</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={adjForm.overtime_pay} onChange={e => setAdjForm(f => ({ ...f, overtime_pay: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Bonus / Incentive</label>
                  <input className="form-input" type="number" min="0" placeholder="0" value={adjForm.bonus} onChange={e => setAdjForm(f => ({ ...f, bonus: e.target.value }))} />
                </div>
              </div>

              {/* Deductions */}
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--danger)', marginBottom: -6 }}>− Deductions</div>
              <div className="form-group">
                <label className="form-label">Advance Deduction</label>
                <input className="form-input" type="number" min="0" placeholder="0" value={adjForm.advance_deduction} onChange={e => setAdjForm(f => ({ ...f, advance_deduction: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">Remarks <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 12 }}>(optional)</span></label>
                <textarea className="form-textarea" rows={2} placeholder="e.g. Eid bonus, advance recovery..." value={adjForm.payment_notes} onChange={e => setAdjForm(f => ({ ...f, payment_notes: e.target.value }))} />
              </div>

              {/* Live preview */}
              {(() => {
                const ot = parseFloat(adjForm.overtime_pay) || selectedPay.overtime_pay || 0;
                const bonus = parseFloat(adjForm.bonus) || selectedPay.bonus || 0;
                const adv = parseFloat(adjForm.advance_deduction) || selectedPay.advance_deduction || 0;
                const gross = (selectedPay.basic_salary || 0) + (selectedPay.hra || 0) + (selectedPay.conveyance || 0) + ot + bonus;
                const ded = adv;
                const net = gross - ded;
                return (
                  <div style={{ background: 'var(--primary-light)', border: '1.5px solid var(--primary)', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Estimated Net Pay</span>
                    <strong style={{ fontSize: 20, color: 'var(--primary)' }}>{formatCurrency(net)}</strong>
                  </div>
                );
              })()}
            </div>
          )}
        </Modal>

        {/* Payroll Details Modal */}
        <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title="Payroll Details" maxWidth={640}
          footer={<>
            <Button variant="ghost" onClick={() => setShowDetailModal(false)}>Close</Button>
            <Button variant="outline" icon="⬇" onClick={downloadDetailPDF}>Download PDF</Button>
          </>}
        >
          {selectedPay && (() => {
            const emp = selectedPay.employee as { full_name: string; employee_code: string; department: string; emp_type: string; salary_type?: string; hourly_rate?: number } | undefined;
            const totalHours = detailEntries.filter(e => e.status === 'approved').reduce((s, e) => s + (e.adjusted_hours || e.total_hours), 0);
            // Build per-entry salary status using all payrolls for this employee+month
            const empPayrollsForModal = payroll.filter(p => p.employee_id === selectedPay.employee_id && p.payroll_month === selectedPay.payroll_month);
            const { entriesWithStatus: modalAnnotated } = buildPayrollSummary(empPayrollsForModal, detailEntries as EntryRecord[]);
            const modalStatusMap = new Map(modalAnnotated.map(e => [e.id, e.salaryStatus]));
            const adjMeta: Record<string, { label: string; color: string; sign: string }> = {
              bonus:     { label: 'Bonus',            color: 'var(--success)', sign: '+' },
              overtime:  { label: 'Overtime Pay',     color: 'var(--success)', sign: '+' },
              allowance: { label: 'Allowance',        color: 'var(--success)', sign: '+' },
              deduction: { label: 'Deduction',        color: 'var(--danger)',  sign: '−' },
              advance:   { label: 'Advance Recovery', color: 'var(--danger)',  sign: '−' },
            };
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Employee header + details table */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg)', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    <Avatar name={emp?.full_name || ''} size="lg" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{emp?.full_name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{emp?.employee_code} · {emp?.department}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>{getPayrollMonthLabel(selectedPay.payroll_month)}</div>
                      <Badge status={selectedPay.status} />
                    </div>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--primary)', color: '#fff' }}>
                        <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600 }}>Field</th>
                        <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600 }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { f: 'Employee Code', v: emp?.employee_code || '—' },
                        { f: 'Department',    v: emp?.department || '—' },
                        { f: 'Employee Type', v: emp?.emp_type === 'part-time' ? 'Part-Time' : emp?.emp_type === 'permanent' ? 'Permanent' : emp?.emp_type || '—' },
                      ].map((row, i) => (
                        <tr key={row.f} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '7px 12px', color: 'var(--primary)', fontWeight: 500 }}>{row.f}</td>
                          <td style={{ padding: '7px 12px' }}>{row.v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Work entries */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span>⏱ Work Entries</span>
                    <span style={{ color: 'var(--primary)' }}>{totalHours.toFixed(2)} approved hrs</span>
                  </div>
                  {detailEntries.length === 0 ? (
                    <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: 8, fontSize: 13, color: 'var(--text-2)' }}>No work entries</div>
                  ) : (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                      <table className="data-table" style={{ fontSize: 12, margin: 0 }}>
                        <thead><tr><th>Date</th><th>Hours</th><th>Task</th><th>Status</th><th>Salary</th></tr></thead>
                        <tbody>
                          {detailEntries.map(e => {
                            const salSt = modalStatusMap.get(e.id);
                            const isNextCycle = salSt === 'next_cycle';
                            return (
                            <tr key={e.id} style={{ background: isNextCycle ? 'rgba(245,158,11,0.05)' : '' }}>
                              <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                                {new Date(e.entry_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'short' })}
                                {isNextCycle && <span style={{ marginLeft: 5, fontSize: 10, background: '#f59e0b', color: '#fff', borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>NEW</span>}
                              </td>
                              <td style={{ fontWeight: 600 }}>
                                {(e.adjusted_hours || e.total_hours).toFixed(2)}
                                {e.adjusted_hours && e.adjusted_hours !== e.total_hours && (
                                  <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 4 }}>({e.total_hours.toFixed(2)} orig)</span>
                                )}
                              </td>
                              <td className="muted" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.task_description || '—'}</td>
                              <td><Badge status={e.status === 'approved' ? 'active' : e.status === 'rejected' ? 'inactive' : 'pending'}>{e.status === 'approved' ? '✓' : e.status === 'rejected' ? '✗' : '⏳'}</Badge></td>
                              <td>
                                {salSt === 'paid'        ? <Badge status="active">✓ Paid</Badge>
                                : salSt === 'unpaid'     ? <Badge status="pending">⏳ Unpaid</Badge>
                                : salSt === 'next_cycle' ? <span style={{ fontSize: 11, color: '#b45309', fontWeight: 600 }}>Next Cycle</span>
                                : salSt === 'no_payroll' ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Not Generated</span>
                                : <span style={{ color: 'var(--text-3)' }}>—</span>}
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {emp?.salary_type === 'hourly' && totalHours > 0 && (
                    <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-2)', textAlign: 'right' }}>
                      {emp.emp_type === 'part-time'
                        ? <><strong style={{ color: 'var(--text-1)' }}>{formatCurrency(selectedPay.basic_salary)}</strong> (project-based rates)</>
                        : <>{totalHours.toFixed(2)} hrs × {formatCurrency(emp.hourly_rate || 0)}/hr = <strong style={{ color: 'var(--text-1)' }}>{formatCurrency(totalHours * (emp.hourly_rate || 0))}</strong></>
                      }
                    </div>
                  )}
                </div>

                {/* Adjustments */}
                {detailAdjs.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>🧾 Adjustments</div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      {detailAdjs.map((a, i) => {
                        const meta = adjMeta[a.adj_type] || { label: a.adj_type, color: 'var(--text-1)', sign: '' };
                        return (
                          <div key={a.id} style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < detailAdjs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <div>
                              <span style={{ fontWeight: 600, color: meta.color, fontSize: 13 }}>{meta.label}</span>
                              {a.reason && <span style={{ fontSize: 12, color: 'var(--text-2)', marginLeft: 8 }}>— {a.reason}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <strong style={{ color: meta.color }}>{meta.sign}{formatCurrency(a.amount)}</strong>
                              <Badge status={a.applied ? 'active' : 'pending'}>{a.applied ? 'Applied' : 'Pending'}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Salary breakdown — side-by-side table */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>💰 Salary Breakdown</div>
                  {(() => {
                    const eRows = [
                      { label: 'Basic Salary', value: selectedPay.basic_salary },
                      ...(selectedPay.hra          > 0 ? [{ label: 'HRA',          value: selectedPay.hra }]          : []),
                      ...(selectedPay.conveyance   > 0 ? [{ label: 'Conveyance',   value: selectedPay.conveyance }]   : []),
                      ...(selectedPay.overtime_pay > 0 ? [{ label: 'Overtime Pay', value: selectedPay.overtime_pay }] : []),
                      ...(selectedPay.bonus        > 0 ? [{ label: 'Bonus',        value: selectedPay.bonus }]        : []),
                    ];
                    const dRows = [
                      ...(selectedPay.advance_deduction > 0 ? [{ label: 'Advance Deduction', value: selectedPay.advance_deduction }] : []),
                      ...(selectedPay.leave_deductions  > 0 ? [{ label: 'Leave Deductions',  value: selectedPay.leave_deductions }]  : []),
                    ];
                    const hasD = dRows.length > 0;
                    const maxR = Math.max(eRows.length, dRows.length);
                    return (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: 'var(--primary)', color: '#fff' }}>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, width: hasD ? '30%' : '60%' }}>Earnings</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, width: hasD ? '20%' : '40%' }}>Amount</th>
                              {hasD && <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, width: '30%' }}>Deductions</th>}
                              {hasD && <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, width: '20%' }}>Amount</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: maxR }, (_, i) => {
                              const e = eRows[i]; const d = dRows[i];
                              return (
                                <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '7px 12px', color: 'var(--primary)', fontWeight: 500 }}>{e?.label ?? ''}</td>
                                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>{e ? formatCurrency(e.value) : ''}</td>
                                  {hasD && <td style={{ padding: '7px 12px', color: 'var(--primary)', fontWeight: 500 }}>{d?.label ?? ''}</td>}
                                  {hasD && <td style={{ padding: '7px 12px', textAlign: 'right' }}>{d ? formatCurrency(d.value) : ''}</td>}
                                </tr>
                              );
                            })}
                            <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--success)' }}>Gross Earnings</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(selectedPay.gross_earnings)}</td>
                              {hasD && <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--danger)' }}>Total Deductions</td>}
                              {hasD && <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(selectedPay.total_deductions)}</td>}
                            </tr>
                          </tbody>
                          <tfoot>
                            <tr style={{ background: 'var(--primary-light)', borderTop: '2px solid var(--primary)' }}>
                              <td colSpan={hasD ? 2 : 1} style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>NET PAY (TAKE HOME)</td>
                              <td colSpan={hasD ? 2 : 1} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)', fontSize: 16 }}>{formatCurrency(selectedPay.net_pay)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* Payment info if paid */}
                {selectedPay.status === 'paid' && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--success)' }}>✓ Payment Details</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                    {[
                      { l: 'Payment Date', v: selectedPay.payment_date ? new Date(selectedPay.payment_date).toLocaleDateString('en-SA', { day: '2-digit', month: 'long', year: 'numeric' }) : '—' },
                      { l: 'Method',       v: selectedPay.payment_method || '—' },
                      ...(selectedPay.transaction_ref ? [{ l: 'Reference No.', v: selectedPay.transaction_ref }] : []),
                      ...(selectedPay.bank_last4      ? [{ l: 'Account',       v: `••••${selectedPay.bank_last4}` }] : []),
                      ...(selectedPay.payment_notes   ? [{ l: 'Remarks',       v: selectedPay.payment_notes }] : []),
                    ].map(s => (
                      <div key={s.l} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{s.l}</div>
                        <div style={{ fontWeight: 600 }}>{s.v}</div>
                      </div>
                    ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>

        {/* Mark Paid Modal */}
        <Modal open={showPayModal} onClose={() => setShowPayModal(false)} title="Confirm Payment"
          footer={<>
            <Button variant="ghost" onClick={() => setShowPayModal(false)}>Cancel</Button>
            <Button variant="success" loading={submitting} onClick={markPaid}>✓ Confirm Payment</Button>
          </>}
        >
          {selectedPay && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--primary-light)', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{(selectedPay.employee as { full_name: string })?.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{getPayrollMonthLabel(selectedPay.payroll_month)}</div>
                </div>
                <strong style={{ fontSize: 20, color: 'var(--primary)' }}>{formatCurrency(selectedPay.net_pay)}</strong>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select className="form-select" value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value, ref: '', bank_last4: '' }))}>
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Date</label>
                  <input className="form-input" type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>
              {(payForm.method === 'Bank Transfer' || payForm.method === 'Cheque') && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{payForm.method === 'Cheque' ? 'Cheque No.' : 'Transaction / Reference No.'}</label>
                    <input className="form-input" placeholder={payForm.method === 'Cheque' ? 'CHQ-XXXXXX' : 'TXN-XXXXXX'} value={payForm.ref} onChange={e => setPayForm(f => ({ ...f, ref: e.target.value }))} />
                  </div>
                  {payForm.method === 'Bank Transfer' && (
                    <div className="form-group">
                      <label className="form-label">Bank Account Last 4 Digits</label>
                      <input className="form-input" placeholder="e.g. 4231" maxLength={4} value={payForm.bank_last4} onChange={e => setPayForm(f => ({ ...f, bank_last4: e.target.value }))} />
                    </div>
                  )}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Remarks <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 12 }}>(optional)</span></label>
                <textarea className="form-textarea" placeholder="Any notes..." value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} style={{ minHeight: 56 }} />
              </div>
            </div>
          )}
        </Modal>
      </div>
    </>
  );
}
