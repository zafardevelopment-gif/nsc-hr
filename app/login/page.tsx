'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(59,111,232,0.15)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(59,111,232,0.1)' }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          {/* NSC Logo */}
          <div style={{ margin: '0 auto 24px', background: '#fff', borderRadius: 16, padding: '10px 16px', display: 'inline-block' }}>
            <img src="/nsc-logo.png" alt="NSC Logo" style={{ height: 56, width: 'auto', display: 'block' }} />
          </div>
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>NSC Employee</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 40, maxWidth: 300 }}>Complete HR & Payroll Management System</div>

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
          {/* Logo on form side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <img src="/nsc-logo.png" alt="NSC Logo" style={{ height: 40, width: 'auto' }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>Welcome back</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Sign in to continue</div>
            </div>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
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

          <div style={{ marginTop: 24, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
            NSC Employee HR System · v1.0
          </div>
        </div>
      </div>
    </div>
  );
}
