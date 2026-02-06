'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';

interface UploadZoneProps {
  onDone: () => void;
}

export function UploadZone({ onDone }: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
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
      className="rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--background)] p-6 text-center transition-colors hover:border-[var(--muted)]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
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
        <div className="flex flex-col items-center gap-2 text-[var(--muted)]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Uploading and detecting columns…</span>
        </div>
      ) : (
        <>
          <Upload className="mx-auto h-8 w-8 text-[var(--muted)]" />
          <p className="mt-2 text-sm text-[var(--muted)]">
            Drag a file here or click to upload
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            .xlsx, .xls, .csv — columns are auto-detected
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </Button>
        </>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
