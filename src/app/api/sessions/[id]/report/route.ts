import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/store';
import { buildComprehensiveScoringPrompt } from '@/lib/prompts';
import { generateComprehensiveScore } from '@/lib/minimax';

const EXTERNAL_PROMPT_URL = 'http://talking.sqkam2.top:8765/api/prompts';

type ExternalPromptResponse = {
  code?: number;
  message?: string;
  data?: {
    combined_prompt?: string;
    base_prompt?: string;
    scoring_criteria?: string;
    attention?: string;
    output_criteria?: string;
  };
};

async function fetchExternalScoringPrompt(): Promise<string | undefined> {
  try {
    const response = await fetch(EXTERNAL_PROMPT_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`prompt api status ${response.status}`);
    }

    const payload = (await response.json()) as ExternalPromptResponse;
    if (payload.code !== 0 || !payload.data) {
      throw new Error(payload.message || 'prompt api returned invalid payload');
    }

    const {
      combined_prompt,
      base_prompt,
      scoring_criteria,
      attention,
      output_criteria,
    } = payload.data;

    return (
      combined_prompt ||
      [base_prompt, scoring_criteria, attention, output_criteria]
        .filter(Boolean)
        .join('\n\n') ||
      undefined
    );
  } catch (error) {
    console.error('获取外部评分提示词失败:', error);
    return undefined;
  }
}

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

    const externalScoringPrompt = await fetchExternalScoringPrompt();

    // 调用大模型进行综合评分
    const scoringPrompt = buildComprehensiveScoringPrompt(
      conversationHistory,
      session.customerType,
      session.customerScore,
      session.customerSubject,
      session.parentType,
      externalScoringPrompt
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
