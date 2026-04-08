import type { Metadata, Viewport } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AI 销售话术陪练系统',
  description: '让AI扮演客户，与销售进行实时对话演练并评分',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50">
        {/* 顶部导航 - 移动端优化 */}
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
                  新建
                </Link>
                <Link
                  href="/history"
                  className="text-gray-600 hover:text-gray-900 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
                >
                  历史
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {children}
      </body>
    </html>
  );
}
