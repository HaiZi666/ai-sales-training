import type { Metadata, Viewport } from 'next';
import './globals.css';
import NavBar from './components/NavBar';

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
        {/* 仅在邀约场景模拟（/practice）流程下显示头部 */}
        <NavBar />
        {children}
      </body>
    </html>
  );
}
