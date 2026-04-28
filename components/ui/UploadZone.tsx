'use client';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';

interface UploadZoneProps {
  onUpload: (url: string, filename: string) => void;
  label?: string;
}

export function UploadZone({ onUpload, label = 'Click to upload or drag a file' }: UploadZoneProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setUploaded(file.name);
      onUpload(json.url, json.filename);
      toast.success('File uploaded');
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div
      className="upload-zone"
      onClick={() => ref.current?.click()}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <input
        ref={ref}
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <span style={{ fontSize: 24 }}>📎</span>
      {uploading ? (
        <div style={{ fontWeight: 600, fontSize: 14 }}>Uploading...</div>
      ) : uploaded ? (
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--success)' }}>✓ {uploaded}</div>
      ) : (
        <>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>PDF, Image, Word — max 5MB</div>
        </>
      )}
    </div>
  );
}
