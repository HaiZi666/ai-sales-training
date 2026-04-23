'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpenCheck,
  CircleCheck,
  FileCheck2,
  GraduationCap,
  LoaderCircle,
  MessageSquareQuote,
  Sparkles,
} from 'lucide-react';
import MobileBottomNav from '@/components/MobileBottomNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/ui/page-shell';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { EXAM_PAPER_CATEGORY_COUNT, getExamPaperCategoryCount } from '@/lib/trainingExam';
import { cn } from '@/lib/utils';

type QuestionType = 'sales_faq' | 'product_basics';
type TrainingMode = 'practice' | 'exam';

interface ExamQuestionsResponse {
  categories?: string[];
  categoryCounts?: Record<string, number>;
  errors?: string[];
  warnings?: string[];
  error?: string;
}

const QUESTION_TYPES: {
  value: QuestionType;
  icon: typeof MessageSquareQuote;
  label: string;
  desc: string;
}[] = [
  {
    value: 'sales_faq',
    icon: MessageSquareQuote,
    label: '销售常见问题',
    desc: '测试你对常见销售场景的处理能力',
  },
  {
    value: 'product_basics',
    icon: GraduationCap,
    label: '产品基础知识',
    desc: '测试你对机构产品和课程体系的掌握',
  },
];

const MODE_CONFIG: Record<
  TrainingMode,
  {
    title: string;
    description: string;
    icon: typeof Sparkles;
  }
> = {
  practice: {
    title: '练习模式',
    description: '按题型进入日常训练，逐题作答，适合巩固知识点。',
    icon: Sparkles,
  },
  exam: {
    title: '考试模式',
    description: '系统自动随机组卷后跳转独立答题页，适合完整测评。',
    icon: FileCheck2,
  },
};

export default function TrainingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<TrainingMode>('practice');
  const [selected, setSelected] = useState<QuestionType | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [examCategories, setExamCategories] = useState<string[]>([]);
  const [examCategoryCounts, setExamCategoryCounts] = useState<Record<string, number>>({});
  const [examLoading, setExamLoading] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [examWarnings, setExamWarnings] = useState<string[]>([]);

  const resetExamState = useCallback(() => {
    setExamError(null);
  }, []);

  const loadExamQuestions = useCallback(async () => {
    setExamLoading(true);
    setExamError(null);

    try {
      const response = await fetch('/api/training/exam');
      const data = (await response.json()) as ExamQuestionsResponse;

      if (!response.ok) {
        setExamCategories([]);
        setExamCategoryCounts({});
        setExamWarnings(data.warnings ?? []);
        setExamError(data.error || data.errors?.[0] || '考试题库加载失败');
        return;
      }

      setExamCategories(data.categories ?? []);
      setExamCategoryCounts(data.categoryCounts ?? {});
      setExamWarnings(data.warnings ?? []);
      setExamError(data.errors?.[0] ?? null);
    } catch (error) {
      console.error('加载考试题库失败:', error);
      setExamCategories([]);
      setExamCategoryCounts({});
      setExamWarnings([]);
      setExamError('考试题库加载失败，请稍后重试');
    } finally {
      setExamLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestedMode = searchParams.get('mode');
    if (requestedMode === 'exam' || requestedMode === 'practice') {
      setMode(requestedMode);
    }
  }, [searchParams]);

  useEffect(() => {
    if (mode !== 'exam') return;
    resetExamState();
    if (examCategories.length === 0 && !examLoading) {
      void loadExamQuestions();
    }
  }, [mode, examCategories.length, examLoading, loadExamQuestions, resetExamState]);

  const handleStart = async () => {
    if (!selected) return;
    setIsStarting(true);
    try {
      const res = await fetch('/api/training/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionType: selected }),
      });
      const data = await res.json();
      if (data.sessionId) {
        const params = new URLSearchParams({
          firstQuestion: data.firstQuestion || '',
          firstQuestionId: data.firstQuestionId || '',
          firstStandardAnswer: data.firstStandardAnswer || '',
          questionTypeLabel: data.questionTypeName || data.questionTypeLabel || '',
          totalQuestions: String(data.totalQuestions || 0),
          openingMessage: data.openingMessage || '',
        });
        router.push(`/training/${data.sessionId}?${params.toString()}`);
      } else {
        alert(data.error || '创建培训会话失败');
      }
    } catch (error) {
      console.error('创建培训会话失败:', error);
      alert('启动失败，请重试');
    } finally {
      setIsStarting(false);
    }
  };

  const validExamCategories = useMemo(
    () => examCategories.filter(category => (examCategoryCounts[category] ?? 0) > 0),
    [examCategories, examCategoryCounts]
  );
  const actualExamCategoryCount = getExamPaperCategoryCount(validExamCategories.length);
  const canBuildExamPaper = actualExamCategoryCount > 0;

  const handleModeChange = (nextMode: TrainingMode) => {
    setMode(nextMode);
    if (nextMode === 'exam') {
      resetExamState();
    }
  };

  const handleStartExam = async () => {
    setExamError(null);

    if (!canBuildExamPaper) {
      setExamError('当前考试题库没有可用分类，无法组卷');
      return;
    }

    setStartingExam(true);
    try {
      const response = await fetch('/api/training/exam/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedCategoryCount: EXAM_PAPER_CATEGORY_COUNT }),
      });
      const data = (await response.json()) as { sessionId?: string; error?: string; warnings?: string[] };

      if (!response.ok || !data.sessionId) {
        setExamWarnings(data.warnings ?? []);
        setExamError(data.error || '创建考试会话失败，请稍后重试');
        return;
      }

      router.push(`/training/exam/${data.sessionId}`);
    } catch (error) {
      console.error('创建考试会话失败:', error);
      setExamError('创建考试会话失败，请稍后重试');
    } finally {
      setStartingExam(false);
    }
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">

        <PageHeader
          title="基础知识闯关练"
          description=""
        />

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text)]">请选择培训模式</h2>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2">
          {(Object.entries(MODE_CONFIG) as Array<[TrainingMode, (typeof MODE_CONFIG)[TrainingMode]]>).map(
            ([modeKey, config]) => {
              const Icon = config.icon;
              const active = mode === modeKey;

              return (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() => handleModeChange(modeKey)}
                  className={cn(
                    'w-full rounded-[var(--radius-xl)] border bg-white p-5 text-left transition-all',
                    active
                      ? 'border-[rgba(124,108,248,0.34)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(238,235,255,0.56))] shadow-[0_18px_40px_-28px_rgba(97,92,248,0.45)]'
                      : 'border-[var(--color-border-soft)] hover:border-[var(--color-border)] hover:shadow-[var(--shadow-card)]'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[var(--color-fill-soft)] text-[var(--color-brand-strong)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-base font-semibold text-[var(--color-text)]">{config.title}</h3>
                        {active ? (
                          <Badge variant="brand" className="gap-1">
                            <CircleCheck className="h-3.5 w-3.5" />
                            当前模式
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{config.description}</p>
                    </div>
                  </div>
                </button>
              );
            }
          )}
        </div>

        {mode === 'practice' ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--color-text)]">请选择培训题型</h2>
            </div>

            <div className="space-y-4">
              {QUESTION_TYPES.map(type => {
                const Icon = type.icon;

                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setSelected(type.value)}
                    className={cn(
                      'w-full rounded-[var(--radius-xl)] border bg-white p-5 text-left transition-all',
                      selected === type.value
                        ? 'border-[rgba(124,108,248,0.34)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(238,235,255,0.56))] shadow-[0_18px_40px_-28px_rgba(97,92,248,0.45)]'
                        : 'border-[var(--color-border-soft)] hover:border-[var(--color-border)] hover:shadow-[var(--shadow-card)]'
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[var(--color-fill-soft)] text-[var(--color-brand-strong)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <h3 className="text-base font-semibold text-[var(--color-text)]">{type.label}</h3>
                          {selected === type.value ? (
                            <Badge variant="brand" className="gap-1">
                              <CircleCheck className="h-3.5 w-3.5" />
                              已选择
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{type.desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <Card className="mt-8 mb-6">
              <CardHeader className="flex-row items-start gap-4 pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
                  <BookOpenCheck className="h-5 w-5" />
                </div>
                <div className="space-y-3">
                  <div>
                    <CardTitle>练习规则</CardTitle>
                    <CardDescription>进入题型后逐题练习，适合日常巩固与快速复盘。</CardDescription>
                  </div>
                  <div className="grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-3">
                    <div className="rounded-[var(--radius-lg)] bg-[var(--color-fill-soft)] px-4 py-3">按所选题型随机顺序逐题出题，答完为止</div>
                    <div className="rounded-[var(--radius-lg)] bg-[var(--color-fill-soft)] px-4 py-3">每道题满分 10 分，完成后统一查看培训总结</div>
                    <div className="rounded-[var(--radius-lg)] bg-[var(--color-fill-soft)] px-4 py-3">结果展示总分、等级以及每题参考答案</div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="mt-8">
              <Button
                onClick={handleStart}
                disabled={!selected || isStarting}
                size="lg"
                className="w-full"
              >
                {isStarting ? '正在启动...' : '开始练习'}
              </Button>
            </div>
          </>
        ) : null}

        {mode === 'exam' ? (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>考试模式</CardTitle>
                <CardDescription>
                  系统会优先随机抽取 {EXAM_PAPER_CATEGORY_COUNT} 类组卷答题
                </CardDescription>
              </CardHeader>
            </Card>

            {examError ? (
              <div className="rounded-[var(--radius-lg)] border border-[rgba(239,68,68,0.16)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
                {examError}
              </div>
            ) : null}

            {examWarnings.length > 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-[rgba(245,158,11,0.18)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-warning-strong)]">
                {examWarnings[0]}
              </div>
            ) : null}

            {examLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-[var(--color-text-secondary)]">
                  <LoaderCircle className="h-4 w-4 animate-spin text-[var(--color-brand-strong)]" />
                  正在加载考试题库...
                </CardContent>
              </Card>
            ) : null}

            {!examLoading && examCategories.length > 0 ? (
              <>

                {!canBuildExamPaper ? (
                  <div className="rounded-[var(--radius-lg)] border border-[rgba(245,158,11,0.18)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-warning-strong)]">
                    当前考试题库没有有效分类，无法组卷。
                  </div>
                ) : null}

                <Card className="mb-6">
                  <CardHeader className="flex-row items-start gap-4 pb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
                      <FileCheck2 className="h-5 w-5" />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <CardTitle>考试规则</CardTitle>
                        <CardDescription>系统自动随机组卷，进入独立答题页完成整套试卷。</CardDescription>
                      </div>
                      <div className="grid gap-2 text-sm text-[var(--color-text-secondary)] md:grid-cols-3">
                        <div className="rounded-[var(--radius-lg)] bg-[var(--color-fill-soft)] px-4 py-3">优先随机抽取 {EXAM_PAPER_CATEGORY_COUNT} 个分类，不足则按现有最大有效分类数组卷</div>
                        <div className="rounded-[var(--radius-lg)] bg-[var(--color-fill-soft)] px-4 py-3">每个分类随机抽取 1 道题，组成一整套考试试卷</div>
                        <div className="rounded-[var(--radius-lg)] bg-[var(--color-fill-soft)] px-4 py-3">完成整套试卷后统一评分，展示总分、正确率与逐题明细</div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <div className="mt-2">
                  <Button
                    onClick={() => void handleStartExam()}
                    disabled={!canBuildExamPaper || startingExam}
                    size="lg"
                    className="w-full"
                  >
                    {startingExam ? '正在创建试卷...' : '随机生成试卷并开始考试'}
                  </Button>
                </div>
              </>
            ) : null}

            {!examLoading && examCategories.length === 0 && !examError ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-[var(--color-text-secondary)]">
                  ExamQuestions 无有效数据，暂时无法开始考试。
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
      <MobileBottomNav />
    </PageShell>
  );
}
