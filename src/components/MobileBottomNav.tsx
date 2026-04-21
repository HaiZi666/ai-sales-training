'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const active = 'text-blue-600';
const inactive = 'text-gray-500';

/**
 * 与首页一致的移动端底栏：首页 · 培训 · 演练 · 历史
 */
export default function MobileBottomNav() {
  const pathname = usePathname() || '';

  const isHome = pathname === '/';
  const isTraining = pathname.startsWith('/training');
  const isPractice = pathname.startsWith('/practice');
  const isHistory = pathname.startsWith('/history');

  return (
    <div className="mobile-nav">
      <div className="flex justify-around py-3">
        <Link href="/" className={`flex flex-col items-center gap-1 ${isHome ? active : inactive}`}>
          <span className="text-xl">🏠</span>
          <span className="text-xs">首页</span>
        </Link>
        <Link href="/training" className={`flex flex-col items-center gap-1 ${isTraining ? active : inactive}`}>
          <span className="text-xl">📖</span>
          <span className="text-xs">培训</span>
        </Link>
        <Link href="/practice/new" className={`flex flex-col items-center gap-1 ${isPractice ? active : inactive}`}>
          <span className="text-xl">🎯</span>
          <span className="text-xs">演练</span>
        </Link>
        <Link href="/history" className={`flex flex-col items-center gap-1 ${isHistory ? active : inactive}`}>
          <span className="text-xl">📝</span>
          <span className="text-xs">历史</span>
        </Link>
      </div>
    </div>
  );
}
