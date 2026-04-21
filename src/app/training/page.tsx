'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type QuestionType = 'sales_faq' | 'product_basics';

const QUESTION_TYPES: {
  value: QuestionType;
  emoji: string;
  label: string;
  desc: string;
  topics: string[];
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
  {
    value: 'sales_faq',
    emoji: '💬',
    label: '销售常见问题',
    desc: '测试你对常见销售场景的处理能力',
    topics: ['陌生客户开场话术', '价格异议应对', '家长犹豫处理', '竞品对比应对', '邀约到店技巧'],
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
  },
  {
    value: 'product_basics',
    emoji: '📚',
    label: '产品基础知识',
    desc: '测试你对机构产品和课程体系的掌握',
    topics: ['课程体系介绍', '机构核心优势', '分层教学方案', '教学模式讲解', '收费与政策说明'],
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
  },
];

export default function TrainingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<QuestionType | null>(null);
  const [isStarting, setIsStarting] = useState(false);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-8 px-4 pb-28">
      <div className="max-w-xl mx-auto">
        {/* 顶部导航 */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/60 text-gray-500 hover:text-gray-700 transition-colors">
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">基础知识闯关练</h1>
            <p className="text-gray-500 text-sm">AI 考官出题，即时评分反馈</p>
          </div>
        </div>

        {/* 说明卡片 */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6 flex items-start gap-4">
          <div className="text-3xl">🎓</div>
          <div>
            <h2 className="font-semibold text-gray-800 mb-1">闯关练规则</h2>
            <ul className="text-sm text-gray-600 space-y-1.5">
              <li>• 题库题目<span className="font-medium text-indigo-600">随机顺序</span>逐题出完，答完为止</li>
              <li>• 每道题满分 <span className="font-medium text-indigo-600">10 分</span>，完成所有题目后统一评分</li>
              <li>• 评分基于关键词匹配：
                <span className="font-medium text-green-600"> 9 分</span>（要点齐全）·
                <span className="font-medium text-blue-600"> 7 分</span>（基本正确）·
                <span className="font-medium text-yellow-600"> 5 分</span>（部分正确）·
                <span className="font-medium text-red-500"> 3 分</span>（偏离要点）
              </li>
              <li>• 结束后展示总分、等级（A–E）及每题参考答案</li>
            </ul>
          </div>
        </div>

        {/* 题型选择 */}
        <h2 className="text-base font-semibold text-gray-700 mb-3">请选择培训题型</h2>
        <div className="space-y-4 mb-8">
          {QUESTION_TYPES.map(type => (
            <div
              key={type.value}
              onClick={() => setSelected(type.value)}
              className={`bg-white rounded-2xl p-5 border-2 cursor-pointer transition-all ${
                selected === type.value
                  ? `${type.borderColor} shadow-md`
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${type.bgColor} shrink-0`}>
                  {type.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-semibold text-base ${selected === type.value ? type.color : 'text-gray-800'}`}>
                      {type.label}
                    </h3>
                    {selected === type.value && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.bgColor} ${type.color}`}>
                        已选择
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm mb-3">{type.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {type.topics.map((topic, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          selected === type.value ? `${type.bgColor} ${type.color}` : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 开始按钮 */}
        <button
          onClick={handleStart}
          disabled={!selected || isStarting}
          className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all ${
            !selected
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-200'
          }`}
        >
          {isStarting ? '正在启动...' : selected ? `开始${QUESTION_TYPES.find(t => t.value === selected)?.label}培训` : '请先选择题型'}
        </button>
      </div>

      {/* 底部导航 */}
      <div className="mobile-nav">
        <div className="flex justify-around py-3">
          <Link href="/" className="flex flex-col items-center gap-1 text-gray-500">
            <span className="text-xl">🏠</span>
            <span className="text-xs">首页</span>
          </Link>
          <Link href="/training" className="flex flex-col items-center gap-1 text-indigo-600">
            <span className="text-xl">📖</span>
            <span className="text-xs">培训</span>
          </Link>
          <Link href="/practice/new" className="flex flex-col items-center gap-1 text-gray-500">
            <span className="text-xl">🎯</span>
            <span className="text-xs">演练</span>
          </Link>
          <Link href="/history" className="flex flex-col items-center gap-1 text-gray-500">
            <span className="text-xl">📝</span>
            <span className="text-xs">历史</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
