import { NextRequest, NextResponse } from 'next/server';
import { createTrainingSession, getAllTrainingSessions, QuestionType } from '@/lib/trainingStore';
import { generateAIResponse } from '@/lib/minimax';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  sales_faq: '销售常见问题',
  product_basics: '产品基础知识',
};

function buildFirstQuestionPrompt(questionType: QuestionType): string {
  if (questionType === 'sales_faq') {
    return `你是一位资深销售培训考官，正在对一名教育机构销售人员进行【销售常见问题】培训测试。

你需要依次出5道题，测试销售人员对常见销售场景的处理能力。每道题聚焦一个具体销售场景，如：
- 如何向陌生家长做自我介绍
- 遇到价格异议如何应对
- 家长说"考虑一下"怎么处理
- 如何引导家长来店体验
- 如何处理家长和竞品的对比

现在是第1题，请直接给出第1道题目（不要解释，直接出题）。`;
  }
  return `你是一位资深销售培训考官，正在对一名教育机构销售人员进行【产品基础知识】培训测试。

你需要依次出5道题，测试销售人员对产品知识的掌握程度。每道题聚焦一个具体产品知识点，如：
- 我们机构的核心产品/课程体系是什么
- 我们与竞争对手相比有哪些优势
- 针对不同成绩段的学生我们分别提供什么解决方案
- 我们的上课模式/教学方式是怎样的
- 我们的收费标准和退费政策是什么

现在是第1题，请直接给出第1道题目（不要解释，直接出题）。`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionType } = body as { questionType: QuestionType };

    if (!questionType || !['sales_faq', 'product_basics'].includes(questionType)) {
      return NextResponse.json({ error: '题型参数无效' }, { status: 400 });
    }

    const session = createTrainingSession(questionType);

    // 让 AI 生成第一道题
    const firstQuestionPrompt = buildFirstQuestionPrompt(questionType);
    const firstQuestion = await generateAIResponse(firstQuestionPrompt, []);

    return NextResponse.json({
      sessionId: session.id,
      questionType,
      questionTypeLabel: QUESTION_TYPE_LABELS[questionType],
      totalQuestions: session.totalQuestions,
      currentQuestionIndex: 0,
      firstQuestion,
    });
  } catch (error) {
    console.error('创建培训会话失败:', error);
    return NextResponse.json({ error: '创建培训会话失败' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sessions = getAllTrainingSessions().map(s => ({
      id: s.id,
      questionType: s.questionType,
      status: s.status,
      currentQuestionIndex: s.currentQuestionIndex,
      totalQuestions: s.totalQuestions,
      startedAt: s.startedAt,
      avgScore: s.scores.length > 0
        ? Math.round(s.scores.reduce((sum, sc) => sum + sc.score, 0) / s.scores.length)
        : undefined,
    }));
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('获取培训列表失败:', error);
    return NextResponse.json({ error: '获取培训列表失败' }, { status: 500 });
  }
}
