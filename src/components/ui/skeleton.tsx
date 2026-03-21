import * as React from 'react';
import { cn } from '@/lib/utils/cn';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'skeleton-shimmer relative overflow-hidden rounded-md bg-[var(--card-elevated)]/70',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
