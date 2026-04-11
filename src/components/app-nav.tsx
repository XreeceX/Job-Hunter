'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { ThemeToggle } from '@/components/theme-toggle';
import { LayoutList, Home, Settings } from 'lucide-react';

const links = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/applications', label: 'Applications', icon: LayoutList },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--card)]/40 px-4 py-3 backdrop-blur-sm md:px-8">
      <div className="flex flex-wrap items-center gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                  : 'text-[var(--foreground-muted)] hover:bg-[var(--card-elevated)] hover:text-[var(--foreground)]'
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
      <ThemeToggle />
    </nav>
  );
}
