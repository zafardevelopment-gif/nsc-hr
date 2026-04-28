import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/employee/dashboard');

  return (
    <div className="app-shell">
      <AdminSidebar user={session} />
      <div className="main-area">{children}</div>
    </div>
  );
}
