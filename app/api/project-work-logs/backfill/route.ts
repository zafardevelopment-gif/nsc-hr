import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// POST /api/project-work-logs/backfill
// Backfills NSC_HR_project_work_logs for all approved part-time work entries
// that have a project_id but no work log yet. Safe to run multiple times.
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const db = createServerSupabase();

  // All approved part-time entries with a project, not yet in work_logs
  const { data: entries, error: entryErr } = await db
    .from('NSC_HR_work_entries')
    .select('id, employee_id, entry_date, total_hours, adjusted_hours, task_description, project_id, employee:NSC_HR_employees(id,emp_type,hourly_rate)')
    .eq('status', 'approved')
    .not('project_id', 'is', null);

  if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 500 });
  if (!entries || entries.length === 0)
    return NextResponse.json({ message: 'No approved entries with projects found', inserted: 0 });

  // Filter part-time only
  const partTimeEntries = entries.filter(e => {
    const emp = e.employee as { id: string; emp_type: string; hourly_rate?: number } | null;
    return emp?.emp_type === 'part-time';
  });

  if (partTimeEntries.length === 0)
    return NextResponse.json({ message: 'No part-time entries to backfill', inserted: 0 });

  // Find which entry IDs already have a work log (by work_entry_id)
  const entryIds = partTimeEntries.map(e => e.id);
  const { data: existing } = await db
    .from('NSC_HR_project_work_logs')
    .select('work_entry_id')
    .in('work_entry_id', entryIds);

  const existingSet = new Set((existing || []).map(r => r.work_entry_id).filter(Boolean));
  const toInsert = partTimeEntries.filter(e => !existingSet.has(e.id));

  if (toInsert.length === 0)
    return NextResponse.json({ message: 'All entries already backfilled', inserted: 0 });

  // Fetch all active assignments for involved employees
  const empIds = [...new Set(toInsert.map(e => e.employee_id))];
  const { data: assignments } = await db
    .from('NSC_HR_project_assignments')
    .select('employee_id, project_id, id, rate, rate_type')
    .in('employee_id', empIds)
    .eq('active', true);

  // Map: "empId_projectId" → assignment
  const assignMap = new Map(
    (assignments || []).map(a => [`${a.employee_id}_${a.project_id}`, a])
  );

  const rows = toInsert.map(e => {
    const emp = e.employee as { hourly_rate?: number } | null;
    const key = `${e.employee_id}_${e.project_id}`;
    const assignment = assignMap.get(key);
    const hours = e.adjusted_hours || e.total_hours;
    const rate = assignment?.rate ?? emp?.hourly_rate ?? 0;
    const rateType = assignment?.rate_type ?? 'per_hour';
    const total = (rateType === 'fixed' || rateType === 'per_day' || rateType === 'per_unit')
      ? rate
      : hours * rate;

    return {
      employee_id:   e.employee_id,
      project_id:    e.project_id,
      assignment_id: assignment?.id ?? null,
      work_entry_id: e.id,
      quantity:      hours,
      rate,
      rate_type:     rateType,
      total_amount:  Math.round(total * 100) / 100,
      date:          e.entry_date,
      notes:         e.task_description ?? null,
      created_by:    session.id,
      updated_at:    new Date().toISOString(),
    };
  });

  const { error: insertErr } = await db
    .from('NSC_HR_project_work_logs')
    .insert(rows);

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  await db.from('NSC_HR_activity_logs').insert({
    user_id: session.id,
    action: 'BACKFILL_PROJECT_WORK_LOGS',
    details: { inserted: rows.length },
  });

  return NextResponse.json({
    message: `Backfilled ${rows.length} work log${rows.length !== 1 ? 's' : ''} successfully`,
    inserted: rows.length,
  });
}
