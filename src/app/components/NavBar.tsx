'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { History, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/practice/new', label: '新建演练', icon: Sparkles },
  { href: '/history', label: '演练历史', icon: History },
];

export default function NavBar() {
  const pathname = usePathname();

  // 只在邀约场景模拟（/practice）流程下显示头部
  if (!pathname.startsWith('/practice')) return null;

  return (
    <nav className="safe-area-top sticky top-0 z-30 border-b border-[var(--color-border-soft)] bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--color-brand-from),var(--color-brand-to))] text-sm font-semibold text-white shadow-[var(--shadow-button)]">
            AI
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-[var(--color-text)]">AI 销售陪练</div>
            <div className="text-xs text-[var(--color-text-muted)]">Practice Studio</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {navLinks.map(item => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-all',
                  active
                    ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-fill-soft)] hover:text-[var(--color-text)]'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
          <Link href="/" className="text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-brand-strong)]">
            返回首页
          </Link>
        </div>
      </div>
    </nav>
  );
}
