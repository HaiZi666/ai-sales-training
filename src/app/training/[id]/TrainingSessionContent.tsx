'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Flag, Mic, Square, Type, X } from 'lucide-react';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { evaluateTrainingAnswer } from '@/lib/trainingScoring';

interface QuestionResult {
  question: string;
  standardAnswer: string;
  userAnswer: string;
}

/** 与 evaluateAnswer 一致：单题最高 9 分，档位 9 / 7 / 5 / 3（及 0） */
const RUBRIC_MAX_PER_QUESTION = 9;

export default function TrainingSessionContent({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const MAX_RECORDING_SECONDS = 180;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentQuestionId, setCurrentQuestionId] = useState('');
  const [currentStandardAnswer, setCurrentStandardAnswer] = useState('');
  const [askedCount, setAskedCount] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [questionTypeLabel, setQuestionTypeLabel] = useState('');
  const [openingMessage, setOpeningMessage] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** 用户点击顶部「结束」提前终止；评价仅按已答题目计分（总分 = 已答题数 × 10） */
  const [endedByUser, setEndedByUser] = useState(false);

  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const voice = useVoiceRecording();
  /** 顶栏「结束」确认弹窗（替代浏览器 confirm） */
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);

  useEffect(() => {
    params.then(p => setSessionId(p.id));
  }, [params]);

  useEffect(() => {
    const firstQuestion = searchParams.get('firstQuestion') || '';
    const firstQuestionId = searchParams.get('firstQuestionId') || '';
    const firstStandardAnswer = searchParams.get('firstStandardAnswer') || '';
    const label = searchParams.get('questionTypeLabel') || '基础知识闯关练';
    const total = parseInt(searchParams.get('totalQuestions') || '0', 10);
    const opening = searchParams.get('openingMessage') || '';

    setQuestionTypeLabel(label);
    setCurrentQuestion(firstQuestion);
    setCurrentQuestionId(firstQuestionId);
    setCurrentStandardAnswer(firstStandardAnswer);
    setTotalQuestions(total);
    setAskedCount(firstQuestion ? 1 : 0);
    setOpeningMessage(opening);
    setEndedByUser(false);
  }, [searchParams]);

  /** 提交当前题答案：与原先 POST /message 逻辑一致，不再写聊天记录 */
  const submitCurrentAnswer = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? inputText).trim();
    if (!text || isLoading || isFinished || !sessionId) return;

    setSubmitError(null);
    setIsLoading(true);

    const result: QuestionResult = {
      question: currentQuestion,
      standardAnswer: currentStandardAnswer,
      userAnswer: text,
    };

    try {
      const res = await fetch(`/api/training/sessions/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          currentQuestionId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || '提交失败，请重试');
        return;
      }

      setQuestionResults(prev => [...prev, result]);
      setInputText('');

      if (data.isFinished) {
        setEndedByUser(false);
        setIsFinished(true);
        setAskedCount(data.askedCount ?? totalQuestions);
      } else if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
        setCurrentQuestionId(data.nextQuestionId);
        const nextStd =
          typeof (data as { nextStandardAnswer?: string }).nextStandardAnswer === 'string'
            ? (data as { nextStandardAnswer: string }).nextStandardAnswer
            : '';
        setCurrentStandardAnswer(nextStd);
        const nextQuestionNumber = (data.askedCount ?? 0) + 1;
        setAskedCount(nextQuestionNumber);
      }
    } catch (error) {
      console.error('提交失败:', error);
      setSubmitError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [
    inputText,
    isLoading,
    isFinished,
    sessionId,
    currentQuestion,
    currentQuestionId,
    currentStandardAnswer,
    totalQuestions,
  ]);

  /** blob → base64（去掉 data:xxx;base64, 前缀） */
  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  /** 从 blob MIME 推断音频格式 */
  const getAudioFormat = (blob: Blob): string => {
    const m = blob.type || '';
    if (m.includes('mp4')) return 'mp4';
    if (m.includes('ogg')) return 'ogg';
    if (m.includes('mp3') || m.includes('mpeg')) return 'mp3';
    return 'webm';
  };

  /** 录音完成 → base64 → 本地后端转写 → 填入文本框 */
  const transcribeAndFill = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const base64Data = await blobToBase64(blob);
      const format = getAudioFormat(blob);
      const res = await fetch('/api/speech-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Data, format }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text?.trim()) {
          setInputText(data.text);
        }
      }
    } catch {
      /* 转写失败时保留手动输入 */
    }
    setIsTranscribing(false);
  }, []);

  const handleVoiceButton = useCallback(async () => {
    if (voice.isRecording) {
      const blob = await voice.stopRecording();
      if (blob) await transcribeAndFill(blob);
    } else {
      await voice.startRecording();
    }
  }, [voice, transcribeAndFill]);

  /** 录音达到 3 分钟自动停止并转写 */
  useEffect(() => {
    if (!voice.isRecording || voice.duration < MAX_RECORDING_SECONDS) return;
    void (async () => {
      const blob = await voice.stopRecording();
      if (blob) await transcribeAndFill(blob);
    })();
  }, [voice, transcribeAndFill]);

  const finalResults = questionResults.map(r => ({
    ...r,
    ...evaluateTrainingAnswer(r.userAnswer, r.standardAnswer),
  }));

  const totalScore = finalResults.reduce((sum, r) => sum + r.score, 0);
  const questionCount = finalResults.length;
  const totalMax = questionCount * RUBRIC_MAX_PER_QUESTION;
  const scorePercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  /** 平均分与图例档位对齐：9→A、7→B、5→C、3→D、0→E（勿再用「总分/题数×10」的百分位划级，否则会 7 分变 C） */
  const averageScore = questionCount > 0 ? totalScore / questionCount : 0;
  const grade: 'A' | 'B' | 'C' | 'D' | 'E' | '—' =
    questionCount === 0
      ? '—'
      : averageScore >= 9
        ? 'A'
        : averageScore >= 7
          ? 'B'
          : averageScore >= 5
            ? 'C'
            : averageScore >= 3
              ? 'D'
              : 'E';

  const gradeColor =
    grade === 'A' ? 'text-green-600' :
    grade === 'B' ? 'text-blue-600' :
    grade === 'C' ? 'text-yellow-600' :
    grade === 'D' ? 'text-orange-600' :
    grade === 'E' ? 'text-red-600' : 'text-gray-500';

  const answeredCount = questionResults.length;
  const progressPercent =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const isLastQuestion = totalQuestions > 0 && askedCount >= totalQuestions;
  const primaryButtonLabel = isFinished ? '去评价' : isLastQuestion ? '去评价' : '下一题';
  const canSubmitPrimary = !isFinished && !!inputText.trim() && !isLoading;
  const handlePrimaryClick = () => {
    if (isFinished) {
      setShowSummary(true);
      return;
    }
    void submitCurrentAnswer();
  };

  const canEndPractice = answeredCount >= 1 && !isLoading && !isFinished;

  const openEndConfirm = useCallback(() => {
    if (!sessionId || answeredCount < 1 || isLoading || isFinished) return;
    setEndConfirmOpen(true);
  }, [sessionId, answeredCount, isLoading, isFinished]);

  const performEndPractice = useCallback(async () => {
    if (!sessionId) return;
    setEndConfirmOpen(false);
    try {
      await fetch(`/api/training/sessions/${sessionId}/end`, { method: 'POST' });
    } catch {
      /* 仍进入本地评价 */
    }
    void voice.stopRecording();
    setInputText('');
    setEndedByUser(true);
    setIsFinished(true);
    setShowSummary(true);
  }, [sessionId, voice]);

  useEffect(() => {
    if (!endConfirmOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEndConfirmOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [endConfirmOpen]);

  /** 关闭培训总结后回到基础知识闯关练选题页 */
  const closeSummaryAndBackToTraining = useCallback(() => {
    setShowSummary(false);
    router.push('/training');
  }, [router]);

  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg)]">
      {/* 顶栏：返回 + 标题 + 更多 */}
      <header className="shrink-0 border-b border-[var(--color-border-soft)] bg-white/88 px-3 pb-4 pt-[max(0.9rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          <Link
            href="/training"
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-fill-soft)]"
            aria-label="返回"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="flex-1 truncate px-2 text-center text-[15px] font-semibold text-[var(--color-text)]">
            {questionTypeLabel}
          </h1>
          <Button size="sm" onClick={openEndConfirm} disabled={!canEndPractice} className="shrink-0">
            结束
          </Button>
        </div>

        <div className="mx-auto mt-4 flex max-w-2xl items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Progress value={progressPercent} indicatorClassName="bg-[linear-gradient(135deg,var(--color-brand-from),var(--color-brand-to))]" />
            {progressPercent > 0 ? (
              <span
                className="pointer-events-none absolute top-1/2 z-[1] flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md bg-[linear-gradient(135deg,var(--color-brand-from),var(--color-brand-to))] text-white shadow-[var(--shadow-button)]"
                style={{ left: `clamp(8px, ${progressPercent}%, calc(100% - 8px))` }}
              >
                <Flag className="h-3 w-3" />
              </span>
            ) : null}
          </div>
          <p className="shrink-0 text-xs tabular-nums text-[var(--color-text-secondary)]">
            共 <span className="font-bold text-[var(--color-brand-strong)]">{isFinished ? totalQuestions || answeredCount : totalQuestions || '—'}</span> 题
          </p>
        </div>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] text-[var(--color-text-muted)]">
          {isFinished ? (
            endedByUser && answeredCount < totalQuestions ? (
              <>
                已提前结束 · 已答 <span className="font-bold text-[var(--color-brand-strong)]">{answeredCount}</span> / {totalQuestions} 题 · 进度{' '}
                <span className="font-bold text-[var(--color-brand-strong)]">{progressPercent}%</span>
              </>
            ) : (
              <>
                已完成 · <span className="font-bold text-[var(--color-brand-strong)]">100%</span>
              </>
            )
          ) : (
            <>
              进度 <span className="font-bold text-[var(--color-brand-strong)]">{progressPercent}%</span>
              {totalQuestions > 0 ? ` · 第 ${askedCount} / ${totalQuestions} 题` : ''}
            </>
          )}
        </p>
      </header>

      {/* 可滚动：题干 + 作答区 + 参考答案 */}
      <div className="mx-auto flex-1 min-h-0 w-full max-w-2xl space-y-4 overflow-y-auto px-3 py-5 pb-32">
        {isFinished ? (
          <div className="rounded-[24px] border border-[rgba(124,108,248,0.18)] bg-white px-4 py-6 text-center shadow-[var(--shadow-card)]">
            <div className="mb-3 flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
                <CheckCircle2 className="h-5 w-5" />
              </span>
            </div>
            <p className="mb-1 text-base font-semibold text-[var(--color-text)]">全部题目已完成</p>
            <p className="text-sm text-[var(--color-text-secondary)]">点击下方按钮查看培训总结与逐题得分</p>
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-[24px] border border-[var(--color-border-soft)] bg-white shadow-[var(--shadow-card)]">
              <div className="px-4 pt-4 pb-3">
                <Badge variant="brand">
                  {questionTypeLabel}
                </Badge>
                <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                  第 {askedCount} 题{totalQuestions > 0 ? ` / 共 ${totalQuestions} 题` : ''}
                </p>
                <div className="mt-2 whitespace-pre-wrap text-[16px] font-normal leading-8 text-[var(--color-text)]">
                  {currentQuestion || '暂无题目'}
                </div>
              </div>

              {/* 作答区：灰底块 + 标题行（参考图「第①问」样式） */}
              <div className="mx-3 mb-4 overflow-hidden rounded-[20px] border border-[var(--color-border)] bg-[var(--color-fill-soft)]">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-3">
                  <span className="text-sm font-medium text-[var(--color-text)]">你的作答</span>
                  <SegmentedControl
                    value={inputMode}
                    onChange={setInputMode}
                    options={[
                      { value: 'text', label: '文字', icon: <Type className="h-3.5 w-3.5" /> },
                      { value: 'voice', label: '语音', icon: <Mic className="h-3.5 w-3.5" /> },
                    ]}
                    className="scale-[0.94]"
                  />
                </div>
                {openingMessage ? (
                  <p className="border-b border-[var(--color-border)] bg-white/70 px-3 py-2.5 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                    {openingMessage}
                  </p>
                ) : null}
                <Textarea
                  id="training-answer"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="请在此输入答案…"
                  disabled={isLoading}
                  rows={5}
                  className="rounded-none border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0"
                />
                {inputMode === 'voice' ? (
                  <div className="flex flex-col items-center gap-2 border-t border-[var(--color-border)] bg-white/70 px-3 pb-4">
                    <p className="pt-3 text-center text-[11px] text-[var(--color-text-secondary)]">
                      {voice.isRecording
                        ? `录音中 ${voice.duration}s（最长${MAX_RECORDING_SECONDS}s）· 再点停止并识别`
                        : isTranscribing
                        ? '识别中…'
                        : '点下方麦克风录音，识别后填入上方'}
                    </p>
                    {voice.error ? <p className="text-[11px] text-[var(--color-danger)]">{voice.error}</p> : null}
                    <Button
                      onClick={handleVoiceButton}
                      disabled={isLoading || isTranscribing}
                      className={voice.isRecording ? 'bg-[var(--color-danger)] shadow-[0_14px_28px_-18px_rgba(239,68,68,0.55)]' : ''}
                      size="icon"
                    >
                      {voice.isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : null}
              </div>
            </section>

            {/* 参考答案：左侧蓝条（参考图样式；不提前展示要点全文，与改造前一致） */}
            {/* <section className="rounded-2xl bg-white shadow-sm border border-gray-100/90 px-4 py-4">
              <div className="flex items-center gap-2 border-l-[3px] border-sky-500 pl-3 -ml-0.5">
                <h2 className="text-sm font-semibold text-gray-900">参考答案</h2>
              </div>
              <p className="mt-3 text-xs font-medium text-gray-500">答案解析</p>
              <div className="mt-2 text-sm leading-relaxed text-gray-600">
                {currentStandardAnswer
                  ? '请根据题干组织语言作答。要点对照与得分请在提交全部题目后的「培训总结」中查看。'
                  : '请结合题干作答；提交后可在「培训总结」中查看得分与反馈。'}
              </div>
            </section> */}
          </>
        )}

        {submitError ? (
          <p className="rounded-[var(--radius-lg)] border border-[rgba(239,68,68,0.16)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">{submitError}</p>
        ) : null}
      </div>

      {/* 底部固定主按钮（参考图亮蓝大按钮） */}
      <div className="fixed bottom-0 left-0 right-0 z-30 shrink-0 border-t border-[var(--color-border-soft)] bg-white/86 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="mx-auto max-w-2xl">
          <Button
            onClick={handlePrimaryClick}
            disabled={isFinished ? false : !canSubmitPrimary}
            size="lg"
            className="w-full"
          >
            {primaryButtonLabel}
          </Button>
        </div>
      </div>

      {/* 总结弹窗（沿用原有评价展示） */}
      {showSummary && (
        <>
          <div className="fixed inset-0 z-40 bg-[rgba(15,23,42,0.42)]" onClick={closeSummaryAndBackToTraining} />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-[28px] border border-white/70 bg-white">
            <div className="sticky top-0 flex items-center justify-between rounded-t-[28px] border-b border-[var(--color-border-soft)] bg-white/96 px-4 py-4 backdrop-blur-xl">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">培训总结</h3>
              <Button type="button" variant="ghost" size="icon" onClick={closeSummaryAndBackToTraining}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-5">
              <div className="mb-5 rounded-[24px] bg-[linear-gradient(135deg,rgba(238,235,255,0.95),rgba(232,241,255,0.95))] p-5 text-center">
                <p className="mb-2 text-sm text-[var(--color-text-secondary)]">培训总分</p>
                {endedByUser ? (
                  <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
                    按已答 <span className="font-semibold text-[var(--color-text)]">{finalResults.length}</span> 题计分，满分{' '}
                    <span className="font-semibold text-[var(--color-text)]">{totalMax}</span>（每题满分 {RUBRIC_MAX_PER_QUESTION} 分）
                  </p>
                ) : null}
                <div className="mb-1 flex items-end justify-center gap-1">
                  <span className={`text-5xl font-bold ${gradeColor}`}>{totalScore}</span>
                  <span className="pb-1 text-lg text-[var(--color-text-muted)]">/ {totalMax}</span>
                </div>
                <div className={`mt-2 inline-block rounded-full bg-white px-4 py-1 text-sm font-bold ${gradeColor} shadow-[var(--shadow-card)]`}>
                  {grade === '—' ? '暂无得分' : `等级 ${grade} · ${scorePercent}%`}
                </div>
              </div>

              <div className="mb-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                <span className="font-medium text-green-600">9 分</span><span>要点齐全</span>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span className="font-medium text-blue-600">7 分</span><span>基本正确</span>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span className="font-medium text-yellow-600">5 分</span><span>部分正确</span>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span className="font-medium text-red-500">3 分</span><span>偏离要点</span>
              </div>

              <h4 className="mb-3 font-semibold text-[var(--color-text)]">逐题得分</h4>
              <div className="mb-5 space-y-3">
                {finalResults.map((r, i) => (
                  <div key={i} className="rounded-[20px] bg-[var(--color-fill-soft)] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--color-text)]">第 {i + 1} 题</span>
                      <div className="flex items-center gap-1">
                        <span
                          className={`font-bold ${
                            r.score >= 9
                              ? 'text-green-600'
                              : r.score >= 7
                                ? 'text-blue-600'
                                : r.score >= 5
                                  ? 'text-yellow-600'
                                  : r.score >= 3
                                    ? 'text-orange-600'
                                    : 'text-red-600'
                          }`}
                        >
                          {r.score}
                        </span>
                        <span className="text-sm text-[var(--color-text-muted)]">/ {RUBRIC_MAX_PER_QUESTION}</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white">
                      <div
                        className={`h-full rounded-full ${
                          r.score >= 9
                            ? 'bg-green-500'
                            : r.score >= 7
                              ? 'bg-blue-500'
                              : r.score >= 5
                                ? 'bg-yellow-500'
                                : r.score >= 3
                                  ? 'bg-orange-500'
                                  : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, (r.score / RUBRIC_MAX_PER_QUESTION) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                      <p className="font-medium text-[var(--color-text)]">你的回答：{r.userAnswer}</p>
                      {r.standardAnswer ? (
                        <p className="mt-1 text-[var(--color-brand-strong)]">参考要点：{r.standardAnswer.replace(/[*#]/g, '')}</p>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{r.feedback}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Link
                  href="/training"
                  className="inline-flex flex-1 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-fill-soft)] px-4 py-3 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-fill-soft-hover)]"
                >
                  再次培训
                </Link>
                <Link
                  href="/"
                  className="inline-flex flex-1 items-center justify-center rounded-[var(--radius-md)] bg-[linear-gradient(135deg,var(--color-brand-from),var(--color-brand-to))] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-button)] transition hover:brightness-[1.03]"
                >
                  返回首页
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={endConfirmOpen}
        onClose={() => setEndConfirmOpen(false)}
        title="结束练习"
        description="确定结束练习？将按已答题目统计得分并打开评价；当前题目未提交的答案不会保存。"
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setEndConfirmOpen(false)}>
              取消
            </Button>
            <Button className="flex-1" onClick={() => void performEndPractice()}>
              确定
            </Button>
          </>
        }
      />
    </div>
  );
}
