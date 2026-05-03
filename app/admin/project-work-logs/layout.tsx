import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function ProjectWorkLogsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role_type !== 'super_admin') redirect('/admin/dashboard');
  return <>{children}</>;
}
