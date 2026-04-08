import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
            AI 销售话术陪练
          </h1>
          <p className="text-base md:text-xl text-gray-600 max-w-2xl mx-auto">
            让 AI 扮演客户，与销售进行实时对话演练
            <br className="hidden md:block" />
            6维度智能评分，定位薄弱点，快速提升话术能力
          </p>
        </div>

        {/* 功能卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="text-2xl mb-3">🎭</div>
            <h3 className="font-semibold text-base mb-1">AI 客户扮演</h3>
            <p className="text-gray-600 text-sm">
              模拟3种客户类型，还原真实咨询场景
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="text-2xl mb-3">📊</div>
            <h3 className="font-semibold text-base mb-1">6维评分系统</h3>
            <p className="text-gray-600 text-sm">
              开场、挖需求、提信心、举例、给方案、邀约确认
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="text-2xl mb-3">💡</div>
            <h3 className="font-semibold text-base mb-1">改进建议</h3>
            <p className="text-gray-600 text-sm">
              实时反馈优缺点，针对性改进
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/practice/new"
            className="inline-block w-full md:w-auto px-8 py-4 bg-blue-600 text-white text-base md:text-lg font-semibold rounded-xl active:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          >
            开始演练
          </Link>
        </div>

        {/* 技术栈 */}
        <div className="mt-12 text-center text-gray-500 text-xs">
          <p>技术栈：Next.js + Tailwind CSS + MiniMax 大模型</p>
        </div>
      </div>

      {/* 移动端底部导航 */}
      <div className="mobile-nav">
        <div className="flex justify-around py-3">
          <Link href="/" className="flex flex-col items-center gap-1 text-blue-600">
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
