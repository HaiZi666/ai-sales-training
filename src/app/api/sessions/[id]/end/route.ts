import { NextRequest, NextResponse } from 'next/server';
import { getSession, finishSession } from '@/lib/store';

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

    const finishedSession = finishSession(id);

    return NextResponse.json({
      success: true,
      message: '演练已结束',
      sessionId: finishedSession.id,
    });
  } catch (error) {
    console.error('结束会话失败:', error);
    return NextResponse.json({ error: '结束会话失败' }, { status: 500 });
  }
}
