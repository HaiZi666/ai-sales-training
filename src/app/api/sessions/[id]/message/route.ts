import { NextRequest, NextResponse } from 'next/server';
import { getSession, addMessage, addScore } from '@/lib/store';
import { buildSystemPrompt, buildScoringPrompt } from '@/lib/prompts';
import { generateAIResponse, generateScore } from '@/lib/minimax';
import { SCORING_CONFIG } from '@/types';
import { faqs, getAllScenarios } from '@/lib/knowledge';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getSession(id);
    
    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    if (session.status === 'finished') {
      return NextResponse.json({ error: '会话已结束' }, { status: 400 });
    }

    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: '消息内容不能为空' }, { status: 400 });
    }

    // 保存销售的回复
    const salesMessage = addMessage(id, 'sales', text, '开场');

    // 构建对话历史（用于AI上下文）
    const conversationHistory = session.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
    // 添加当前销售消息
    conversationHistory.push({ role: 'sales', content: text });

    // 构建FAQ上下文 - 包含完整的问答库供AI参考
    const faqContext = buildFAQContext();
    
    // 构建AI系统Prompt（包含FAQ）
    const systemPrompt = buildSystemPrompt(
      session.customerType,
      session.customerScore,
      session.customerSubject,
      faqContext
    );

    // 评分（简化评分维度）
    const scoringConfig = SCORING_CONFIG['开场'];
    const scoringPrompt = buildScoringPrompt(
      text,
      scoringConfig.maxScore,
      scoringConfig.criteria
    );

    let nodeScore;
    try {
      nodeScore = await generateScore(scoringPrompt);
    } catch {
      nodeScore = {
        score: 0,
        feedback: '评分服务暂时不可用',
        strengths: [],
        weaknesses: [],
        suggestions: [],
      };
    }

    // 保存评分
    addScore(id, {
      node: '开场',
      score: nodeScore.score,
      maxScore: scoringConfig.maxScore,
      feedback: nodeScore.feedback,
      strengths: nodeScore.strengths,
      weaknesses: nodeScore.weaknesses,
      suggestions: nodeScore.suggestions,
    });

    // 全局30轮限制
    const totalMessageCount = session.messages.length;
    const MAX_TURNS = 30;
    const shouldEnd = totalMessageCount >= MAX_TURNS;

    // 生成AI回复
    const aiResponse = await generateAIResponse(systemPrompt, conversationHistory);

    // 保存AI回复
    const aiMessage = addMessage(id, 'ai', aiResponse, '开场');

    return NextResponse.json({
      aiMessage: aiResponse,
      aiMessageId: aiMessage.id,
      nodeScore: {
        node: '开场',
        score: nodeScore.score,
        maxScore: scoringConfig.maxScore,
        feedback: nodeScore.feedback,
        strengths: nodeScore.strengths,
        weaknesses: nodeScore.weaknesses,
        suggestions: nodeScore.suggestions,
      },
      nextNode: '开场',
      isFinished: shouldEnd,
    });
  } catch (error) {
    console.error('发送消息失败:', error);
    return NextResponse.json({ error: '发送消息失败' }, { status: 500 });
  }
}

// 构建FAQ上下文给AI参考
function buildFAQContext(): string {
  const scenarios = getAllScenarios();
  
  let context = `
【参考资料：家长在不同阶段可能涉及的话题】
以下仅供参考，绝不是让你照单全问。
使用规则：
- 对话初期（前2-3轮）：不得使用任何以下问题，只做身份确认/来意询问。
- 对话中后期（了解机构背景后）：可根据对话节奏自然带出其中1个，而非连续追问。
- 这些问题是"可能的方向"，不是"必须问的清单"。

`;

  for (const scenario of scenarios) {
    const items = faqs.filter(f => f.scenario === scenario);
    context += `【${scenario}阶段参考话题】\n`;
    for (const item of items) {
      context += `- ${item.question}\n`;
    }
    context += '\n';
  }

  return context;
}
