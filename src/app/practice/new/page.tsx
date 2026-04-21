'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// 演练模式
type VoiceMode = 'text' | 'voice';

// 客户类型（地推/白名单）
type CustomerChannel = 'direct_push' | 'whitelist';

// 考试节点
type ExamNode = '开学考' | '月考' | '期中考' | '期末考' | '寒暑假';

// 年级
type Grade = '初一' | '初二' | '初三' | '高一' | '高二' | '高三';

// 成绩分段
type ScoreLevel = '成绩优秀型' | '成绩中游型' | '成绩薄弱型';

// 客户画像
type CustomerProfile = 'grade_top' | 'grade_mid' | 'grade_low';

// 客户画像配置
const CUSTOMER_PROFILE_CONFIG: Record<CustomerProfile, {
  name: string;
  desc: string;
  traits: string;
  typicalQuestions: string[];
  scriptTip: string;
}> = {
  grade_top: {
    name: '成绩优秀型',
    desc: '目标高、挑剔、喜欢比较',
    traits: '怕下滑、要拔高、冲排名、重效率、时间宝贵',
    typicalQuestions: [
      '能培优/冲刺吗？',
      '内容会不会太简单？',
      '效果怎么样？',
      '会不会浪费时间？',
    ],
    scriptTip: '我们不做低水平重复，专门帮优生查漏补缺、保持优势、冲刺更高排名，只抓薄弱点和难题，高效省时间',
  },
  grade_mid: {
    name: '成绩中游型',
    desc: '犹豫不决、需要案例说服',
    traits: '最焦虑、想提分、瓶颈明显、忽上忽下、不自觉、最易成交',
    typicalQuestions: [
      '怎么突破瓶颈？',
      '多久能提分？',
      '薄弱点怎么补？',
      '孩子不自觉你们管吗？',
    ],
    scriptTip: '中等生是最好提分的！我们用AI精准找薄弱、针对性练、盯紧学习习惯，帮孩子快速稳住分数、冲进上游',
  },
  grade_low: {
    name: '成绩薄弱型',
    desc: '焦虑、担心花钱无效',
    traits: '基础弱、没兴趣、怕跟不上、怕花钱没用、怕孩子抵触、缺信心',
    typicalQuestions: [
      '基础差能教吗？',
      '孩子不爱学怎么办？',
      '能跟得上吗？',
      '会不会打击自信？',
    ],
    scriptTip: '我们专门帮基础弱的孩子从简单入手、补牢基础、提升兴趣，一步步来，不打击信心，让孩子慢慢跟上',
  },
};

// 客户画像按年级和成绩的映射（客户画像 = 年级段 + 成绩段）
type ProfileMapKey = `${CustomerChannel}_${Grade}_${ScoreLevel}`;
const PROFILE_MAP: Record<ProfileMapKey, CustomerProfile> = {} as any;

// 生成所有组合的映射
const CHANNELS: CustomerChannel[] = ['direct_push', 'whitelist'];
const GRADES: Grade[] = ['初一', '初二', '初三', '高一', '高二', '高三'];
const SCORE_LEVELS: ScoreLevel[] = ['成绩优秀型', '成绩中游型', '成绩薄弱型'];
const PROFILES: CustomerProfile[] = ['grade_top', 'grade_mid', 'grade_low'];

CHANNELS.forEach(ch => {
  GRADES.forEach(grade => {
    SCORE_LEVELS.forEach(score => {
      const key = `${ch}_${grade}_${score}` as ProfileMapKey;
      // 映射：成绩优秀型 -> grade_top，成绩中游型 -> grade_mid，成绩薄弱型 -> grade_low
      const scoreToProfile: Record<ScoreLevel, CustomerProfile> = {
        '成绩优秀型': 'grade_top',
        '成绩中游型': 'grade_mid',
        '成绩薄弱型': 'grade_low',
      };
      PROFILE_MAP[key] = scoreToProfile[score];
    });
  });
});

// 配置选项
const VOICE_MODES: { value: VoiceMode; label: string; emoji: string; desc: string }[] = [
  { value: 'text', label: '文字模式', emoji: '💬', desc: '输入文字进行对话' },
  { value: 'voice', label: '语音模式', emoji: '🎤', desc: '语音对话，AI语音回复' },
];

const CUSTOMER_CHANNELS: { value: CustomerChannel; label: string; emoji: string; desc: string }[] = [
  { value: 'direct_push', label: '地推', emoji: '📍', desc: '线下地推客户' },
  { value: 'whitelist', label: '白名单', emoji: '⭐', desc: '白名单客户' },
];

const EXAM_NODES: ExamNode[] = ['开学考', '月考', '期中考', '期末考', '寒暑假'];

interface FormState {
  voiceMode: VoiceMode | null;
  customerChannel: CustomerChannel | null;
  examNode: ExamNode | null;
  grade: Grade | null;
  scoreLevel: ScoreLevel | null;
  customerProfile: CustomerProfile | null;
}

export default function NewPracticePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    voiceMode: null,
    customerChannel: null,
    examNode: null,
    grade: null,
    scoreLevel: null,
    customerProfile: null,
  });
  const [isCreating, setIsCreating] = useState(false);

  // 检查所有字段是否已填写
  const isFormComplete = Object.values(form).every(v => v !== null);

  // 根据已选的客户类型、年级、成绩自动计算客户画像
  const computedProfile = form.customerChannel && form.grade && form.scoreLevel
    ? PROFILE_MAP[`${form.customerChannel}_${form.grade}_${form.scoreLevel}`]
    : null;

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // 当第2、4、5步变化时，自动更新客户画像
  const handleStepChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      // 重新计算客户画像
      if (next.customerChannel && next.grade && next.scoreLevel) {
        next.customerProfile = PROFILE_MAP[`${next.customerChannel}_${next.grade}_${next.scoreLevel}`];
      }
      return next;
    });
  };

  const handleStart = async () => {
    if (!isFormComplete) {
      alert('请填写所有字段');
      return;
    }

    setIsCreating(true);
    try {
      // 构建映射：成绩分段 -> CustomerType
      const scoreToCustomerType: Record<ScoreLevel, string> = {
        '成绩优秀型': 'type_a',
        '成绩中游型': 'type_b',
        '成绩薄弱型': 'type_c',
      };

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salespersonId: 'demo_user',
          customerType: scoreToCustomerType[form.scoreLevel!],
          customerScore: form.scoreLevel,
          customerSubject: '待定',
          voiceMode: form.voiceMode === 'voice',
          customerChannel: form.customerChannel,
          examNode: form.examNode,
          grade: form.grade,
          customerProfile: form.customerProfile,
        }),
      });

      const data = await res.json();
      if (data.sessionId) {
        router.push(`/practice/${data.sessionId}`);
      }
    } catch (error) {
      console.error('创建会话失败:', error);
      alert('创建会话失败');
    } finally {
      setIsCreating(false);
    }
  };

  // 通用卡片样式（button 元素，移动端可靠响应点击）
  const cardClass = (isSelected: boolean) =>
    `w-full p-4 rounded-lg border-2 text-center font-medium transition-all cursor-pointer ${
      isSelected
        ? 'border-blue-500 bg-blue-50'
        : 'border-gray-200 hover:border-gray-300 bg-white'
    }`;

  const profileConfig = form.customerProfile ? CUSTOMER_PROFILE_CONFIG[form.customerProfile] : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 pb-28">
      <div className="max-w-2xl mx-auto">
        {/* 顶部导航 */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-gray-500 hover:text-gray-700">
            ← 返回
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">新建演练</h1>
        <p className="text-gray-600 mb-8">选择配置，开始AI陪练</p>

        {/* Step 1: 选择演练模式 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">1. 选择演练模式</h2>
          <div className="grid grid-cols-2 gap-4">
            {VOICE_MODES.map(mode => (
              <button
                key={mode.value}
                type="button"
                onClick={() => handleStepChange('voiceMode', mode.value)}
                className={cardClass(form.voiceMode === mode.value)}
              >
                <div className="text-2xl mb-2">{mode.emoji}</div>
                <div className="font-medium">{mode.label}</div>
                <div className="text-gray-500 text-sm mt-1">{mode.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: 选择客户类型 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">2. 选择客户类型</h2>
          <div className="grid grid-cols-2 gap-4">
            {CUSTOMER_CHANNELS.map(ch => (
              <button
                key={ch.value}
                type="button"
                onClick={() => handleStepChange('customerChannel', ch.value)}
                className={cardClass(form.customerChannel === ch.value)}
              >
                <div className="text-2xl mb-2">{ch.emoji}</div>
                <div className="font-medium">{ch.label}</div>
                <div className="text-gray-500 text-sm mt-1">{ch.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: 选择考试节点 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">3. 选择考试节点</h2>
          <div className="grid grid-cols-3 gap-4">
            {EXAM_NODES.map(node => (
              <button
                key={node}
                type="button"
                onClick={() => updateForm('examNode', node)}
                className={cardClass(form.examNode === node)}
              >
                {node}
              </button>
            ))}
          </div>
        </div>

        {/* Step 4: 选择年级 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">4. 选择年级</h2>
          <div className="grid grid-cols-3 gap-4">
            {GRADES.map(grade => (
              <button
                key={grade}
                type="button"
                onClick={() => handleStepChange('grade', grade)}
                className={cardClass(form.grade === grade)}
              >
                {grade}
              </button>
            ))}
          </div>
        </div>

        {/* Step 5: 选择成绩 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">5. 选择成绩</h2>
          <div className="grid grid-cols-3 gap-4">
            {SCORE_LEVELS.map(score => (
              <button
                key={score}
                type="button"
                onClick={() => handleStepChange('scoreLevel', score)}
                className={cardClass(form.scoreLevel === score)}
              >
                {score}
              </button>
            ))}
          </div>
        </div>

        {/* Step 6: 选择客户画像（根据前面选项自动匹配） */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">6. 选择客户画像</h2>
          
          {profileConfig ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border-2 border-blue-500 bg-blue-50">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
                    {profileConfig.name}
                  </span>
                  <span className="text-gray-600 text-sm">{profileConfig.desc}</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-gray-500">核心特点：</span>
                    <p className="text-sm text-gray-700">{profileConfig.traits}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">常问问题：</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {profileConfig.typicalQuestions.map((q, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                          {q}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">话术要点：</span>
                    <p className="text-sm text-gray-700">{profileConfig.scriptTip}</p>
                  </div>
                </div>
              </div>
              <p className="text-gray-500 text-sm">
                💡 根据您选择的客户类型、年级和成绩自动匹配
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>请先选择客户类型、年级和成绩</p>
              <p className="text-sm mt-1">客户画像将自动匹配</p>
            </div>
          )}
        </div>

        {/* 开始按钮 */}
        <button
          onClick={handleStart}
          disabled={!isFormComplete || isCreating}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
            !isFormComplete
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isCreating ? '创建中...' : '开始AI陪练'}
        </button>

        {/* 提示信息 */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          {form.voiceMode === 'voice' && (
            <p className="text-blue-600">🎤 语音模式已开启，AI将以语音回复</p>
          )}
          {form.voiceMode === 'text' && (
            <p>💬 文字模式，输入文字与AI对话</p>
          )}
          {form.voiceMode === null && (
            <p>请选择演练模式开始配置</p>
          )}
        </div>
      </div>

      {/* 移动端底部导航 */}
      <div className="mobile-nav">
        <div className="flex justify-around py-3">
          <Link href="/" className="flex flex-col items-center gap-1 text-gray-500">
            <span className="text-xl">🏠</span>
            <span className="text-xs">首页</span>
          </Link>
          <Link href="/practice/new" className="flex flex-col items-center gap-1 text-blue-600">
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
