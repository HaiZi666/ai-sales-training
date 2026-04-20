import { NextRequest, NextResponse } from 'next/server';
import { createTrainingSession, addTrainingMessage, markQuestionAsked, getQuestionTypeName, QuestionType } from '@/lib/trainingStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionType } = body as { questionType: QuestionType };

    if (!questionType || !['sales_faq', 'product_basics'].includes(questionType)) {
      return NextResponse.json({ error: '题型参数无效' }, { status: 400 });
    }

    // Create session and load questions from Excel
    const session = createTrainingSession(questionType);

    if (!session || session.questions.length === 0) {
      return NextResponse.json({ error: '题库为空或读取失败，无法开始培训' }, { status: 500 });
    }

    // Get the first question
    const firstQuestion = session.questions[0];
    const questionTypeName = getQuestionTypeName(questionType);

    // Add opening message
    const openingMessage = `接下来对您进行${questionTypeName}培训，请直接作答。`;
    addTrainingMessage(session.id, 'ai', openingMessage);

    // 正确标记第1题为已出题（会持久化到文件）
    markQuestionAsked(session.id, firstQuestion.id);

    return NextResponse.json({
      sessionId: session.id,
      questionType,
      questionTypeName,
      totalQuestions: session.questions.length,
      currentQuestionIndex: 1,
      openingMessage,
      firstQuestion: firstQuestion.question,
      firstQuestionId: firstQuestion.id,
    });
  } catch (error) {
    console.error('创建培训会话失败:', error);
    return NextResponse.json({ error: '题库为空或读取失败，无法开始培训' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Return empty list for now - could add history later
    return NextResponse.json({ sessions: [] });
  } catch (error) {
    console.error('获取培训列表失败:', error);
    return NextResponse.json({ error: '获取培训列表失败' }, { status: 500 });
  }
}
