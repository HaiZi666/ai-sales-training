'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  isEval?: boolean;
  isOpening?: boolean;
}

interface QuestionResult {
  question: string;
  standardAnswer: string;
  userAnswer: string;
}

export default function TrainingSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const searchParams = useSearchParams();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentQuestionId, setCurrentQuestionId] = useState('');
  const [currentStandardAnswer, setCurrentStandardAnswer] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [askedCount, setAskedCount] = useState(0);
  const [questionTypeLabel, setQuestionTypeLabel] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then(p => setSessionId(p.id));
  }, [params]);

  useEffect(() => {
    const firstQuestion = searchParams.get('firstQuestion') || '';
    const firstQuestionId = searchParams.get('firstQuestionId') || '';
    const label = searchParams.get('questionTypeLabel') || '基础知识闯关练';
    const total = parseInt(searchParams.get('totalQuestions') || '0', 10);
    const opening = searchParams.get('openingMessage') || '';

    setQuestionTypeLabel(label);
    setCurrentQuestion(firstQuestion);
    setCurrentQuestionId(firstQuestionId);
    setTotalQuestions(total);
    setAskedCount(1);

    if (firstQuestion) {
      setMessages([
        {
          id: 'opening',
          role: 'ai',
          content: opening,
          isOpening: true,
        },
        {
          id: 'q1',
          role: 'ai',
          content: `**第 1 题**\n\n${firstQuestion}`,
        },
      ]);
    }
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isLoading || isFinished || !sessionId) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    // Save question and answer for later evaluation
    const result: QuestionResult = {
      question: currentQuestion,
      standardAnswer: currentStandardAnswer,
      userAnswer: text,
    };
    setQuestionResults(prev => [...prev, result]);

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

      if (data.isFinished) {
        // Training finished - show evaluation
        setIsFinished(true);
        setAskedCount(data.askedCount);
        setShowSummary(true);
      } else if (data.nextQuestion) {
        // Next question：题号 = 已答题数 + 1
        setCurrentQuestion(data.nextQuestion);
        setCurrentQuestionId(data.nextQuestionId);
        setCurrentStandardAnswer(data.currentStandardAnswer || '');
        const nextQuestionNumber = data.askedCount + 1;
        setQuestionIndex(nextQuestionNumber - 1);
        setAskedCount(nextQuestionNumber);
        const nextMsg: ChatMessage = {
          id: `q-${nextQuestionNumber}`,
          role: 'ai',
          content: `**第 ${nextQuestionNumber} 题**\n\n${data.nextQuestion}`,
        };
        setMessages(prev => [...prev, nextMsg]);
      }
    } catch (error) {
      console.error('发送失败:', error);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'ai',
        content: '请求失败，请重试。',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Simple evaluation based on keyword matching
  const evaluateAnswer = (userAnswer: string, standardAnswer: string): { score: number; feedback: string } => {
    if (!userAnswer.trim()) {
      return { score: 0, feedback: '未作答' };
    }
    if (!standardAnswer.trim()) {
      // If no standard answer, give partial credit for any response
      return { score: 7, feedback: '已作答' };
    }

    // Remove special characters and normalize
    const cleanAnswer = standardAnswer.replace(/[*#]/g, '').toLowerCase();
    const cleanUser = userAnswer.replace(/[*#]/g, '').toLowerCase();

    // Extract key phrases (words longer than 2 characters)
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

  // Calculate final results
  const finalResults = questionResults.map(r => ({
    ...r,
    ...evaluateAnswer(r.userAnswer, r.standardAnswer),
  }));

  const totalScore = finalResults.reduce((sum, r) => sum + r.score, 0);
  const totalMax = finalResults.length * 10;
  const scorePercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  const grade =
    scorePercent >= 90 ? 'A' :
    scorePercent >= 80 ? 'B' :
    scorePercent >= 70 ? 'C' :
    scorePercent >= 60 ? 'D' : 'E';

  const gradeColor =
    grade === 'A' ? 'text-green-600' :
    grade === 'B' ? 'text-blue-600' :
    grade === 'C' ? 'text-yellow-600' :
    grade === 'D' ? 'text-orange-600' : 'text-red-600';

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 顶部栏 */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/training" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
            ←
          </Link>
          <div>
            <h2 className="font-semibold text-sm text-gray-800">{questionTypeLabel}</h2>
            <p className="text-xs text-gray-500">
              {isFinished ? '培训完成' : `第 ${askedCount} / ${totalQuestions} 题`}
            </p>
          </div>
        </div>

        {/* 进度条 */}
        <div className="flex items-center gap-3">
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${totalQuestions > 0 ? ((isFinished ? totalQuestions : askedCount - 1) / totalQuestions) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-indigo-500 text-white rounded-br-sm'
                : msg.isOpening
                ? 'bg-indigo-50 text-indigo-700 rounded-bl-sm border border-indigo-200'
                : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
            }`}>
              {msg.content.split('\n').map((line, i) => (
                <span key={i}>
                  {line.startsWith('**') && line.endsWith('**')
                    ? <strong>{line.slice(2, -2)}</strong>
                    : line}
                  {i < msg.content.split('\n').length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 / 结束区 */}
      {isFinished ? (
        <div className="bg-white border-t px-4 py-4 shrink-0">
          <button
            onClick={() => setShowSummary(true)}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-base hover:bg-indigo-700 active:scale-95 transition-all"
          >
            查看培训总结 →
          </button>
        </div>
      ) : (
        <div className="bg-white border-t px-4 py-3 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="输入你的回答..."
              disabled={isLoading || isFinished}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm bg-gray-50"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading || isFinished}
              className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-medium text-sm active:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              提交
            </button>
          </div>
        </div>
      )}

      {/* 总结弹窗 */}
      {showSummary && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowSummary(false)} />
          <div className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl z-50 max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-4 py-4 border-b flex items-center justify-between rounded-t-3xl">
              <h3 className="font-bold text-lg">培训总结</h3>
              <button onClick={() => setShowSummary(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                ✕
              </button>
            </div>

            <div className="p-5">
              {/* 总分展示 */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5 mb-5 text-center">
                <p className="text-gray-500 text-sm mb-2">培训总分</p>
                <div className="flex items-end justify-center gap-1 mb-1">
                  <span className={`text-5xl font-bold ${gradeColor}`}>{totalScore}</span>
                  <span className="text-gray-400 text-lg pb-1">/ {totalMax}</span>
                </div>
                <div className={`inline-block px-4 py-1 rounded-full text-sm font-bold ${gradeColor} bg-white shadow-sm mt-2`}>
                  等级 {grade} · {scorePercent}%
                </div>
              </div>

              {/* 逐题得分 */}
              <h4 className="font-semibold text-gray-700 mb-3">逐题得分</h4>
              <div className="space-y-3 mb-5">
                {finalResults.map((r, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">第 {i + 1} 题</span>
                      <div className="flex items-center gap-1">
                        <span className={`font-bold ${r.score >= 8 ? 'text-green-600' : r.score >= 6 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {r.score}
                        </span>
                        <span className="text-gray-400 text-sm">/ 10</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full">
                      <div
                        className={`h-full rounded-full ${r.score >= 8 ? 'bg-green-500' : r.score >= 6 ? 'bg-blue-500' : 'bg-orange-500'}`}
                        style={{ width: `${(r.score / 10) * 100}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      <p className="font-medium">你的回答：{r.userAnswer}</p>
                      {r.standardAnswer && (
                        <p className="mt-1 text-indigo-600">参考要点：{r.standardAnswer.replace(/[*#]/g, '')}</p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{r.feedback}</p>
                  </div>
                ))}
              </div>

              {/* 操作按钮 */}
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
    </div>
  );
}
