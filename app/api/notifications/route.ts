import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get('unread') === 'true';

  const db = createServerSupabase();
  let query = db.from('NSC_HR_notifications')
    .select('*', { count: 'exact' });

  if (session.role === 'employee') {
    query = query.or(
      `target_role.eq.all,target_role.eq.employee,employee_id.eq.${session.employee_id}`
    );
  } else {
    query = query.or(`target_role.eq.all,target_role.eq.admin,employee_id.is.null`);
  }

  if (unreadOnly) query = query.eq('read_status', false);
  query = query.order('created_at', { ascending: false }).limit(50);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const body = await req.json();
    const db = createServerSupabase();

    if (body.employee_ids && body.employee_ids.length > 0) {
      // Send to specific employees
      const inserts = body.employee_ids.map((empId: string) => ({
        title: body.title,
        message: body.message,
        employee_id: empId,
        notification_type: body.notification_type || 'in-app',
        created_by: session.id,
      }));
      await db.from('NSC_HR_notifications').insert(inserts);
    } else {
      // Broadcast
      await db.from('NSC_HR_notifications').insert({
        title: body.title,
        message: body.message,
        target_role: body.target_role || 'all',
        notification_type: body.notification_type || 'in-app',
        created_by: session.id,
      });
    }

    return NextResponse.json({ message: 'Notification sent' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
