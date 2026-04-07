import { NextRequest, NextResponse } from 'next/server';
import { getSession, addMessage, addScore, updateCurrentNode } from '@/lib/store';
import { buildSystemPrompt, buildScoringPrompt } from '@/lib/prompts';
import { generateAIResponse, generateScore } from '@/lib/minimax';
import { SCORING_CONFIG, DialogNode, NODE_ORDER } from '@/types';

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
    const { text, node } = body;

    if (!text) {
      return NextResponse.json({ error: '消息内容不能为空' }, { status: 400 });
    }

    // 保存销售的回复
    const salesMessage = addMessage(id, 'sales', text, node as DialogNode);

    // 构建对话历史（用于AI上下文）
    const conversationHistory = session.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
    // 添加当前销售消息
    conversationHistory.push({ role: 'sales', content: text });

    // 构建AI系统Prompt
    const systemPrompt = buildSystemPrompt(
      session.customerType,
      session.customerScore,
      session.customerSubject,
      node || session.currentNode
    );

    // 评分
    const currentNode = node || session.currentNode;
    const scoringConfig = SCORING_CONFIG[currentNode as DialogNode];
    const scoringPrompt = buildScoringPrompt(
      currentNode,
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
      node: currentNode as DialogNode,
      score: nodeScore.score,
      maxScore: scoringConfig.maxScore,
      feedback: nodeScore.feedback,
      strengths: nodeScore.strengths,
      weaknesses: nodeScore.weaknesses,
      suggestions: nodeScore.suggestions,
    });

    // 判断是否升级节点
    const currentIndex = NODE_ORDER.indexOf(currentNode as DialogNode);
    let nextNode = currentNode;
    const salesLower = text.toLowerCase();
    
    // 节点升级关键词判断
    const upgradeKeywords: Record<string, string[]> = {
      挖需求: ['分数', '排名', '成绩', '弱科', '听不懂', '考试', '班级', '年级'],
      提信心: ['基础', '方法', '提高', '提升', '信心', '解决', '原因'],
      举例: ['案例', '例子', '学生', '之前', '效果', '提分', '进步'],
      给方案: ['课程', '安排', '时间', '学习', '方案', '体验', '怎么学'],
      邀约确认: ['时间', '地点', '地址', '过来', '到店', '预约', '周几', '几点'],
    };

    for (let i = currentIndex + 1; i < NODE_ORDER.length; i++) {
      const keywords = upgradeKeywords[NODE_ORDER[i]] || [];
      if (keywords.some(kw => salesLower.includes(kw))) {
        nextNode = NODE_ORDER[i];
        break;
      }
    }

    // 如果消息数量达到一定轮数且当前不是最后一个节点，也自动升级
    const messageCountInNode = session.messages.filter(m => m.node === currentNode).length;
    if (messageCountInNode >= 3 && currentIndex < NODE_ORDER.length - 1) {
      nextNode = NODE_ORDER[currentIndex + 1];
    }

    updateCurrentNode(id, nextNode as DialogNode);

    // 生成AI回复
    const aiResponse = await generateAIResponse(systemPrompt, conversationHistory);

    // 保存AI回复
    const aiMessage = addMessage(id, 'ai', aiResponse, nextNode as DialogNode);

    // 检查是否应该结束会话
    const shouldEnd = 
      (nextNode === '邀约确认' && messageCountInNode >= 2) ||
      text.includes('好的') || text.includes('行') || 
      (text.includes('来') && text.includes('试试'));

    return NextResponse.json({
      aiMessage: aiResponse,
      aiMessageId: aiMessage.id,
      nodeScore: {
        node: currentNode,
        score: nodeScore.score,
        maxScore: scoringConfig.maxScore,
        feedback: nodeScore.feedback,
        strengths: nodeScore.strengths,
        weaknesses: nodeScore.weaknesses,
        suggestions: nodeScore.suggestions,
      },
      nextNode,
      isFinished: shouldEnd,
    });
  } catch (error) {
    console.error('发送消息失败:', error);
    return NextResponse.json({ error: '发送消息失败' }, { status: 500 });
  }
}
