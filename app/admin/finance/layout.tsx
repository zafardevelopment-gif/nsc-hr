import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const isSuperAdmin = !session.role_type || session.role_type === 'super_admin';
  if (session.role !== 'admin' || !isSuperAdmin) redirect('/admin/dashboard');
  return <>{children}</>;
}
