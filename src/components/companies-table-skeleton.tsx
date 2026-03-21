import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import { interactiveCardClass } from '@/lib/ui';

export function CompaniesTableSkeleton() {
  return (
    <Card className={cn('overflow-hidden', interactiveCardClass)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)]">
          <div className="space-y-0 p-3">
            <div className="mb-3 flex gap-3 border-b border-[var(--border-subtle)] pb-3">
              <Skeleton className="h-4 w-8 shrink-0" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-3 border-b border-[var(--border-subtle)]/60 py-2.5 last:border-0">
                <Skeleton className="h-4 w-8 shrink-0 rounded" />
                <Skeleton className="h-4 w-28 shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 flex-1 max-w-md" />
        </div>
      </CardContent>
    </Card>
  );
}
