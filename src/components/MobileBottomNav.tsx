'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AudioLines, BookOpen, House, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AUDIO_ANALYSIS_URL } from '@/constants/common';

const navItems = [
  { href: '/', label: '首页', icon: House, match: (pathname: string) => pathname === '/' },
  { href: '/training', label: '培训', icon: BookOpen, match: (pathname: string) => pathname.startsWith('/training') },
  { href: '/practice/new', label: '演练', icon: Sparkles, match: (pathname: string) => pathname.startsWith('/practice') },
  { href: AUDIO_ANALYSIS_URL, label: '录音', icon: AudioLines, match: (pathname: string) => pathname === AUDIO_ANALYSIS_URL },
] as const;

/**
 * 与首页一致的移动端底栏：首页 · 培训 · 演练 · 历史
 */
export default function MobileBottomNav() {
  const pathname = usePathname() || '';

  return (
    <div className="mobile-nav">
      <div className="mx-auto flex max-w-3xl items-center justify-around px-3 py-3">
        {navItems.map(item => {
          const active = item.match(pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-w-[64px] flex-col items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-medium transition-all',
                active ? 'text-[var(--color-brand-strong)]' : 'text-[var(--color-text-muted)]'
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-2xl transition-all',
                  active
                    ? 'bg-[linear-gradient(135deg,var(--color-brand-from),var(--color-brand-to))] text-white shadow-[var(--shadow-button)]'
                    : 'bg-[var(--color-fill-soft)] text-[var(--color-text-secondary)]'
                )}
              >
                <Icon className="h-4.5 w-4.5" strokeWidth={2} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
