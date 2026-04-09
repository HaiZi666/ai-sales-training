'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">报告不存在</div>
      </div>
    );
  }

  const percentage = Math.round((report.totalScore / 100) * 100);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 pb-28">
      <div className="max-w-2xl mx-auto">
        {/* 返回按钮 */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm hover:shadow-md active:bg-gray-100"
          >
            <span className="text-gray-600">←</span>
          </Link>
          <span className="text-gray-500 text-sm">返回首页</span>
        </div>
        {/* 头部 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">演练报告</h1>
          <p className="text-gray-500">完整分析 · 针对性提升</p>
        </div>

        {/* 总分卡片 */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-blue-50 mb-4">
            <div>
              <div className="text-4xl font-bold text-blue-600">{report.totalScore}</div>
              <div className="text-sm text-gray-500">/100分</div>
            </div>
          </div>
          <div className={`text-2xl font-bold mb-2 ${
            report.grade.startsWith('A') ? 'text-green-600' :
            report.grade.startsWith('B') ? 'text-blue-600' :
            report.grade.startsWith('C') ? 'text-yellow-600' : 'text-red-600'
          }`}>
            等级：{report.grade}
          </div>
          <div className="text-gray-500">{percentage}%得分率</div>
        </div>

        {/* 亮点与不足 */}
        {report.highlight && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-green-600 text-xl">✨</span>
              <div>
                <div className="font-medium text-green-800 mb-1">亮点</div>
                <div className="text-green-700">{report.highlight}</div>
              </div>
            </div>
          </div>
        )}

        {report.weakness && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-orange-600 text-xl">📍</span>
              <div>
                <div className="font-medium text-orange-800 mb-1">薄弱点</div>
                <div className="text-orange-700">{report.weakness}</div>
              </div>
            </div>
          </div>
        )}

        {/* 各维度详情 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">各维度得分</h2>
          <div className="space-y-4">
            {report.dimensions.map(dim => {
              const pct = Math.round((dim.score / dim.max) * 100);
              return (
                <div key={dim.name}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{dim.name}</span>
                    <span className="text-gray-500">
                      {dim.score} <span className="text-gray-400">/ {dim.max}分</span>
                    </span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        pct >= 80 ? 'bg-green-500' :
                        pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500">{dim.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 改进建议 */}
        {report.improvements.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">改进建议</h2>
            <ul className="space-y-2">
              {report.improvements.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/practice/new')}
            className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-semibold active:bg-blue-700"
          >
            再来一次
          </button>
          <button
            onClick={() => router.push('/history')}
            className="flex-1 py-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold active:bg-gray-50"
          >
            查看历史
          </button>
        </div>
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
            <span className="text-xs">新建</span>
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
