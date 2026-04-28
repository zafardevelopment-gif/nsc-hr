'use client';
import { useState, useEffect } from 'react';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useUser } from '@/lib/hooks';
import { Setting } from '@/types';
import toast from 'react-hot-toast';

const NAV_ITEMS = ['General', 'Payroll Config', 'Leave Policy', 'Integrations', 'Security'];

export default function SettingsPage() {
  const { user } = useUser();
  const [activeNav, setActiveNav] = useState('General');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings');
        const json = await res.json();
        const map: Record<string, string> = {};
        (json.data || []).forEach((s: Setting) => { map[s.setting_key] = s.setting_value || ''; });
        setSettings(map);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  function set(key: string, value: string) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  async function save(category: string) {
    setSaving(true);
    try {
      const categoryKeys: Record<string, string[]> = {
        General: ['company_name', 'company_address', 'company_email', 'company_phone', 'currency', 'currency_symbol', 'financial_year', 'working_hours_day', 'timezone', 'work_entry_manual_approval'],
        'Payroll Config': ['pf_rate', 'professional_tax', 'hra_rate', 'conveyance'],
        'Leave Policy': ['casual_leave_days', 'sick_leave_days', 'emergency_leave_days'],
        Integrations: ['whatsapp_api_url', 'whatsapp_api_key'],
      };
      const keys = categoryKeys[category] || [];
      const updates = keys.map(k => ({ key: k, value: settings[k] || '' }));

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success('Settings saved');
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <>
      <AdminTopbar title="Settings" user={user} />
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
          {/* Nav */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV_ITEMS.map(item => (
              <div key={item} className={`settings-nav-item ${activeNav === item ? 'active' : ''}`} onClick={() => setActiveNav(item)}>
                {item}
              </div>
            ))}
          </div>

          {/* Content */}
          {activeNav === 'General' && (
            <Card title="General Settings">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Company Name</label>
                    <input className="form-input" value={settings.company_name || ''} onChange={e => set('company_name', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">HR Email</label>
                    <input className="form-input" type="email" value={settings.company_email || ''} onChange={e => set('company_email', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Currency</label>
                    <select className="form-select" value={settings.currency || 'SAR'} onChange={e => set('currency', e.target.value)}>
                      <option value="SAR">SAR (﷼)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Working Hours / Day</label>
                    <input className="form-input" type="number" value={settings.working_hours_day || '8'} onChange={e => set('working_hours_day', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Financial Year Start</label>
                    <select className="form-select" value={settings.financial_year || 'April'} onChange={e => set('financial_year', e.target.value)}>
                      <option>April</option><option>January</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Timezone</label>
                    <select className="form-select" value={settings.timezone || 'Asia/Kolkata'} onChange={e => set('timezone', e.target.value)}>
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Company Address</label>
                  <textarea className="form-textarea" rows={2} value={settings.company_address || ''} onChange={e => set('company_address', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Company Phone</label>
                  <input className="form-input" value={settings.company_phone || ''} onChange={e => set('company_phone', e.target.value)} />
                </div>

                {/* Work Entry Approval */}
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>⏱️ Work Entry Approval</div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {settings.work_entry_manual_approval === 'true'
                        ? 'Manual — Admin must approve each work entry'
                        : 'Auto — Work entries are approved automatically on submission'}
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: settings.work_entry_manual_approval === 'true' ? 'var(--primary)' : 'var(--text-3)' }}>
                      {settings.work_entry_manual_approval === 'true' ? 'Manual' : 'Auto'}
                    </span>
                    <div
                      onClick={() => set('work_entry_manual_approval', settings.work_entry_manual_approval === 'true' ? 'false' : 'true')}
                      style={{
                        width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s',
                        background: settings.work_entry_manual_approval === 'true' ? 'var(--primary)' : 'var(--border)',
                        position: 'relative', flexShrink: 0,
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        left: settings.work_entry_manual_approval === 'true' ? 23 : 3,
                      }} />
                    </div>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Button variant="ghost">Reset</Button>
                  <Button loading={saving} onClick={() => save('General')}>Save Changes</Button>
                </div>
              </div>
            </Card>
          )}

          {activeNav === 'Payroll Config' && (
            <Card title="Payroll Configuration">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="alert alert-info">These settings affect payroll calculation for all employees.</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">PF Rate (%)</label>
                    <input className="form-input" type="number" step="0.1" value={settings.pf_rate || '12'} onChange={e => set('pf_rate', e.target.value)} />
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Applied on basic salary for permanent employees</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Professional Tax (SAR fixed)</label>
                    <input className="form-input" type="number" value={settings.professional_tax || '200'} onChange={e => set('professional_tax', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">HRA Rate (% of basic)</label>
                    <input className="form-input" type="number" step="1" value={settings.hra_rate || '25'} onChange={e => set('hra_rate', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Conveyance Allowance (SAR)</label>
                    <input className="form-input" type="number" value={settings.conveyance || '3000'} onChange={e => set('conveyance', e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Button loading={saving} onClick={() => save('Payroll Config')}>Save Payroll Config</Button>
                </div>
              </div>
            </Card>
          )}

          {activeNav === 'Leave Policy' && (
            <Card title="Leave Policy">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="alert alert-warning">Changes apply from the next allocation cycle (new year).</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Casual Leave Days / Year</label>
                    <input className="form-input" type="number" value={settings.casual_leave_days || '12'} onChange={e => set('casual_leave_days', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sick Leave Days / Year</label>
                    <input className="form-input" type="number" value={settings.sick_leave_days || '6'} onChange={e => set('sick_leave_days', e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ maxWidth: 300 }}>
                  <label className="form-label">Emergency Leave Days / Year</label>
                  <input className="form-input" type="number" value={settings.emergency_leave_days || '3'} onChange={e => set('emergency_leave_days', e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Button loading={saving} onClick={() => save('Leave Policy')}>Save Leave Policy</Button>
                </div>
              </div>
            </Card>
          )}

          {activeNav === 'Integrations' && (
            <Card title="Integrations">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>📱 WhatsApp API</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>Configure WhatsApp Business API to send notifications to employees.</div>
                  <div className="form-group">
                    <label className="form-label">API URL</label>
                    <input className="form-input" placeholder="https://api.whatsapp.com/..." value={settings.whatsapp_api_url || ''} onChange={e => set('whatsapp_api_url', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label className="form-label">API Key</label>
                    <input className="form-input" type="password" placeholder="Your API key" value={settings.whatsapp_api_key || ''} onChange={e => set('whatsapp_api_key', e.target.value)} />
                  </div>
                </div>
                <div className="alert alert-info">WhatsApp template messages will use employee data placeholders: {'{{name}}'}, {'{{salary}}'}, {'{{month}}'}</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Button loading={saving} onClick={() => save('Integrations')}>Save Integrations</Button>
                </div>
              </div>
            </Card>
          )}

          {activeNav === 'Security' && (
            <Card title="Security Settings">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="alert alert-info">Security configurations for system access.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { l: 'Max Login Attempts', v: '5 attempts before lockout' },
                    { l: 'Lockout Duration',   v: '15 minutes' },
                    { l: 'Session Duration',   v: '7 days (30 if remembered)' },
                    { l: 'Password Hashing',   v: 'bcrypt (cost 10)' },
                    { l: 'Cookie Security',    v: 'HttpOnly + SameSite=Lax' },
                    { l: 'JWT Expiry',         v: '7 days' },
                  ].map(({ l, v }) => (
                    <div key={l} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{l}</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <Button variant="outline">Change Admin Password</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
