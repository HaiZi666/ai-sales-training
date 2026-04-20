import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
            AI销售通
          </h1>
          <p className="text-base md:text-xl text-gray-600 max-w-2xl mx-auto">
            销售员入门到精通的全方位提升工具 
            <br className="hidden md:block" />
            助力销售员自信从容应对各种销售问题
          </p>
        </div>

        {/* 功能卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link
            className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow"
            href="/training"
          >
            <div className="text-2xl mb-3">📖</div>
            <h3 className="font-semibold text-base mb-1">基础知识训练</h3>
            <p className="text-gray-600 text-sm">
              入门训练，助力掌握销售基础知识
            </p>
          </Link>
          <Link
            className="bg-white rounded-2xl shadow-sm p-5"
            href="/practice/new"
          >
            <div className="text-2xl mb-3">🎭</div>
            <h3 className="font-semibold text-base mb-1">邀约情景模拟</h3>
            <p className="text-gray-600 text-sm">
              还原真实邀约情景，训练不同场景下的应对技巧
            </p>
          </Link>
          <Link
            href='http://10.200.0.55:8090/upload'
            className="bg-white rounded-2xl shadow-sm p-5"
          >
            <div className="text-2xl mb-3">🎤</div>
            <h3 className="font-semibold text-base mb-1">录音分析</h3>
            <p className="text-gray-600 text-sm">
              实现沟通全流程的自动复盘、智能点评与精准跟进
            </p>
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
          <Link href="/training" className="flex flex-col items-center gap-1 text-gray-500">
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
