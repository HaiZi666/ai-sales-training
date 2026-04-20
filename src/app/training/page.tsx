'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type TrainingCategory = 'sales' | 'product';

interface Question {
  id: string;
  question: string;
  scenario: string;
  node: string;
  standardAnswer?: string;
  iceBreakerScript?: string;
}

interface QaHistoryItem {
  id: string;
  question: string;
  answer: string;
  standardAnswer: string;
  iceBreakerScript: string;
  scenario: string;
  node: string;
}

interface EvaluationResult {
  totalQuestions: number;
  completedQuestions: number;
  excellentCount: number;
  goodCount: number;
  partialCount: number;
  wrongCount: number;
  unansweredCount: number;
  goodParts: string[];
  weakParts: string[];
  suggestions: string[];
  overallComment: string;
}

export default function TrainingPage() {
  const [category, setCategory] = useState<TrainingCategory | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [askedCount, setAskedCount] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [qaHistory, setQaHistory] = useState<QaHistoryItem[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);

  // Start a new training session
  const startSession = async (selectedCategory: TrainingCategory) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory }),
      });

      if (!res.ok) throw new Error('Failed to start session');

      const data = await res.json();
      setCategory(selectedCategory);
      setSessionId(data.sessionId);
      setTotalQuestions(data.totalQuestions);
      setAskedCount(0);
      setIsSessionActive(true);
      setIsCompleted(false);
      setQaHistory([]);
      setEvaluation(null);

      // Fetch first question
      await fetchQuestion(data.sessionId);
    } catch (error) {
      console.error('Error starting session:', error);
      alert('启动训练失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch current question
  const fetchQuestion = async (sid: string) => {
    try {
      const res = await fetch(`/api/training/${sid}`);
      if (!res.ok) throw new Error('Failed to fetch question');

      const data = await res.json();
      setCurrentQuestion(data.nextQuestion);
      setAskedCount(data.askedCount);
      setIsCompleted(data.status === 'completed');

      if (data.status === 'completed' && data.qaHistory) {
        setQaHistory(data.qaHistory);
        // Auto evaluate when completed
        evaluatePerformance(data.qaHistory);
      }
    } catch (error) {
      console.error('Error fetching question:', error);
    }
  };

  // Submit answer
  const submitAnswer = async () => {
    if (!sessionId || !currentQuestion || !userAnswer.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/training/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer: userAnswer.trim(),
        }),
      });

      if (!res.ok) throw new Error('Failed to submit answer');

      const data = await res.json();
      setUserAnswer('');
      setAskedCount(data.askedCount);
      setIsCompleted(data.status === 'completed');

      if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
      } else {
        // All questions answered, fetch final results
        await fetch(`/api/training/${sessionId}`)
          .then(r => r.json())
          .then(result => {
            if (result.qaHistory) {
              setQaHistory(result.qaHistory);
              evaluatePerformance(result.qaHistory);
            }
          });
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('提交答案失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // Evaluate user performance
  const evaluatePerformance = (history: QaHistoryItem[]) => {
    const evaluation: EvaluationResult = {
      totalQuestions: history.length,
      completedQuestions: history.filter(h => h.answer.trim().length > 0).length,
      excellentCount: 0,
      goodCount: 0,
      partialCount: 0,
      wrongCount: 0,
      unansweredCount: 0,
      goodParts: [],
      weakParts: [],
      suggestions: [],
      overallComment: '',
    };

    history.forEach(item => {
      if (!item.answer.trim()) {
        evaluation.unansweredCount++;
        return;
      }

      // Simple evaluation based on keyword matching
      const standardAnswer = item.standardAnswer || item.iceBreakerScript || '';
      const standardKeywords = standardAnswer
        .replace(/[*#]/g, '')
        .split(/[,，。.、]/)
        .map(k => k.trim())
        .filter(k => k.length > 2);

      const userAnswer = item.answer.replace(/[*#]/g, '');
      const matchedKeywords = standardKeywords.filter(
        k => userAnswer.includes(k) && k.length > 2
      );

      const matchRate = standardKeywords.length > 0
        ? matchedKeywords.length / standardKeywords.length
        : 0;

      // Also check if answer mentions key concepts
      const hasContextualMatch =
        userAnswer.includes(item.scenario) ||
        userAnswer.includes(item.node) ||
        standardAnswer.length === 0;

      if (matchRate >= 0.6 || hasContextualMatch) {
        evaluation.excellentCount++;
        evaluation.goodParts.push(`第${history.indexOf(item) + 1}题回答良好`);
      } else if (matchRate >= 0.3) {
        evaluation.goodCount++;
        evaluation.goodParts.push(`第${history.indexOf(item) + 1}题基本正确`);
      } else if (matchRate > 0 || hasContextualMatch) {
        evaluation.partialCount++;
        evaluation.weakParts.push(`第${history.indexOf(item) + 1}题回答不完整`);
      } else {
        evaluation.wrongCount++;
        evaluation.weakParts.push(`第${history.indexOf(item) + 1}题偏离要点`);
      }
    });

    // Generate suggestions
    if (evaluation.weakParts.length > 0) {
      evaluation.suggestions.push('建议加强对题库标准答案的理解和记忆');
    }
    if (evaluation.unansweredCount > 0) {
      evaluation.suggestions.push('注意不要漏答题');
    }
    if (evaluation.partialCount > evaluation.excellentCount) {
      evaluation.suggestions.push('回答时可以更具体一些，尽量覆盖更多要点');
    }
    if (evaluation.goodParts.length === evaluation.totalQuestions) {
      evaluation.suggestions.push('表现优秀！继续保持');
    }

    // Overall comment
    const score = (evaluation.excellentCount * 100 + evaluation.goodCount * 70 + evaluation.partialCount * 40) / evaluation.totalQuestions;
    if (score >= 85) {
      evaluation.overallComment = '优秀';
    } else if (score >= 70) {
      evaluation.overallComment = '良好';
    } else if (score >= 50) {
      evaluation.overallComment = '及格';
    } else {
      evaluation.overallComment = '需要继续努力';
    }

    setEvaluation(evaluation);
  };

  // Reset to category selection
  const resetSession = () => {
    setCategory(null);
    setSessionId(null);
    setCurrentQuestion(null);
    setUserAnswer('');
    setIsSessionActive(false);
    setIsCompleted(false);
    setQaHistory([]);
    setEvaluation(null);
  };

  // Category selection view
  if (!isSessionActive) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 pb-28">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/" className="text-gray-500 hover:text-gray-700">
              ← 返回
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">基础知识培训</h1>
          <p className="text-gray-600 mb-8">选择培训板块，开始随机问答训练</p>

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => startSession('sales')}
              disabled={isLoading}
              className="bg-white rounded-xl shadow-sm p-6 text-left hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-500"
            >
              <div className="flex items-center gap-4">
                <div className="text-3xl">📋</div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">销售常见问题</h2>
                  <p className="text-gray-500 mt-1">
                    涵盖销售过程中客户常问的问题及标准话术
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => startSession('product')}
              disabled={isLoading}
              className="bg-white rounded-xl shadow-sm p-6 text-left hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-500"
            >
              <div className="flex items-center gap-4">
                <div className="text-3xl">📦</div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">产品基础知识</h2>
                  <p className="text-gray-500 mt-1">
                    涵盖产品功能、特点、使用方法等基础知识
                  </p>
                </div>
              </div>
            </button>
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
                <span className="text-xs">演练</span>
              </Link>
              <Link href="/training" className="flex flex-col items-center gap-1 text-blue-600">
                <span className="text-xl">📝</span>
                <span className="text-xs">培训</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Question answering view
  if (!isCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 pb-28">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={resetSession}
              className="text-gray-500 hover:text-gray-700"
            >
              ← 退出训练
            </button>
            <div className="text-sm text-gray-500">
              {askedCount} / {totalQuestions}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(askedCount / totalQuestions) * 100}%` }}
            />
          </div>

          {/* Question card */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="text-sm text-blue-600 mb-2">
              {currentQuestion?.scenario} · {currentQuestion?.node}
            </div>
            <h2 className="text-xl font-medium text-gray-900">
              {currentQuestion?.question || '加载中...'}
            </h2>
          </div>

          {/* Answer input */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              请输入你的回答：
            </label>
            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="请作为销售员回答上述问题..."
              className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
            <button
              onClick={submitAnswer}
              disabled={!userAnswer.trim() || isLoading}
              className={`w-full mt-4 py-3 rounded-lg font-medium text-lg transition-all ${
                !userAnswer.trim() || isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isLoading ? '提交中...' : '提交回答'}
            </button>
          </div>

          <div className="text-center text-gray-500 text-sm">
            <p>回答完成后点击"提交回答"继续下一题</p>
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
                <span className="text-xs">演练</span>
              </Link>
              <Link href="/training" className="flex flex-col items-center gap-1 text-blue-600">
                <span className="text-xl">📝</span>
                <span className="text-xs">培训</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Evaluation view
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 pb-28">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={resetSession}
            className="text-gray-500 hover:text-gray-700"
          >
            ← 继续练习
          </button>
          <div className="text-sm text-green-600 font-medium">
            已完成
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">训练完成</h1>
        <p className="text-gray-600 mb-8">
          感谢完成本次训练，以下是你的表现评价
        </p>

        {evaluation && (
          <>
            {/* Score overview */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="text-center mb-6">
                <div className="text-5xl font-bold text-blue-600">
                  {evaluation.overallComment}
                </div>
                <div className="text-gray-500 mt-2">
                  总题数：{evaluation.totalQuestions} | 已完成：{evaluation.completedQuestions}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {evaluation.excellentCount}
                  </div>
                  <div className="text-xs text-green-600">优秀</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {evaluation.goodCount}
                  </div>
                  <div className="text-xs text-blue-600">良好</div>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {evaluation.partialCount + evaluation.wrongCount + evaluation.unansweredCount}
                  </div>
                  <div className="text-xs text-yellow-600">需改进</div>
                </div>
              </div>
            </div>

            {/* Good parts */}
            {evaluation.goodParts.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  ✅ 回答较好的部分
                </h3>
                <ul className="space-y-2">
                  {evaluation.goodParts.map((part, i) => (
                    <li key={i} className="text-gray-700 flex items-start gap-2">
                      <span className="text-green-500 mt-1">✓</span>
                      {part}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Weak parts */}
            {evaluation.weakParts.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  ⚠️ 需要改进的部分
                </h3>
                <ul className="space-y-2">
                  {evaluation.weakParts.map((part, i) => (
                    <li key={i} className="text-gray-700 flex items-start gap-2">
                      <span className="text-yellow-500 mt-1">!</span>
                      {part}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggestions */}
            {evaluation.suggestions.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  💡 改进建议
                </h3>
                <ul className="space-y-2">
                  {evaluation.suggestions.map((suggestion, i) => (
                    <li key={i} className="text-gray-700 flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Q&A history */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📝 问答详情
              </h3>
              <div className="space-y-4">
                {qaHistory.map((item, index) => (
                  <div key={item.id} className="border-b border-gray-100 pb-4 last:border-0">
                    <div className="text-sm text-blue-600 mb-1">
                      {index + 1}. [{item.scenario}] {item.node}
                    </div>
                    <div className="text-gray-900 font-medium mb-2">
                      Q: {item.question}
                    </div>
                    <div className="text-gray-700 text-sm mb-2">
                      <span className="text-gray-500">你的回答：</span>
                      {item.answer || '(未作答)'}
                    </div>
                    {item.standardAnswer && (
                      <div className="text-gray-600 text-sm bg-gray-50 p-2 rounded">
                        <span className="text-gray-500">参考回答：</span>
                        {item.standardAnswer.replace(/[*#]/g, '')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <button
          onClick={resetSession}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-medium text-lg hover:bg-blue-700 transition-colors"
        >
          再练一次
        </button>

        {/* 移动端底部导航 */}
        <div className="mobile-nav">
          <div className="flex justify-around py-3">
            <Link href="/" className="flex flex-col items-center gap-1 text-gray-500">
              <span className="text-xl">🏠</span>
              <span className="text-xs">首页</span>
            </Link>
            <Link href="/practice/new" className="flex flex-col items-center gap-1 text-gray-500">
              <span className="text-xl">🎯</span>
              <span className="text-xs">演练</span>
            </Link>
            <Link href="/training" className="flex flex-col items-center gap-1 text-blue-600">
              <span className="text-xl">📝</span>
              <span className="text-xs">培训</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
