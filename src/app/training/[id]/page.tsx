'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  score?: number;
  maxScore?: number;
  correctAnswer?: string;
  isEval?: boolean;
}

interface ScoreRecord {
  questionIndex: number;
  score: number;
  maxScore: number;
  feedback: string;
}

export default function TrainingSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const searchParams = useSearchParams();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [questionTypeLabel, setQuestionTypeLabel] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  const TOTAL_QUESTIONS = 5;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then(p => setSessionId(p.id));
  }, [params]);

  useEffect(() => {
    const firstQuestion = searchParams.get('firstQuestion') || '';
    const label = searchParams.get('questionTypeLabel') || '基础知识培训';
    setQuestionTypeLabel(label);
    if (firstQuestion) {
      setCurrentQuestion(firstQuestion);
      setMessages([
        {
          id: 'welcome',
          role: 'ai',
          content: `欢迎来到【${label}】培训！共 ${TOTAL_QUESTIONS} 道题，每题满分 10 分。请认真作答，AI 将即时评分。`,
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

    try {
      const res = await fetch(`/api/training/sessions/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          currentQuestion,
          questionIndex,
        }),
      });

      const data = await res.json();

      // 评分反馈消息
      const evalMsg: ChatMessage = {
        id: `eval-${Date.now()}`,
        role: 'ai',
        content: data.feedback,
        score: data.score,
        maxScore: data.maxScore,
        correctAnswer: data.correctAnswer,
        isEval: true,
      };
      setMessages(prev => [...prev, evalMsg]);

      // 记录评分
      setScores(prev => [...prev, {
        questionIndex,
        score: data.score,
        maxScore: data.maxScore,
        feedback: data.feedback,
      }]);

      if (data.isFinished) {
        setIsFinished(true);
        setShowSummary(true);
      } else if (data.nextQuestion) {
        const nextIdx = data.currentQuestionIndex;
        setCurrentQuestion(data.nextQuestion);
        setQuestionIndex(nextIdx);
        const nextMsg: ChatMessage = {
          id: `q-${nextIdx + 1}`,
          role: 'ai',
          content: `**第 ${nextIdx + 1} 题**\n\n${data.nextQuestion}`,
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

  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  const totalMax = scores.reduce((sum, s) => sum + s.maxScore, 0);
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
              {isFinished ? '培训完成' : `第 ${questionIndex + 1} / ${TOTAL_QUESTIONS} 题`}
            </p>
          </div>
        </div>

        {/* 进度条 */}
        <div className="flex items-center gap-3">
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${((isFinished ? TOTAL_QUESTIONS : questionIndex) / TOTAL_QUESTIONS) * 100}%` }}
            />
          </div>
          {scores.length > 0 && (
            <span className="text-xs font-medium text-indigo-600">
              {totalScore}/{totalMax}分
            </span>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.isEval ? (
              // 评分卡片
              <div className="max-w-[85%] w-full">
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                  {/* 分数头部 */}
                  <div className={`px-4 py-3 flex items-center justify-between ${
                    (msg.score ?? 0) >= 8 ? 'bg-green-50' :
                    (msg.score ?? 0) >= 6 ? 'bg-blue-50' : 'bg-orange-50'
                  }`}>
                    <span className="text-sm font-medium text-gray-700">AI 评分</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xl font-bold ${
                        (msg.score ?? 0) >= 8 ? 'text-green-600' :
                        (msg.score ?? 0) >= 6 ? 'text-blue-600' : 'text-orange-600'
                      }`}>
                        {msg.score}
                      </span>
                      <span className="text-gray-400 text-sm">/ {msg.maxScore}</span>
                    </div>
                  </div>
                  {/* 评价内容 */}
                  <div className="px-4 py-3">
                    <p className="text-sm text-gray-700 leading-relaxed">{msg.content}</p>
                    {msg.correctAnswer && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">参考要点：</p>
                        <p className="text-sm text-indigo-700 leading-relaxed">{msg.correctAnswer}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-500 text-white rounded-br-sm'
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
            )}
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
                {scores.map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">第 {i + 1} 题</span>
                      <div className="flex items-center gap-1">
                        <span className={`font-bold ${s.score >= 8 ? 'text-green-600' : s.score >= 6 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {s.score}
                        </span>
                        <span className="text-gray-400 text-sm">/ {s.maxScore}</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full">
                      <div
                        className={`h-full rounded-full ${s.score >= 8 ? 'bg-green-500' : s.score >= 6 ? 'bg-blue-500' : 'bg-orange-500'}`}
                        style={{ width: `${(s.score / s.maxScore) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">{s.feedback}</p>
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
