import { NextRequest, NextResponse } from 'next/server';
import { 
  getTrainingSession, 
  addTrainingMessage, 
  addTrainingScore, 
  getNextQuestion, 
  markQuestionAsked,
  finishSession,
  getQuestionTypeName 
} from '@/lib/trainingStore';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getTrainingSession(id);

    if (!session) {
      return NextResponse.json({ error: '培训会话不存在' }, { status: 404 });
    }
    if (session.status === 'finished') {
      return NextResponse.json({ error: '培训已结束' }, { status: 400 });
    }

    const body = await request.json();
    const { text, currentQuestionId } = body as {
      text: string;
      currentQuestionId: string;
    };

    if (!text?.trim()) {
      return NextResponse.json({ error: '回答内容不能为空' }, { status: 400 });
    }

    // Find the current question
    const currentQuestion = session.questions.find(q => q.id === currentQuestionId);
    if (!currentQuestion) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 });
    }

    // Save user answer
    addTrainingMessage(id, 'user', text);

    // Mark this question as asked
    markQuestionAsked(id, currentQuestionId);

    // Get the next question
    const nextQuestion = getNextQuestion(id);
    const isFinished = !nextQuestion;

    // If finished, finish the session
    if (isFinished) {
      finishSession(id);
    }

    return NextResponse.json({
      currentQuestionId,
      currentQuestion: currentQuestion.question,
      currentStandardAnswer: currentQuestion.standardAnswer,
      nextQuestion: nextQuestion?.question || null,
      nextQuestionId: nextQuestion?.id || null,
      /** 下一题的标准答案，供客户端展示评分要点（与 currentStandardAnswer 区分） */
      nextStandardAnswer: nextQuestion?.standardAnswer ?? null,
      totalQuestions: session.questions.length,
      askedCount: session.askedQuestionIds.length,
      isFinished,
    });
  } catch (error) {
    console.error('培训消息处理失败:', error);
    return NextResponse.json({ error: '处理失败' }, { status: 500 });
  }
}
