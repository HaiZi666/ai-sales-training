import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AI 销售话术陪练系统',
  description: '让AI扮演客户，与销售进行实时对话演练并评分',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        {/* 顶部导航 */}
        <nav className="bg-white border-b">
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex items-center justify-between h-14">
              <Link href="/" className="font-bold text-lg text-gray-900">
                AI 陪练
              </Link>
              <div className="flex items-center gap-6">
                <Link href="/practice/new" className="text-gray-600 hover:text-gray-900">
                  新建演练
                </Link>
                <Link href="/history" className="text-gray-600 hover:text-gray-900">
                  历史记录
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
