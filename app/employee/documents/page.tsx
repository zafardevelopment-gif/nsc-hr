'use client';
import { useState, useEffect } from 'react';
import { EmployeeTopbar } from '@/components/employee/EmployeeTopbar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useUser } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import { EmployeeDocument } from '@/types';
import toast from 'react-hot-toast';

const DOC_TYPES: Record<string, string> = {
  iqama: 'Iqama', passport: 'Passport', national_id: 'National ID',
  driving_license: 'Driving License', work_permit: 'Work Permit', visa: 'Visa', other: 'Other',
};

function docStatusColor(status: string) {
  if (status === 'expired')  return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Expired', icon: '🚨' };
  if (status === 'expiring') return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA', label: 'Expiring Soon', icon: '⚠️' };
  return { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Active', icon: '✅' };
}

function daysUntilExpiry(expiryDate: string | undefined) {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  return Math.ceil((exp.getTime() - today.getTime()) / 86400000);
}

export default function EmployeeDocumentsPage() {
  const { user } = useUser();
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/documents');
        const json = await res.json();
        setDocs(json.data || []);
      } catch { toast.error('Failed to load documents'); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const expired  = docs.filter(d => d.status === 'expired');
  const expiring = docs.filter(d => d.status === 'expiring');
  const active   = docs.filter(d => d.status === 'active');

  if (!user) return null;

  return (
    <>
      <EmployeeTopbar title="My Documents" user={user} />
      <div className="page-content">

        {/* Alerts banner */}
        {(expired.length > 0 || expiring.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {expired.length > 0 && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🚨</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#DC2626' }}>Document(s) Expired</div>
                  <div style={{ fontSize: 13, color: '#B91C1C' }}>
                    {expired.map(d => DOC_TYPES[d.document_type] || d.document_type).join(', ')} — please renew immediately and inform HR.
                  </div>
                </div>
              </div>
            )}
            {expiring.length > 0 && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#C2410C' }}>Document(s) Expiring Soon</div>
                  <div style={{ fontSize: 13, color: '#9A3412' }}>
                    {expiring.map(d => `${DOC_TYPES[d.document_type] || d.document_type} (${daysUntilExpiry(d.expiry_date)}d)`).join(', ')} — please plan renewal.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)' }}>Loading...</div>
        ) : docs.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📄</div><div>No documents on file</div><div style={{ fontSize: 13, color: 'var(--text-3)' }}>Contact HR to add your documents</div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {docs.map(doc => {
              const sc = docStatusColor(doc.status);
              const days = daysUntilExpiry(doc.expiry_date);
              return (
                <div key={doc.id} style={{ borderRadius: 12, border: `1px solid ${sc.border}`, background: sc.bg, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 22 }}>{sc.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{DOC_TYPES[doc.document_type] || doc.document_type}</div>
                        <div style={{ fontSize: 13, color: sc.color, fontWeight: 600 }}>{sc.label}</div>
                      </div>
                    </div>
                    {days !== null && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: sc.color }}>
                          {days < 0 ? `${Math.abs(days)}` : days}
                        </div>
                        <div style={{ fontSize: 11, color: sc.color, fontWeight: 600 }}>
                          {days < 0 ? 'DAYS OVERDUE' : days === 0 ? 'EXPIRES TODAY' : 'DAYS LEFT'}
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px 20px' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Document No.</div>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{doc.number}</div>
                    </div>
                    {doc.issue_date && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Issue Date</div>
                        <div style={{ fontWeight: 600 }}>{formatDate(doc.issue_date)}</div>
                      </div>
                    )}
                    {doc.expiry_date && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Expiry Date</div>
                        <div style={{ fontWeight: 600, color: sc.color }}>{formatDate(doc.expiry_date)}</div>
                      </div>
                    )}
                  </div>
                  {doc.notes && (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(0,0,0,0.04)', borderRadius: 6, fontSize: 13, color: 'var(--text-2)' }}>
                      {doc.notes}
                    </div>
                  )}
                  {doc.file_url && (
                    <div style={{ marginTop: 10 }}>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                        📎 View Document File
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Summary row */}
        {!loading && docs.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { count: expired.length, label: 'Expired', color: '#DC2626', bg: '#FEF2F2' },
              { count: expiring.length, label: 'Expiring', color: '#C2410C', bg: '#FFF7ED' },
              { count: active.length, label: 'Active', color: '#16A34A', bg: '#F0FDF4' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, minWidth: 90, padding: '10px 14px', borderRadius: 10, background: s.bg, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
