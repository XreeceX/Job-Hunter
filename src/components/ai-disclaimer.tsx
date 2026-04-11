'use client';

import { cn } from '@/lib/utils/cn';

export function AiDisclaimer({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        'rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-[var(--foreground-muted)]',
        className
      )}
      role="note"
    >
      <strong className="font-medium text-amber-200/90">Accuracy:</strong> You are responsible for everything you
      submit. AI can hallucinate or misread details—review all facts (employers, dates, skills) before applying. This
      app does not log in to employer sites or submit forms for you.
    </aside>
  );
}
