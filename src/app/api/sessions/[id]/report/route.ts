import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/store';
import { buildComprehensiveScoringPrompt } from '@/lib/prompts';
import { generateComprehensiveScore } from '@/lib/minimax';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getSession(id);
    
    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    // 构建对话历史
    const conversationHistory = session.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // 调用大模型进行综合评分
    const scoringPrompt = buildComprehensiveScoringPrompt(
      conversationHistory,
      session.customerType,
      session.customerScore,
      session.customerSubject,
      session.parentType
    );

    let report;
    try {
      report = await generateComprehensiveScore(scoringPrompt);
    } catch (error) {
      console.error('生成综合评分失败:', error);
      report = {
        dimensions: [
          { name: '开场', score: 0, maxScore: 15, detail: '评分生成失败' },
          { name: '挖需求', score: 0, maxScore: 25, detail: '评分生成失败' },
          { name: '提信心', score: 0, maxScore: 15, detail: '评分生成失败' },
          { name: '举例', score: 0, maxScore: 20, detail: '评分生成失败' },
          { name: '给方案', score: 0, maxScore: 15, detail: '评分生成失败' },
          { name: '邀约确认', score: 0, maxScore: 10, detail: '评分生成失败' },
        ],
        totalScore: 0,
        grade: 'D',
        highlight: '评分生成失败',
        weakness: '请检查评分服务',
        improvements: [],
      };
    }

    return NextResponse.json({ 
      report: {
        sessionId: id,
        ...report,
      }
    });
  } catch (error) {
    console.error('生成报告失败:', error);
    return NextResponse.json({ error: '生成报告失败' }, { status: 500 });
  }
}
