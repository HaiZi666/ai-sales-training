import { NextResponse } from 'next/server';
import { getTrainingExamSession } from '@/lib/trainingExamStore';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getTrainingExamSession(id);

    if (!session) {
      return NextResponse.json({ error: '考试会话不存在' }, { status: 404 });
    }

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        questions: session.questions,
        selectedCategories: session.selectedCategories,
        startedAt: session.startedAt,
      },
    });
  } catch (error) {
    console.error('获取考试会话失败:', error);
    return NextResponse.json({ error: '获取考试会话失败' }, { status: 500 });
  }
}
