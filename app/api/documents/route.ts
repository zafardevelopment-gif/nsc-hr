import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

function computeStatus(expiryDate: string | null | undefined): 'active' | 'expiring' | 'expired' {
  if (!expiryDate) return 'active';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  const diff = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'expired';
  if (diff <= 30) return 'expiring';
  return 'active';
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const empId = searchParams.get('empId') || '';
  const status = searchParams.get('status') || '';
  const limit = parseInt(searchParams.get('limit') || '500');

  const db = createServerSupabase();
  let query = db.from('NSC_HR_employee_documents')
    .select('*, employee:NSC_HR_employees(id,full_name,employee_code,department)', { count: 'exact' });

  if (session.role === 'employee') {
    query = query.eq('employee_id', session.employee_id!);
  } else if (empId) {
    query = query.eq('employee_id', empId);
  }

  if (status) query = query.eq('status', status);
  query = query.order('expiry_date', { ascending: true }).limit(limit);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Recompute status from expiry_date dynamically
  const rows = (data || []).map((d: Record<string, unknown>) => ({
    ...d,
    status: computeStatus(d.expiry_date as string | null),
  }));

  return NextResponse.json({ data: rows, count });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const db = createServerSupabase();

    const empId = session.role === 'employee' ? session.employee_id! : body.employee_id;
    const status = computeStatus(body.expiry_date);

    const { data, error } = await db.from('NSC_HR_employee_documents').insert({
      employee_id: empId,
      document_type: body.document_type,
      number: body.number,
      issue_date: body.issue_date || null,
      expiry_date: body.expiry_date || null,
      file_url: body.file_url || null,
      file_name: body.file_name || null,
      notes: body.notes || null,
      status,
      created_by: session.id,
    }).select('*, employee:NSC_HR_employees(id,full_name,employee_code,department)').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, message: 'Document added' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to add document' }, { status: 500 });
  }
}
