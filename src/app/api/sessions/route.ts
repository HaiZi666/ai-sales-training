import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession, getSessionList } from '@/lib/store';
import { CUSTOMER_TYPE_CONFIG } from '@/types';

// 创建演练会话
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { salespersonId, customerType, customerScore, customerSubject } = body;

    if (!customerType || !customerScore || !customerSubject) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const session = createSession(
      salespersonId || 'demo_user',
      customerType,
      customerScore,
      customerSubject
    );

    // 生成AI开场白
    const config = CUSTOMER_TYPE_CONFIG[customerType as keyof typeof CUSTOMER_TYPE_CONFIG];
    const openingMessages = {
      type_a: '您好，我听说你们这边有个简单一百的课程？我孩子成绩挺好的，想了解一下。',
      type_b: '您好，请问你们这是那个简单一百学习中心吗？',
      type_c: '唉，老师，我现在挺发愁的，孩子成绩一直上不去...',
    };

    const aiMessage = openingMessages[customerType as keyof typeof openingMessages] || '您好，请问您是...？';

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      customerType: config.name,
      aiOpeningMessage: aiMessage,
      currentNode: session.currentNode,
    });
  } catch (error) {
    console.error('创建会话失败:', error);
    return NextResponse.json(
      { error: '创建会话失败' },
      { status: 500 }
    );
  }
}

// 获取会话列表
export async function GET() {
  try {
    const list = getSessionList();
    return NextResponse.json({ sessions: list });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    return NextResponse.json(
      { error: '获取会话列表失败' },
      { status: 500 }
    );
  }
}
