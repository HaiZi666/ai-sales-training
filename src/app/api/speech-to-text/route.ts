import { NextRequest, NextResponse } from 'next/server';
import { speechToText } from '@/lib/minimax';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: '未收到音频文件' }, { status: 400 });
    }

    const text = await speechToText(file);

    if (!text) {
      return NextResponse.json({ error: '识别失败或结果为空' }, { status: 422 });
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error('speech-to-text route error:', err);
    return NextResponse.json({ error: '服务端转写失败' }, { status: 500 });
  }
}
