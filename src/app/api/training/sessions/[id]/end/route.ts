import { NextResponse } from 'next/server';
import { getTrainingSession, finishSession } from '@/lib/trainingStore';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getTrainingSession(id);

    if (!session) {
      return NextResponse.json({ error: '培训会话不存在' }, { status: 404 });
    }

    if (session.status !== 'finished') {
      finishSession(id);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('training session end:', e);
    return NextResponse.json({ error: '结束失败' }, { status: 500 });
  }
}
