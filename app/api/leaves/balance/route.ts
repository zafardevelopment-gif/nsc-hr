import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const empId = searchParams.get('empId') || session.employee_id;
  const year = searchParams.get('year') || new Date().getFullYear().toString();

  if (!empId) return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });

  const db = createServerSupabase();
  const { data, error } = await db.from('NSC_HR_leave_balances')
    .select('*')
    .eq('employee_id', empId)
    .eq('year', parseInt(year));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
