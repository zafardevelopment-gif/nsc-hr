'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

const DEMO_CREDS = {
  admin:    { username: 'admin',  password: 'admin123' },
  employee: { username: 'rahul',  password: 'emp123'   },
};

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'admin' | 'employee'>('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  function autoFill() {
    const creds = DEMO_CREDS[role];
    setUsername(creds.username);
    setPassword(creds.password);
    toast.success(`Demo credentials filled for ${role}`);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Username and password required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      toast.success(`Welcome, ${json.user.username}!`);

      if (json.user.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/employee/dashboard');
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      {/* Left panel */}
      <div className="auth-left">
        {/* Background decoration */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(59,111,232,0.15)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(59,111,232,0.1)' }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'var(--primary)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 28, fontWeight: 800, color: '#fff' }}>N</div>
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>NSC Employee</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 40, maxWidth: 300 }}>Complete HR & Payroll Management System</div>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 280, textAlign: 'left' }}>
            {[
              ['👥', 'Employee Management', 'Manage permanent & part-time staff'],
              ['⏱️', 'Work Tracking',       'Log & approve work entries'],
              ['💰', 'Payroll Automation',  'Auto-calculate salaries'],
              ['🗓️', 'Leave Management',    'Apply & approve leaves'],
              ['📊', 'Reports & Analytics', 'Detailed HR reports'],
            ].map(([icon, title, sub]) => (
              <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(59,111,232,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="auth-right">
        <div className="auth-form-wrap">
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Welcome back</div>
            <div style={{ fontSize: 14, color: 'var(--text-2)' }}>Sign in to your account to continue</div>
          </div>

          {/* Role toggle */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Login as</div>
            <div className="toggle-group">
              <button className={`toggle-btn ${role === 'admin' ? 'active' : ''}`} type="button" onClick={() => { setRole('admin'); setUsername(''); setPassword(''); }}>
                🏢 Admin
              </button>
              <button className={`toggle-btn ${role === 'employee' ? 'active' : ''}`} type="button" onClick={() => { setRole('employee'); setUsername(''); setPassword(''); }}>
                👤 Employee
              </button>
            </div>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Username</label>
                <button type="button" onClick={autoFill} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  ✨ Auto-fill demo
                </button>
              </div>
              <input
                className="form-input"
                placeholder={role === 'admin' ? 'admin' : 'your.username'}
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingRight: 40 }}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-3)' }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <label htmlFor="remember" style={{ fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
                Remember me for 30 days
              </label>
            </div>

            <Button type="submit" loading={loading} style={{ width: '100%', justifyContent: 'center', padding: '11px 24px', fontSize: 14 }}>
              Sign In
            </Button>
          </form>

          {/* Demo info */}
          <div style={{ marginTop: 24, background: 'var(--bg)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Demo Credentials</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-2)' }}>Admin login:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>admin / admin123</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-2)' }}>Employee login:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>rahul / emp123</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
            NSC Employee HR System · v1.0 · Built with Next.js
          </div>
        </div>
      </div>
    </div>
  );
}
