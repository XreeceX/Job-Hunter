'use client';

import { useEffect, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Button } from '@/components/ui/button';
import { THEME_STORAGE_KEY, type ThemePreference } from '@/lib/theme';
import { Check, Monitor, Moon, Sun } from 'lucide-react';

function applyTheme(pref: ThemePreference) {
  let dark = false;
  if (pref === 'dark') dark = true;
  else if (pref === 'light') dark = false;
  else dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
}

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>('light');

  useEffect(() => {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    const p: ThemePreference =
      raw === 'dark' || raw === 'light' || raw === 'system' ? raw : 'light';
    setPref(p);
    applyTheme(p);
  }, []);

  useEffect(() => {
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  const setTheme = (next: ThemePreference) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setPref(next);
    applyTheme(next);
  };

  const Icon = pref === 'dark' ? Moon : pref === 'system' ? Monitor : Sun;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 border-[var(--border)] bg-[var(--card)]/80 text-[var(--foreground)] hover:border-[var(--border-hover)]"
          aria-label="Theme"
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Theme</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[100] min-w-[10rem] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-glow backdrop-blur-md"
        >
          {(
            [
              { value: 'light' as const, label: 'Light', icon: Sun },
              { value: 'dark' as const, label: 'Dark', icon: Moon },
              { value: 'system' as const, label: 'System', icon: Monitor },
            ] as const
          ).map(({ value, label, icon: ItemIcon }) => (
            <DropdownMenu.Item
              key={value}
              className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--foreground)] outline-none transition-colors data-[highlighted]:bg-[var(--card-elevated)] data-[state=open]:bg-[var(--card-elevated)]"
              onSelect={() => setTheme(value)}
            >
              <ItemIcon className="h-4 w-4 text-[var(--muted)]" aria-hidden />
              <span className="flex-1">{label}</span>
              {pref === value && <Check className="h-4 w-4 text-[var(--accent)]" aria-hidden />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
