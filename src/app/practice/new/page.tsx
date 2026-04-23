'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mic, MessageSquareText, Play, ScanSearch, Sparkles, UserRoundSearch } from 'lucide-react';
import type { ParentType } from '@/types';
import MobileBottomNav from '@/components/MobileBottomNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/ui/page-shell';
import { cn } from '@/lib/utils';

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
const PROFILE_MAP: Partial<Record<ProfileMapKey, CustomerProfile>> = {};

// 生成所有组合的映射
const CHANNELS: CustomerChannel[] = ['direct_push', 'whitelist'];
const GRADES: Grade[] = ['初一', '初二', '初三', '高一', '高二', '高三'];
const SCORE_LEVELS: ScoreLevel[] = ['成绩优秀型', '成绩中游型', '成绩薄弱型'];
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
const VOICE_MODES: { value: VoiceMode; label: string }[] = [
  { value: 'text', label: '文字模式' },
  { value: 'voice', label: '语音模式' },
];

const CUSTOMER_CHANNELS: { value: CustomerChannel; label: string }[] = [
  { value: 'direct_push', label: '线下地推客户'},
  { value: 'whitelist', label: '陌生拜访客户' },
];

const EXAM_NODES: ExamNode[] = ['开学考', '月考', '期中考', '期末考', '寒暑假'];

// 家长心理类型（与成绩分段独立，用于丰富 AI 家长人设）
const PARENT_TYPE_OPTIONS: { value: ParentType; label: string }[] = [
  { value: 'anxiety', label: '焦虑型（最常见）' },
  { value: 'rational', label: '理性对比型' },
  { value: 'price_sensitive', label: '价格敏感型' },
  { value: 'controlling', label: '强势控制型' },
  { value: 'busy', label: '没时间型（职场家长）' },
  { value: 'cautious', label: '试错谨慎型' },
];

interface FormState {
  voiceMode: VoiceMode | null;
  customerChannel: CustomerChannel | null;
  examNode: ExamNode | null;
  grade: Grade | null;
  scoreLevel: ScoreLevel | null;
  customerProfile: CustomerProfile | null;
  parentType: ParentType | null;
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
    parentType: null,
  });
  const [isCreating, setIsCreating] = useState(false);

  // 检查所有字段是否已填写
  const isFormComplete = Object.values(form).every(v => v !== null);

  // 根据已选的客户类型、年级、成绩自动计算客户画像
  const computedProfile = form.customerChannel && form.grade && form.scoreLevel
    ? PROFILE_MAP[`${form.customerChannel}_${form.grade}_${form.scoreLevel}` as ProfileMapKey] ?? null
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
        next.customerProfile = PROFILE_MAP[`${next.customerChannel}_${next.grade}_${next.scoreLevel}` as ProfileMapKey] ?? null;
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
          parentType: form.parentType,
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

  const cardClass = (isSelected: boolean) =>
    cn(
      'w-full rounded-[var(--radius-lg)] border bg-white p-4 text-center font-medium transition-all',
      isSelected
        ? 'border-[rgba(124,108,248,0.34)] bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(238,235,255,0.56))] shadow-[0_18px_40px_-28px_rgba(97,92,248,0.45)]'
        : 'border-[var(--color-border-soft)] hover:border-[var(--color-border)] hover:bg-[var(--color-fill-soft)]'
    );

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-brand-strong)]">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
        </div>

        <PageHeader
          title="新建演练"
          description="选择演练模式、客户来源和画像后开始 AI 陪练，不改动原有业务参数与创建流程。"
          action={<Badge variant="brand">单任务配置页</Badge>}
        />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. 选择演练模式</CardTitle>
              <CardDescription>以浅色极简卡片呈现两种核心入口。</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {VOICE_MODES.map(mode => {
                const Icon = mode.value === 'voice' ? Mic : MessageSquareText;

                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => handleStepChange('voiceMode', mode.value)}
                    className={cardClass(form.voiceMode === mode.value)}
                  >
                    <div className="mb-3 flex justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--color-fill-soft)] text-[var(--color-brand-strong)]">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="font-semibold text-[var(--color-text)]">{mode.label}</div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. 选择客户类型</CardTitle>
              <CardDescription>确定本次演练的获客来源与沟通背景。</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CUSTOMER_CHANNELS.map(ch => (
                <button
                  key={ch.value}
                  type="button"
                  onClick={() => handleStepChange('customerChannel', ch.value)}
                  className={cardClass(form.customerChannel === ch.value)}
                >
                  <div className="font-semibold text-[var(--color-text)]">{ch.label}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. 选择客户画像</CardTitle>
              <CardDescription>考试节点、年级、成绩与家长类型共同决定 AI 家长人设。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                  <ScanSearch className="h-4 w-4 text-[var(--color-brand-strong)]" />
                  考试节点
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
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

              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                  <Sparkles className="h-4 w-4 text-[var(--color-brand-strong)]" />
                  年级
                </div>
                <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
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

              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                  <Play className="h-4 w-4 text-[var(--color-brand-strong)]" />
                  成绩分段
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                  <UserRoundSearch className="h-4 w-4 text-[var(--color-brand-strong)]" />
                  家长类型
                </div>
                <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
                  决定沟通风格与关注重点，与成绩分段可叠加。
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {PARENT_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateForm('parentType', opt.value)}
                      className={cardClass(form.parentType === opt.value)}
                    >
                      <span className="text-sm font-medium leading-snug">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Button
              onClick={handleStart}
              disabled={!isFormComplete || isCreating}
              size="lg"
              className="w-full"
            >
              {isCreating ? '创建中...' : '开始 AI 陪练'}
            </Button>

            <div className="text-center text-sm text-[var(--color-text-secondary)]">
              {form.voiceMode === 'voice' && '语音模式已开启，AI 将以语音回复。'}
              {form.voiceMode === 'text' && '文字模式已开启，输入文本即可与 AI 对话。'}
              {form.voiceMode === null && '请选择演练模式开始配置。'}
            </div>
          </div>
        </div>
      </div>
      <MobileBottomNav />
    </PageShell>
  );
}
