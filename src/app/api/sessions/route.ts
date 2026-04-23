import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession, getSessionList } from '@/lib/store';
import { CUSTOMER_TYPE_CONFIG, type ParentType } from '@/types';
import { addMessage } from '@/lib/store';
import { textToSpeech } from '@/lib/minimax';

// 创建演练会话
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      salespersonId,
      customerType,
      customerScore,
      customerSubject,
      voiceMode,
      customerChannel,
      examNode,
      grade,
      parentType,
    } = body;

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

    // 扩展字段记录到会话
    if (customerChannel) session.customerChannel = customerChannel;
    if (examNode) session.examNode = examNode;
    if (grade) session.grade = grade;
    if (parentType) session.parentType = parentType as ParentType;
    session.voiceMode = Boolean(voiceMode);

    // 生成AI开场白
    const config = CUSTOMER_TYPE_CONFIG[customerType as keyof typeof CUSTOMER_TYPE_CONFIG];
    const openingMessages = {
      type_a: '你好，你是？',
      type_b: '你们是做什么的？ ',
      type_c: '请问哪位？',
    };

    const aiMessage = openingMessages[customerType as keyof typeof openingMessages] || '您好，请问您是...？';
    
    // 语音模式下生成TTS
    let aiOpeningAudio = '';
    if (voiceMode && aiMessage) {
      try {
        aiOpeningAudio = await textToSpeech(aiMessage) || '';
      } catch (e) {
        console.error('TTS生成失败:', e);
      }
    }

    if (aiMessage) {
      addMessage(session.id, 'ai', aiMessage, session.currentNode);
    }

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      customerType: config.name,
      customerTypeKey: customerType,
      aiOpeningMessage: aiMessage,
      aiOpeningAudio,
      currentNode: session.currentNode,
      customerChannel,
      examNode,
      grade,
      parentType: session.parentType,
      voiceMode: session.voiceMode,
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
