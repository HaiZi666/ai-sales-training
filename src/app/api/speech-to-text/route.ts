import { NextRequest, NextResponse } from 'next/server';

const TRANSCRIBE_API = 'http://talking.sqkam2.top:8765/api/transcribe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audio, format } = body;

    if (!audio) {
      return NextResponse.json({ error: '未收到音频数据' }, { status: 400 });
    }

    const res = await fetch(TRANSCRIBE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio, format: format || 'webm' }),
    });

    const data = await res.json();

    if (data.code === 0 && data.data?.text) {
      return NextResponse.json({ text: data.data.text });
    }

    return NextResponse.json({ error: data.message || '识别失败' }, { status: 422 });
  } catch (err) {
    console.error('speech-to-text route error:', err);
    return NextResponse.json({ error: '转写服务不可用，请确认后端已启动' }, { status: 500 });
  }
}
