'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, FileBadge2, Lightbulb, LoaderCircle, RotateCcw, TrendingUp } from 'lucide-react';
import MobileBottomNav from '@/components/MobileBottomNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageShell } from '@/components/ui/page-shell';

interface DimensionScore {
  name: string;
  score: number;
  max: number;
  detail: string;
}

interface Report {
  sessionId: string;
  totalScore: number;
  grade: string;
  dimensions: DimensionScore[];
  highlight: string;
  weakness: string;
  improvements: string[];
}

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        // 先获取session状态
        const sessionRes = await fetch(`/api/sessions/${params.id}`);
        const sessionData = await sessionRes.json();
        
        // 如果会话还没结束，重定向到对话页面
        if (sessionData.session && sessionData.session.status !== 'finished') {
          router.replace(`/practice/${params.id}`);
          return;
        }
        
        const res = await fetch(`/api/sessions/${params.id}/report`);
        const data = await res.json();
        if (data.report) {
          setReport(data.report);
        }
      } catch (error) {
        console.error('获取报告失败:', error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchReport();
    }
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[var(--color-bg)] px-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[var(--shadow-card)]">
          <LoaderCircle className="h-7 w-7 animate-spin text-[var(--color-brand-strong)]" />
        </div>
        <div className="text-center">
          <p className="text-base font-medium text-[var(--color-text)]">正在生成评分报告</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">AI 正在分析本次对话，请稍候...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="text-[var(--color-text-secondary)]">报告不存在</div>
      </div>
    );
  }

  const percentage = Math.round((report.totalScore / 100) * 100);

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <Badge variant="brand" className="mb-4">完整分析 · 针对性提升</Badge>
          <h1 className="text-3xl font-semibold text-[var(--color-text)] md:text-4xl">演练报告</h1>
        </div>

        <Card className="mb-6 overflow-hidden">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-5 flex h-32 w-32 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(238,235,255,0.95),rgba(232,241,255,0.95))]">
              <div>
                <div className="text-4xl font-semibold text-[var(--color-brand-strong)]">{report.totalScore}</div>
                <div className="text-sm text-[var(--color-text-muted)]">/100 分</div>
              </div>
            </div>
            <div className="mb-2 text-2xl font-semibold text-[var(--color-text)]">等级：{report.grade}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">{percentage}% 得分率</div>
          </CardContent>
        </Card>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {report.highlight ? (
            <Card className="border-[rgba(16,185,129,0.16)] bg-[var(--color-success-soft)]">
              <CardContent className="flex gap-3 p-5">
                <Lightbulb className="mt-0.5 h-5 w-5 text-[var(--color-success-strong)]" />
                <div>
                  <div className="font-semibold text-[var(--color-success-strong)]">亮点</div>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-success-strong)]">{report.highlight}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}
          {report.weakness ? (
            <Card className="border-[rgba(245,158,11,0.18)] bg-[var(--color-warning-soft)]">
              <CardContent className="flex gap-3 p-5">
                <FileBadge2 className="mt-0.5 h-5 w-5 text-[var(--color-warning-strong)]" />
                <div>
                  <div className="font-semibold text-[var(--color-warning-strong)]">薄弱点</div>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-warning-strong)]">{report.weakness}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>各维度得分</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {report.dimensions.map(dim => {
              const pct = Math.round((dim.score / dim.max) * 100);
              return (
                <div key={dim.name} className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] p-4">
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <div className="font-medium text-[var(--color-text)]">{dim.name}</div>
                    <div className="text-sm text-[var(--color-text-secondary)]">
                      {dim.score} <span className="text-[var(--color-text-muted)]">/ {dim.max}分</span>
                    </div>
                  </div>
                  <Progress
                    value={pct}
                    indicatorClassName={
                      pct >= 80
                        ? 'bg-[var(--color-success)]'
                        : pct >= 60
                          ? 'bg-[var(--color-warning)]'
                          : 'bg-[var(--color-danger)]'
                    }
                  />
                  <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{dim.detail}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {report.improvements.length > 0 ? (
          <Card className="mb-6">
            <CardContent className="space-y-3">
              {report.improvements.map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--color-fill-soft)] px-4 py-3">
                  <ChevronRight className="mt-0.5 h-4 w-4 text-[var(--color-brand-strong)]" />
                  <span className="text-sm leading-6 text-[var(--color-text-secondary)]">{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button className="flex-1" size="lg" onClick={() => router.push('/practice/new')}>
            <RotateCcw className="h-4 w-4" />
            再来一次
          </Button>
          <Button variant="secondary" className="flex-1" size="lg" onClick={() => router.push('/history')}>
            <TrendingUp className="h-4 w-4" />
            查看历史
          </Button>
        </div>
      </div>
      <MobileBottomNav />
    </PageShell>
  );
}
