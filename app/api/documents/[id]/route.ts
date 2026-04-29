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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const db = createServerSupabase();
    const status = computeStatus(body.expiry_date);

    const { data, error } = await db.from('NSC_HR_employee_documents')
      .update({
        document_type: body.document_type,
        number: body.number,
        issue_date: body.issue_date || null,
        expiry_date: body.expiry_date || null,
        file_url: body.file_url || null,
        file_name: body.file_name || null,
        notes: body.notes || null,
        status,
        updated_by: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, employee:NSC_HR_employees(id,full_name,employee_code,department)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, message: 'Document updated' });
  } catch {
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = createServerSupabase();
  const { error } = await db.from('NSC_HR_employee_documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: 'Document deleted' });
}
