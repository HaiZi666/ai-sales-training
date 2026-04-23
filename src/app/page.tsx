import Link from 'next/link';
import { ArrowRight, AudioLines, BookOpen, Sparkles } from 'lucide-react';
import MobileBottomNav from '@/components/MobileBottomNav';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageShell } from '@/components/ui/page-shell';
import { AUDIO_ANALYSIS_URL } from '@/constants/common';

export default function Home() {
  const modules = [
    {
      href: '/training',
      title: '基础知识训练',
      description: 'AI 考官逐题出题，帮助销售团队快速巩固产品知识与场景理解。',
      icon: BookOpen,
      badge: '知识闯关',
      btnText: '进入训练'
    },
    {
      href: '/practice/new',
      title: '邀约情景模拟',
      description: '按客户画像与沟通场景配置演练，沉浸式训练成交前关键对话。',
      icon: Sparkles,
      badge: '核心工具',
      btnText: '开始演练'
    },
    {
      href: AUDIO_ANALYSIS_URL,
      title: '录音分析',
      description: '上传真实沟通录音，自动生成复盘洞察、亮点总结与跟进建议。',
      icon: AudioLines,
      badge: 'AI 复盘',
      btnText: 'Ai评价'
    },
  ];

  return (
    <PageShell className="pb-24">
      <div className="mx-auto max-w-5xl">
        <section className="bg-grid-soft overflow-hidden rounded-[28px] border border-white/80 bg-[var(--color-surface-muted)] px-6 py-10 shadow-[var(--shadow-card)] md:px-10 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-[var(--color-text)] md:text-6xl">
              AI 销售通
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] md:text-lg">
              销售员入门到精通的全方位提升工具 ，助力销售员自信从容应对各种销售问题。
            </p>
          </div>
        </section>

        <section className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {modules.map(module => {
            const Icon = module.icon;

            return (
              <Link key={module.title} href={module.href} className="group">
                <Card className="h-full border-[var(--color-border-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(79,140,255,0.34)]">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="neutral">{module.badge}</Badge>
                    </div>
                    <CardTitle className="mt-3 text-xl">{module.title}</CardTitle>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-brand-strong)]">
                      {module.btnText}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </section>

        <div className="mt-12 text-center text-xs text-[var(--color-text-muted)]">
          技术栈：Next.js + Tailwind CSS + MiniMax 大模型
        </div>
      </div>

      <MobileBottomNav />
    </PageShell>
  );
}
