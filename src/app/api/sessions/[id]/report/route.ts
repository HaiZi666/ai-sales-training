import { NextRequest, NextResponse } from 'next/server';
import { getSession, generateReport } from '@/lib/store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getSession(id);
    
    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    const report = generateReport(id);

    return NextResponse.json({ report });
  } catch (error) {
    console.error('生成报告失败:', error);
    return NextResponse.json({ error: '生成报告失败' }, { status: 500 });
  }
}
