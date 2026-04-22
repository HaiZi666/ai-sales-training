'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';

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

  const handleVoiceButton = useCallback(async () => {
    if (voice.isRecording) {
      setIsTranscribing(true);
      const blob = await voice.stopRecording();
      if (blob) {
        try {
          const form = new FormData();
          form.append('audio', blob, 'recording');
          const res = await fetch('/api/speech-to-text', { method: 'POST', body: form });
          if (res.ok) {
            const { text } = await res.json();
            if (text?.trim()) {
              setInputText(text);
            }
          }
        } catch {
          /* 转写失败时保留手动输入 */
        }
      }
      setIsTranscribing(false);
    } else {
      await voice.startRecording();
    }
  }, [voice]);

  const evaluateAnswer = (userAnswer: string, standardAnswer: string): { score: number; feedback: string } => {
    if (!userAnswer.trim()) {
      return { score: 0, feedback: '未作答' };
    }
    if (!standardAnswer.trim()) {
      return { score: 7, feedback: '已作答' };
    }

    const cleanAnswer = standardAnswer.replace(/[*#]/g, '').toLowerCase();
    const cleanUser = userAnswer.replace(/[*#]/g, '').toLowerCase();

    const keyPhrases = cleanAnswer
      .split(/[,，。.、\n]/)
      .map(p => p.trim())
      .filter(p => p.length > 2);

    const matchedPhrases = keyPhrases.filter(p => cleanUser.includes(p));
    const matchRate = keyPhrases.length > 0 ? matchedPhrases.length / keyPhrases.length : 0;

    let score: number;
    let feedback: string;

    if (matchRate >= 0.6) {
      score = 9;
      feedback = '回答准确，要点齐全';
    } else if (matchRate >= 0.4) {
      score = 7;
      feedback = '回答基本正确，但有遗漏';
    } else if (matchRate >= 0.2) {
      score = 5;
      feedback = '回答部分正确，核心要点不完整';
    } else {
      score = 3;
      feedback = '回答偏离要点';
    }

    return { score, feedback };
  };

  const finalResults = questionResults.map(r => ({
    ...r,
    ...evaluateAnswer(r.userAnswer, r.standardAnswer),
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
    <div className="flex flex-col h-screen bg-[#f2f3f5]">
      {/* 顶栏：返回 + 标题 + 更多 */}
      <header className="shrink-0 bg-white px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          <Link
            href="/training"
            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 active:bg-gray-200 text-xl"
            aria-label="返回"
          >
            ←
          </Link>
          <h1 className="flex-1 text-center text-[15px] font-semibold text-gray-900 truncate px-2">
            {questionTypeLabel}
          </h1>
          <button
            type="button"
            onClick={openEndConfirm}
            disabled={!canEndPractice}
            className="shrink-0 min-h-9 px-3 py-1.5 text-[13px] font-semibold rounded-lg border border-sky-500 bg-sky-500 text-white shadow-sm hover:bg-sky-600 hover:border-sky-600 active:scale-[0.98] transition-all disabled:border-gray-300 disabled:bg-gray-300 disabled:text-gray-600 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:bg-gray-300 disabled:hover:border-gray-300 disabled:active:scale-100"
          >
            结束
          </button>
        </div>

        {/* 绿色进度条 + 旗标 + 共 N 题 */}
        <div className="max-w-lg mx-auto mt-3 flex items-center gap-3">
          <div className="flex-1 min-w-0 relative h-2 rounded-full bg-gray-200/90">
            <div
              className="absolute left-0 top-0 h-2 rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
              style={{ width: `${progressPercent}%`, minWidth: progressPercent > 0 ? '4px' : undefined }}
            />
            {progressPercent > 0 ? (
              <div
                className="absolute z-[1] top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
                style={{ left: `clamp(8px, ${progressPercent}%, calc(100% - 8px))` }}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-emerald-500 text-white shadow-sm shadow-emerald-500/40">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" className="w-3 h-3" fill="currentColor">
                    <path d="M4 2v16l6-4 6 4V2H4z" />
                  </svg>
                </span>
              </div>
            ) : null}
          </div>
          <p className="shrink-0 text-xs text-gray-600 tabular-nums">
            共 <span className="font-bold text-emerald-600">{isFinished ? totalQuestions || answeredCount : totalQuestions || '—'}</span> 题
          </p>
        </div>
        <p className="max-w-lg mx-auto mt-1.5 text-[11px] text-gray-400 text-center">
          {isFinished ? (
            endedByUser && answeredCount < totalQuestions ? (
              <>
                已提前结束 · 已答 <span className="font-bold text-emerald-600">{answeredCount}</span> / {totalQuestions} 题 · 进度{' '}
                <span className="font-bold text-emerald-600">{progressPercent}%</span>
              </>
            ) : (
              <>
                已完成 · <span className="font-bold text-emerald-600">100%</span>
              </>
            )
          ) : (
            <>
              进度 <span className="font-bold text-emerald-600">{progressPercent}%</span>
              {totalQuestions > 0 ? ` · 第 ${askedCount} / ${totalQuestions} 题` : ''}
            </>
          )}
        </p>
      </header>

      {/* 可滚动：题干 + 作答区 + 参考答案 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 pb-32 max-w-lg mx-auto w-full space-y-4">
        {isFinished ? (
          <div className="rounded-2xl bg-white border border-emerald-100 shadow-sm px-4 py-6 text-center">
            <p className="font-semibold text-gray-900 text-base mb-1">全部题目已完成</p>
            <p className="text-sm text-gray-500">点击下方蓝色按钮「去评价」查看培训总结与逐题得分</p>
          </div>
        ) : (
          <>
            <section className="rounded-2xl bg-white shadow-sm border border-gray-100/90 overflow-hidden">
              <div className="px-4 pt-4 pb-3">
                <span className="inline-block rounded-md bg-violet-500 px-2.5 py-1 text-xs font-medium text-white shadow-sm shadow-violet-500/25">
                  {questionTypeLabel}
                </span>
                <p className="mt-3 text-xs text-gray-400">
                  第 {askedCount} 题{totalQuestions > 0 ? ` / 共 ${totalQuestions} 题` : ''}
                </p>
                <div className="mt-2 text-[16px] leading-relaxed text-gray-900 font-normal whitespace-pre-wrap">
                  {currentQuestion || '暂无题目'}
                </div>
              </div>

              {/* 作答区：灰底块 + 标题行（参考图「第①问」样式） */}
              <div className="mx-3 mb-4 rounded-xl bg-gray-100/90 border border-gray-200/60 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200/50 bg-gray-100">
                  <span className="text-sm font-medium text-gray-800">你的作答</span>
                  <div className="flex items-center gap-1 rounded-md border border-gray-200/80 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setInputMode('text')}
                      className={`px-2 py-0.5 text-[11px] rounded ${inputMode === 'text' ? 'bg-gray-100 text-violet-700 font-medium' : 'text-gray-500'}`}
                    >
                      文字
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('voice')}
                      className={`px-2 py-0.5 text-[11px] rounded ${inputMode === 'voice' ? 'bg-gray-100 text-violet-700 font-medium' : 'text-gray-500'}`}
                    >
                      语音
                    </button>
                  </div>
                </div>
                {openingMessage ? (
                  <p className="px-3 py-2.5 text-[13px] text-gray-600 leading-relaxed bg-white/40 border-b border-gray-200/40">
                    {openingMessage}
                  </p>
                ) : null}
                <textarea
                  id="training-answer"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="请在此输入答案…"
                  disabled={isLoading}
                  rows={5}
                  className="w-full px-3 py-3 text-[15px] leading-relaxed text-gray-800 bg-transparent border-0 focus:outline-none focus:ring-0 resize-y min-h-[120px] placeholder:text-gray-400"
                />
                {inputMode === 'voice' ? (
                  <div className="px-3 pb-3 flex flex-col items-center gap-2 border-t border-gray-200/50 bg-white/50">
                    <p className="text-[11px] text-gray-500 text-center pt-2">
                      {voice.isRecording
                        ? `录音中 ${voice.duration}s · 再点停止并识别`
                        : isTranscribing
                        ? '识别中…'
                        : '点下方麦克风，识别后填入上方'}
                    </p>
                    {voice.error ? <p className="text-[11px] text-red-500">{voice.error}</p> : null}
                    <button
                      type="button"
                      onClick={handleVoiceButton}
                      disabled={isLoading || isTranscribing}
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md disabled:opacity-40 ${
                        voice.isRecording ? 'bg-red-500 animate-pulse' : 'bg-violet-600'
                      }`}
                    >
                      {voice.isRecording ? '■' : '🎤'}
                    </button>
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
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 border border-red-100">{submitError}</p>
        ) : null}
      </div>

      {/* 底部固定主按钮（参考图亮蓝大按钮） */}
      <div className="shrink-0 fixed bottom-0 left-0 right-0 z-30 bg-[#f2f3f5]/95 backdrop-blur-sm border-t border-gray-200/60 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={handlePrimaryClick}
            disabled={isFinished ? false : !canSubmitPrimary}
            className="w-full py-3.5 rounded-2xl bg-sky-500 text-white text-[16px] font-semibold shadow-lg shadow-sky-500/25 hover:bg-sky-600 active:scale-[0.99] transition-all disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && !isFinished ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : null}
            {primaryButtonLabel}
          </button>
        </div>
      </div>

      {/* 总结弹窗（沿用原有评价展示） */}
      {showSummary && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={closeSummaryAndBackToTraining} />
          <div className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl z-50 max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-4 py-4 border-b flex items-center justify-between rounded-t-3xl">
              <h3 className="font-bold text-lg">培训总结</h3>
              <button type="button" onClick={closeSummaryAndBackToTraining} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                ✕
              </button>
            </div>

            <div className="p-5">
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5 mb-5 text-center">
                <p className="text-gray-500 text-sm mb-2">培训总分</p>
                {endedByUser ? (
                  <p className="text-xs text-gray-500 mb-2">
                    按已答 <span className="font-semibold text-gray-700">{finalResults.length}</span> 题计分，满分{' '}
                    <span className="font-semibold text-gray-700">{totalMax}</span>（每题满分 {RUBRIC_MAX_PER_QUESTION} 分）
                  </p>
                ) : null}
                <div className="flex items-end justify-center gap-1 mb-1">
                  <span className={`text-5xl font-bold ${gradeColor}`}>{totalScore}</span>
                  <span className="text-gray-400 text-lg pb-1">/ {totalMax}</span>
                </div>
                <div className={`inline-block px-4 py-1 rounded-full text-sm font-bold ${gradeColor} bg-white shadow-sm mt-2`}>
                  {grade === '—' ? '暂无得分' : `等级 ${grade} · ${scorePercent}%`}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mb-5">
                <span className="font-medium text-green-600">9 分</span><span>要点齐全</span>
                <span className="text-gray-300">·</span>
                <span className="font-medium text-blue-600">7 分</span><span>基本正确</span>
                <span className="text-gray-300">·</span>
                <span className="font-medium text-yellow-600">5 分</span><span>部分正确</span>
                <span className="text-gray-300">·</span>
                <span className="font-medium text-red-500">3 分</span><span>偏离要点</span>
              </div>

              <h4 className="font-semibold text-gray-700 mb-3">逐题得分</h4>
              <div className="space-y-3 mb-5">
                {finalResults.map((r, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">第 {i + 1} 题</span>
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
                        <span className="text-gray-400 text-sm">/ {RUBRIC_MAX_PER_QUESTION}</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full">
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
                    <div className="mt-2 text-xs text-gray-600">
                      <p className="font-medium">你的回答：{r.userAnswer}</p>
                      {r.standardAnswer ? (
                        <p className="mt-1 text-indigo-600">参考要点：{r.standardAnswer.replace(/[*#]/g, '')}</p>
                      ) : null}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{r.feedback}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Link
                  href="/training"
                  className="flex-1 py-3 border-2 border-indigo-600 text-indigo-600 rounded-xl font-semibold text-center text-sm hover:bg-indigo-50 transition-colors"
                >
                  再次培训
                </Link>
                <Link
                  href="/"
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-center text-sm hover:bg-indigo-700 transition-colors"
                >
                  返回首页
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 结束练习确认（Ant Design Modal 风格：遮罩 + 居中卡片 + 底部按钮区） */}
      {endConfirmOpen ? (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/45"
            aria-hidden
            onClick={() => setEndConfirmOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-practice-modal-title"
            className="relative z-[1] w-full max-w-[416px] overflow-hidden rounded-[8px] bg-white text-left shadow-[0_6px_16px_0_rgba(0,0,0,0.08),0_3px_6px_-4px_rgba(0,0,0,0.12),0_9px_28px_8px_rgba(0,0,0,0.05)]"
          >
            <div className="px-6 pt-5 pb-4">
              <h2 id="end-practice-modal-title" className="text-[16px] font-semibold leading-6 text-[rgba(0,0,0,0.88)]">
                结束练习
              </h2>
              <p className="mt-3 text-sm leading-[1.5715] text-[rgba(0,0,0,0.65)]">
                确定结束练习？将按已答题目统计得分并打开评价；当前题目未提交的答案不会保存。
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#f0f0f0] px-6 py-4">
              <button
                type="button"
                onClick={() => setEndConfirmOpen(false)}
                className="h-8 min-w-[64px] rounded-md border border-[#d9d9d9] bg-white px-[15px] text-sm text-[rgba(0,0,0,0.88)] shadow-[0_2px_0_rgba(0,0,0,0.02)] hover:border-[#4096ff] hover:text-[#4096ff]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void performEndPractice()}
                className="h-8 min-w-[64px] rounded-md border border-[#1677ff] bg-[#1677ff] px-[15px] text-sm font-normal text-white shadow-[0_2px_0_rgba(5,145,255,0.1)] hover:border-[#4096ff] hover:bg-[#4096ff]"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
