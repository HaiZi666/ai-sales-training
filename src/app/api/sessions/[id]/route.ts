import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getSession(id);
    
    if (!session) {
      return NextResponse.json(
        { error: '会话不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('获取会话失败:', error);
    return NextResponse.json(
      { error: '获取会话失败' },
      { status: 500 }
    );
  }
}
