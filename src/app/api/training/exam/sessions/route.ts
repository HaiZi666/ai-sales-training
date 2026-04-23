import { NextRequest, NextResponse } from 'next/server';
import { EXAM_PAPER_CATEGORY_COUNT } from '@/lib/trainingExam';
import { createTrainingExamSession } from '@/lib/trainingExamStore';
import { createRandomExamPaper } from '@/lib/trainingExamServer';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { requestedCategoryCount?: number };
    const requestedCategoryCount =
      typeof body.requestedCategoryCount === 'number' && body.requestedCategoryCount > 0
        ? body.requestedCategoryCount
        : EXAM_PAPER_CATEGORY_COUNT;

    const result = createRandomExamPaper(requestedCategoryCount);

    if (result.errors.length > 0 || result.paper.length === 0) {
      return NextResponse.json(
        {
          error: result.errors[0] || '考试试卷生成失败',
          errors: result.errors,
          warnings: result.warnings,
        },
        { status: 500 }
      );
    }

    const session = createTrainingExamSession(result.paper, result.selectedCategories);

    return NextResponse.json({
      sessionId: session.id,
      totalQuestions: session.questions.length,
      selectedCategories: session.selectedCategories,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('创建考试会话失败:', error);
    return NextResponse.json({ error: '创建考试会话失败，请稍后重试' }, { status: 500 });
  }
}
