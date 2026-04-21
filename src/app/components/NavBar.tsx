'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavBar() {
  const pathname = usePathname();

  // 只在邀约场景模拟（/practice）流程下显示头部
  if (!pathname.startsWith('/practice')) return null;

  return (
    <nav className="bg-white border-b sticky top-0 z-30 safe-area-top">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-12">
          <Link href="/" className="font-bold text-base text-gray-900">
            AI 陪练
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/practice/new"
              className="text-gray-600 hover:text-gray-900 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              新建演练
            </Link>
            <Link
              href="/history"
              className="text-gray-600 hover:text-gray-900 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              演练历史
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
