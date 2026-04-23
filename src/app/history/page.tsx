'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, ChevronRight, History, Sparkles } from 'lucide-react';
import MobileBottomNav from '@/components/MobileBottomNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/ui/page-shell';

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
    <PageShell>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="历史记录"
          description="查看过往演练成绩与当前会话状态，列表维持轻边框和低干扰视觉。"
          action={
            <Button onClick={() => router.push('/practice/new')}>
              <Sparkles className="h-4 w-4" />
              新建演练
            </Button>
          }
        />

        {loading ? (
          <Card>
            <CardContent className="py-14 text-center text-sm text-[var(--color-text-secondary)]">
              正在加载历史记录...
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
                <History className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--color-text)]">暂无历史记录</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--color-text-secondary)]">
                开始你的第一次演练后，这里会自动沉淀会话记录与评分结果。
              </p>
              <Button className="mt-6" onClick={() => router.push('/practice/new')}>
                立即开始
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-[var(--color-border-soft)] pb-5">
              <CardTitle>会话列表</CardTitle>
              <CardDescription>共 {sessions.length} 条记录</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[var(--color-border-soft)]">
                {sessions.map(session => {
                  const scoreColor =
                    session.totalScore == null
                      ? 'text-[var(--color-text-muted)]'
                      : session.totalScore >= 80
                        ? 'text-[var(--color-success)]'
                        : session.totalScore >= 60
                          ? 'text-[var(--color-warning)]'
                          : 'text-[var(--color-danger)]';

                  return (
                    <button
                      key={session.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-[var(--color-fill-soft)]"
                      onClick={() => router.push(`/practice/${session.id}`)}
                    >
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-[var(--color-text)]">{session.customerType}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                          <span>{session.customerScore}</span>
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {formatDate(session.startedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className={`text-2xl font-semibold ${scoreColor}`}>
                            {session.totalScore ?? '--'}
                            {session.totalScore != null ? <span className="ml-1 text-sm font-normal">分</span> : null}
                          </div>
                          <div className="mt-2">
                            <Badge variant={session.status === 'finished' ? 'success' : 'brand'}>
                              {session.status === 'finished' ? '已完成' : '进行中'}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="hidden h-4 w-4 text-[var(--color-text-muted)] sm:block" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <MobileBottomNav />
    </PageShell>
  );
}
