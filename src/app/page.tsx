import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-20">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            AI 销售话术陪练
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            让 AI 扮演客户，与销售进行实时对话演练
            <br />
            6维度智能评分，定位薄弱点，快速提升话术能力
          </p>
        </div>

        {/* 功能卡片 */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-3xl mb-4">🎭</div>
            <h3 className="font-semibold text-lg mb-2">AI 客户扮演</h3>
            <p className="text-gray-600 text-sm">
              模拟3种客户类型：成绩优秀型、中游型、较差型
              还原真实咨询场景
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-3xl mb-4">📊</div>
            <h3 className="font-semibold text-lg mb-2">6维评分系统</h3>
            <p className="text-gray-600 text-sm">
              开场、挖需求、提信心、举例、给方案、邀约确认
              全流程量化评估
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-3xl mb-4">💡</div>
            <h3 className="font-semibold text-lg mb-2">改进建议</h3>
            <p className="text-gray-600 text-sm">
              实时反馈优缺点
              针对薄弱环节给出具体改进方向
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/practice/new"
            className="inline-block px-10 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            开始演练
          </Link>
        </div>

        {/* 技术栈 */}
        <div className="mt-16 text-center text-gray-500 text-sm">
          <p>技术栈：Next.js + Tailwind CSS + MiniMax 大模型</p>
        </div>
      </div>
    </div>
  );
}
