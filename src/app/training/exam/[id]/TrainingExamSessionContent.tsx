'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileCheck2, LoaderCircle, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/field';
import {
  EXAM_PAPER_CATEGORY_COUNT,
  scoreExamPaper,
  type ExamQuestion,
  type ExamResult,
} from '@/lib/trainingExam';

interface ExamSessionResponse {
  session?: {
    id: string;
    status: 'active' | 'finished';
    questions: ExamQuestion[];
    selectedCategories: string[];
    startedAt: string;
  };
  error?: string;
}

export default function TrainingExamSessionContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(resolved => setSessionId(resolved.id));
  }, [params]);

  useEffect(() => {
    if (!sessionId) return;

    const loadSession = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/training/exam/sessions/${sessionId}`);
        const data = (await response.json()) as ExamSessionResponse;

        if (!response.ok || !data.session) {
          setError(data.error || '考试会话不存在');
          return;
        }

        setQuestions(data.session.questions);
        setSelectedCategories(data.session.selectedCategories);
      } catch (fetchError) {
        console.error('加载考试会话失败:', fetchError);
        setError('加载考试会话失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    void loadSession();
  }, [sessionId]);

  const currentQuestion = questions[currentIndex] ?? null;
  const progress = questions.length > 0 ? Math.round((currentIndex / questions.length) * 100) : 0;

  const finishSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      await fetch(`/api/training/exam/sessions/${sessionId}/finish`, { method: 'POST' });
    } catch {
      // 结束失败不阻塞前端结果展示
    }
  }, [sessionId]);

  const handleSubmit = async () => {
    if (!currentQuestion) {
      setError('当前没有可作答题目');
      return;
    }

    if (!inputText.trim()) {
      setError('请输入答案后再继续');
      return;
    }

    setSubmitting(true);
    setError(null);

    const nextAnswers = {
      ...answers,
      [currentQuestion.id]: inputText.trim(),
    };

    setAnswers(nextAnswers);

    if (currentIndex >= questions.length - 1) {
      const examResult = scoreExamPaper(questions, nextAnswers);
      setResult(examResult);
      setInputText('');
      await finishSession();
      setSubmitting(false);
      return;
    }

    setCurrentIndex(prev => prev + 1);
    setInputText('');
    setSubmitting(false);
  };

  const handleRestart = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/training/exam/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedCategoryCount: EXAM_PAPER_CATEGORY_COUNT }),
      });
      const data = (await response.json()) as { sessionId?: string; error?: string };

      if (!response.ok || !data.sessionId) {
        setError(data.error || '重新创建考试失败');
        return;
      }

      router.push(`/training/exam/${data.sessionId}`);
    } catch (restartError) {
      console.error('重新考试失败:', restartError);
      setError('重新考试失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg)] px-4">
        <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
          <LoaderCircle className="h-4 w-4 animate-spin text-[var(--color-brand-strong)]" />
          正在加载考试试卷...
        </div>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardContent className="space-y-4 p-6 text-center">
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
              <div className="flex justify-center">
                <Link href="/training?mode=exam">
                  <Button variant="secondary">返回培训首页</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link
            href="/training?mode=exam"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-brand-strong)]"
          >
            <ArrowLeft className="h-4 w-4" />
            返回培训首页
          </Link>
        </div>

        {result ? (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[var(--color-fill-soft)] text-[var(--color-brand-strong)]">
                    <FileCheck2 className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle>考试结果</CardTitle>
                    <CardDescription>以下为本次 {questions.length} 题试卷的汇总成绩与逐题结果。</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {error ? (
              <div className="rounded-[var(--radius-lg)] border border-[rgba(239,68,68,0.16)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
                {error}
              </div>
            ) : null}

            <Card className="overflow-hidden">
              <CardContent className="grid gap-4 p-5 md:grid-cols-4">
                <div className="rounded-[var(--radius-lg)] bg-[linear-gradient(135deg,rgba(238,235,255,0.95),rgba(232,241,255,0.95))] px-4 py-5 text-center">
                  <div className="text-xs text-[var(--color-text-secondary)]">总分</div>
                  <div className="mt-2 text-3xl font-semibold text-[var(--color-brand-strong)]">{result.totalScore}</div>
                </div>
                <div className="rounded-[var(--radius-lg)] bg-[var(--color-success-soft)] px-4 py-5 text-center">
                  <div className="text-xs text-[var(--color-success-strong)]">答对题数</div>
                  <div className="mt-2 text-3xl font-semibold text-[var(--color-success)]">{result.correctCount}</div>
                </div>
                <div className="rounded-[var(--radius-lg)] bg-[var(--color-danger-soft)] px-4 py-5 text-center">
                  <div className="text-xs text-[var(--color-danger-strong)]">答错题数</div>
                  <div className="mt-2 text-3xl font-semibold text-[var(--color-danger)]">{result.incorrectCount}</div>
                </div>
                <div className="rounded-[var(--radius-lg)] bg-[var(--color-fill-soft)] px-4 py-5 text-center">
                  <div className="text-xs text-[var(--color-text-secondary)]">正确率</div>
                  <div className="mt-2 text-3xl font-semibold text-[var(--color-text)]">{result.accuracy}%</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>本次抽取分类</CardTitle>
                <CardDescription>每个分类随机抽取 1 道题组成试卷。</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {selectedCategories.map(category => (
                  <Badge key={category} variant="neutral">
                    {category}
                  </Badge>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>逐题结果</CardTitle>
                <CardDescription>展示分类、题干、用户答案、参考话术与单题得分。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.items.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-fill-soft)] p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="brand">{item.category}</Badge>
                        <span className="text-sm font-medium text-[var(--color-text)]">第 {index + 1} 题</span>
                      </div>
                      <Badge variant={item.isCorrect ? 'success' : 'danger'}>
                        {item.isCorrect ? '答对' : '答错'} · {item.score}/{item.maxScore}
                      </Badge>
                    </div>
                    <div className="space-y-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                      <div>
                        <div className="mb-1 font-medium text-[var(--color-text)]">常见问题</div>
                        <div className="whitespace-pre-wrap">{item.question}</div>
                      </div>
                      <div>
                        <div className="mb-1 font-medium text-[var(--color-text)]">你的答案</div>
                        <div className="whitespace-pre-wrap">{item.userAnswer || '未作答'}</div>
                      </div>
                      <div>
                        <div className="mb-1 font-medium text-[var(--color-text)]">参考话术</div>
                        <div className="whitespace-pre-wrap text-[var(--color-brand-strong)]">{item.referenceAnswer}</div>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">{item.feedback}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="sm:flex-1" onClick={() => void handleRestart()} disabled={submitting}>
                <RefreshCcw className="h-4 w-4" />
                再考一次
              </Button>
              <Link href="/training?mode=exam" className="sm:flex-1">
                <Button variant="secondary" className="w-full">
                  返回培训首页
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>考试进行中</CardTitle>
              </CardHeader>
            </Card>

            {error ? (
              <div className="rounded-[var(--radius-lg)] border border-[rgba(239,68,68,0.16)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
                {error}
              </div>
            ) : null}

            {currentQuestion ? (
              <>
                <Card className="overflow-hidden">
                  <CardContent className="p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <Badge variant="brand">{currentQuestion.category}</Badge>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        第 {currentIndex + 1} / {questions.length} 题
                      </span>
                    </div>
                    <Progress value={progress} className="mb-4" />
                    <div className="whitespace-pre-wrap text-base leading-8 text-[var(--color-text)]">
                      {currentQuestion.question}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle>你的作答</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={inputText}
                      onChange={event => setInputText(event.target.value)}
                      placeholder="请在此输入你的答案..."
                    />
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link href="/training?mode=exam" className="sm:flex-1">
                        <Button variant="secondary" className="w-full">
                          返回考试首页
                        </Button>
                      </Link>
                      <Button className="sm:flex-1" onClick={() => void handleSubmit()} disabled={submitting}>
                        {submitting ? '提交中...' : currentIndex === questions.length - 1 ? '完成试卷' : '下一题'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
