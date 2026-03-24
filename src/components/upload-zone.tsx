'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, CheckCircle } from 'lucide-react';

interface UploadZoneProps {
  onDone: () => void;
}

export function UploadZone({ onDone }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragDepth, setDragDepth] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDragging = dragDepth > 0;

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 5000);
    return () => clearTimeout(t);
  }, [success]);

  const handleFile = async (file: File) => {
    setError(null);
    setSuccess(null);
    setUploading(true);
    try {
      const MAX_MB = 4;
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`File too large. Use a file under ${MAX_MB}MB.`);
        setUploading(false);
        return;
      }
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: form,
      });
      const text = await res.text();
      let data: { error?: string; fileName?: string; rowCount?: number };
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setError(
          res.status === 413
            ? 'File too large. Try a file under 4MB.'
            : 'Server returned an error. Try a smaller file or try again.'
        );
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onDone();
      setSuccess(
        `${data.fileName ?? file.name} uploaded successfully — ${data.rowCount ?? 0} rows detected.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth((d) => d + 1);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth((d) => Math.max(0, d - 1));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragDepth(0);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.csv') || file.name.endsWith('.xls'))) {
      handleFile(file);
    } else {
      setError('Use .xlsx, .xls, or .csv');
    }
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-dashed p-6 text-center transition-all duration-300 ease-out ${
        isDragging
          ? 'scale-[1.01] border-[var(--accent)]/55 bg-[var(--accent-dim)] shadow-glow motion-reduce:scale-100'
          : 'border-[var(--border)] bg-[var(--card-elevated)]/50 hover:border-[var(--accent)]/30 hover:bg-[var(--accent-dim)]/35 hover:shadow-glow-sm'
      } ${isHovered && !isDragging ? 'ring-2 ring-[var(--ring)]/40' : ''}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={onSelect}
        disabled={uploading}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-3 text-[var(--muted)]">
          <Loader2 className="h-9 w-9 animate-spin text-[var(--accent)]" />
          <span className="text-sm">Uploading and detecting columns…</span>
        </div>
      ) : (
        <>
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-dim)] text-[var(--accent)] transition-transform duration-300 ${
              isDragging ? 'scale-110 rotate-[-2deg]' : 'group-hover:scale-105'
            } motion-reduce:transform-none`}
          >
            <Upload className="h-6 w-6" aria-hidden />
          </div>
          <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
            {isDragging ? 'Release to import' : 'Drop a spreadsheet or browse'}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            .xlsx, .xls, .csv — columns are auto-detected
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>
        </>
      )}
      {success && (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-[var(--success)]/30 bg-[var(--success-dim)] px-3 py-2 text-sm text-[var(--success)]" role="status">
          <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
          {success}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-muted)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
