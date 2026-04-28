import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { EmployeeSidebar, EmployeeMobileNav } from '@/components/employee/EmployeeSidebar';

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) redirect('/login');
  if (session.role !== 'employee') redirect('/admin/dashboard');

  return (
    <div className="app-shell">
      <EmployeeSidebar user={session} />
      <div className="main-area">
        {children}
      </div>
      <EmployeeMobileNav user={session} />
    </div>
  );
}
