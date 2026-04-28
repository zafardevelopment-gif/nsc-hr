import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerSupabase();
  let query = db.from('NSC_HR_notifications')
    .update({ read_status: true, read_at: new Date().toISOString() })
    .eq('read_status', false);

  if (session.role === 'employee') {
    query = query.or(`target_role.eq.all,target_role.eq.employee,employee_id.eq.${session.employee_id}`);
  } else {
    query = query.or(`target_role.eq.all,target_role.eq.admin`);
  }

  await query;
  return NextResponse.json({ message: 'All marked as read' });
}
