'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SessionItem {
  id: string;
  customerType: string;
  customerScore: string;
  status: string;
  startedAt: string;
  totalScore?: number;
}

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/sessions');
        const data = await res.json();
        if (data.sessions) {
          setSessions(data.sessions);
        }
      } catch (error) {
        console.error('获取历史失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 pb-28">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">历史记录</h1>
            <p className="text-gray-500 mt-1">查看过往演练成绩</p>
          </div>
          <button
            onClick={() => router.push('/practice/new')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
          >
            新建演练
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-4xl mb-4">📝</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">暂无历史记录</h2>
            <p className="text-gray-500 mb-4">开始你的第一次演练吧</p>
            <button
              onClick={() => router.push('/practice/new')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
            >
              立即开始
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map(session => (
              <div
                key={session.id}
                className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/practice/${session.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-lg">
                      {session.customerType}
                    </div>
                    <div className="text-gray-500 text-sm mt-1">
                      {session.customerScore} · {formatDate(session.startedAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${
                      session.totalScore 
                        ? session.totalScore >= 80 
                          ? 'text-green-600' 
                          : session.totalScore >= 60 
                            ? 'text-yellow-600' 
                            : 'text-red-600'
                        : 'text-gray-400'
                    }`}>
                      {session.totalScore ?? '--'}
                      {session.totalScore && <span className="text-sm font-normal">分</span>}
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded-full ${
                      session.status === 'finished'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {session.status === 'finished' ? '已完成' : '进行中'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 移动端底部导航 */}
      <div className="mobile-nav">
        <div className="flex justify-around py-3">
          <Link href="/" className="flex flex-col items-center gap-1 text-gray-500">
            <span className="text-xl">🏠</span>
            <span className="text-xs">首页</span>
          </Link>
          <Link href="/practice/new" className="flex flex-col items-center gap-1 text-gray-500">
            <span className="text-xl">🎯</span>
            <span className="text-xs">新建</span>
          </Link>
          <Link href="/history" className="flex flex-col items-center gap-1 text-blue-600">
            <span className="text-xl">📝</span>
            <span className="text-xs">历史</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
