import { NextResponse } from 'next/server';
import { finishTrainingExamSession, getTrainingExamSession } from '@/lib/trainingExamStore';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getTrainingExamSession(id);

    if (!session) {
      return NextResponse.json({ error: '考试会话不存在' }, { status: 404 });
    }

    finishTrainingExamSession(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('结束考试会话失败:', error);
    return NextResponse.json({ error: '结束考试会话失败' }, { status: 500 });
  }
}
