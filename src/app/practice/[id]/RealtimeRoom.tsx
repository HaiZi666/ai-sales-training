'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { LoaderCircle, Mic, PhoneOff, PlugZap, Volume2 } from 'lucide-react';
import { MiniMaxRealtimeClient, TextDeltaEvent } from '@/lib/realtime';
import { textToSpeech } from '@/lib/minimax';
import { DialogNode, type ParentType } from '@/types';
import { buildSystemPrompt, buildNodeFaqContext } from '@/lib/prompts';
import { getFAQsByScenario } from '@/lib/knowledge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface RealtimeRoomProps {
  sessionId: string;
  apiKey: string;
  customerType: string;
  customerScore: string;
  customerSubject: string;
  parentType?: ParentType;
  currentNode: DialogNode;
  onNodeChange: (node: DialogNode) => void;
  onFinish: () => void;
}

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export default function RealtimeRoom({
  sessionId,
  apiKey,
  customerType,
  customerScore,
  customerSubject,
  parentType,
  currentNode,
  onNodeChange,
  onFinish,
}: RealtimeRoomProps) {
  const [status, setStatus] = useState<
    'idle' | 'connecting' | 'ready' | 'listening' | 'thinking' | 'speaking' | 'error'
  >('idle');
  const [messages, setMessages] = useState<{ role: 'ai' | 'sales'; content: string }[]>([]);
  const [aiText, setAiText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<MiniMaxRealtimeClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const aiTextRef = useRef('');
  const isConnectedRef = useRef(false);

  const MINIMAX_API_KEY = apiKey;

  const playTTS = useCallback(async (text: string) => {
    try {
      setStatus('speaking');
      const audioUrl = await textToSpeech(text);
      if (!audioUrl) {
        setStatus('ready');
        return;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onplay = () => setStatus('speaking');
      audio.onended = () => {
        setStatus('ready');
        audioRef.current = null;
      };
      audio.onerror = () => {
        setStatus('ready');
        audioRef.current = null;
      };
      await audio.play();
    } catch {
      setStatus('ready');
    }
  }, []);

  // 清理函数
  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    isConnectedRef.current = false;
  }, []);

  // 初始化连接
  const connect = useCallback(async () => {
    cleanup();
    setStatus('connecting');
    setError(null);

    try {
      // 生成节点感知的FAQ上下文
      const faqContext = buildNodeFaqContext(
        currentNode,
        customerType as 'type_a' | 'type_b' | 'type_c',
        scenario => getFAQsByScenario(scenario as Parameters<typeof getFAQsByScenario>[0])
      );

      // 构建完整的系统提示词
      const instructions = buildSystemPrompt(
        customerType as 'type_a' | 'type_b' | 'type_c',
        customerScore,
        customerSubject,
        faqContext,
        currentNode,
        parentType
      );

      const client = new MiniMaxRealtimeClient({
        apiKey: MINIMAX_API_KEY,
        model: 'abab6.5s-chat',
        modalities: ['text'],
        instructions,
      });

      clientRef.current = client;

      client.addHandler((msg) => {
        // 文字增量
        if (msg.type === 'response.text.delta') {
          const delta = (msg as unknown as TextDeltaEvent).delta;
          setAiText((prev) => {
            const next = prev + delta;
            aiTextRef.current = next;
            return next;
          });
        }

        // AI 说话结束
        if (msg.type === 'response.done') {
          setStatus('ready');
          if (aiTextRef.current) {
            const finalText = aiTextRef.current;
            setMessages((prev) => [...prev, { role: 'ai', content: finalText }]);
            setAiText('');
            aiTextRef.current = '';
            // 播放 AI 回复
            playTTS(finalText);
          }
        }

        // 错误
        if (msg.type === 'error') {
          const err = msg.error as { message?: string } | undefined;
          setError(err?.message || 'Unknown error');
          setStatus('error');
        }
      });

      await client.connect();
      await client.startSession();
      isConnectedRef.current = true;
      setStatus('ready');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Connection failed');
      setStatus('error');
    }
  }, [
    MINIMAX_API_KEY,
    customerType,
    customerScore,
    customerSubject,
    parentType,
    currentNode,
    cleanup,
    playTTS,
  ]);

  // 发送用户语音
  const sendVoiceMessage = async () => {
    const client = clientRef.current;
    if (!client || !isConnectedRef.current) return;

    try {
      setStatus('listening');

      // 获取麦克风
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000);

      // 3秒后停止录音并发送
      setTimeout(async () => {
        mediaRecorder.stop();
        stream.getTracks().forEach((t) => t.stop());

        // 合并音频
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const text = await transcribeAudio(audioBlob);

        if (text) {
          await sendTextMessage(text);
        } else {
          setStatus('ready');
        }
      }, 3000);
    } catch {
      setError('Microphone error');
      setStatus('error');
    }
  };

  // 发送文字消息
  const sendTextMessage = async (text: string) => {
    const client = clientRef.current;
    if (!client || !isConnectedRef.current) return;

    // 添加用户消息
    setMessages((prev) => [...prev, { role: 'sales', content: text }]);
    setAiText('');
    setStatus('thinking');

    try {
      await client.sendText(text);
      // 等待 response.done
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '发送失败');
      setStatus('error');
    }
  };

  // 结束演练
  const handleEnd = () => {
    cleanup();
    onFinish();
  };

  // 组件卸载
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // 状态颜色
  const statusColor = {
    idle: 'bg-gray-400',
    connecting: 'bg-yellow-400 animate-pulse',
    ready: 'bg-green-400',
    listening: 'bg-red-400 animate-pulse',
    thinking: 'bg-yellow-400 animate-pulse',
    speaking: 'bg-blue-400 animate-pulse',
    error: 'bg-red-400',
  }[status];

  const statusText = {
    idle: '未连接',
    connecting: '连接中...',
    ready: '准备就绪',
    listening: '录音中...',
    thinking: 'AI思考中...',
    speaking: 'AI说话中...',
    error: '出错',
  }[status];

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] bg-white/88 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${statusColor}`} />
          <div>
            <div className="text-base font-semibold text-[var(--color-text)]">
              {customerType} · {customerScore}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">实时语音模式</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={status === 'ready' ? sendVoiceMessage : undefined}
            disabled={!['ready', 'idle'].includes(status)}
            variant={status === 'ready' ? 'danger' : 'secondary'}
            size="sm"
          >
            <Mic className="h-4 w-4" /> {status === 'ready' ? '按住说话' : statusText}
          </Button>
          <Button onClick={handleEnd} variant="danger" size="sm">
            <PhoneOff className="h-4 w-4" />
            结束
          </Button>
        </div>
      </div>

      {/* 当前节点提示 */}
      <div className="border-b border-[var(--color-border-soft)] bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">当前节点：</span>
          <Badge variant="brand">{currentNode}</Badge>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-2 rounded-[var(--radius-lg)] border border-[rgba(239,68,68,0.16)] bg-[var(--color-danger-soft)] px-4 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && status === 'ready' && (
          <div className="mt-8 text-center text-sm text-[var(--color-text-muted)]">
            点击下方按钮开始对话
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'sales' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-[22px] px-4 py-2.5 text-sm ${
                msg.role === 'sales'
                  ? 'rounded-br-sm bg-[linear-gradient(135deg,var(--color-brand-from),var(--color-brand-to))] text-white shadow-[var(--shadow-button)]'
                  : 'rounded-bl-sm border border-[var(--color-border-soft)] bg-white text-[var(--color-text)] shadow-[var(--shadow-card)]'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* AI 正在输入 */}
        {aiText && (
          <div className="flex justify-start">
            <div className="rounded-[22px] rounded-bl-sm border border-[var(--color-border-soft)] bg-white px-4 py-2.5 text-sm shadow-[var(--shadow-card)]">
              <span className="animate-pulse text-[var(--color-text-muted)]">AI 输入中...</span>
            </div>
          </div>
        )}
      </div>

      {/* 底部操作 */}
      <div className="safe-area-bottom border-t border-[var(--color-border-soft)] bg-white/92 p-4 backdrop-blur-xl">
        <div className="flex gap-3">
          <Button
            onClick={status === 'idle' ? connect : undefined}
            disabled={!['idle', 'error'].includes(status)}
            className="flex-1"
          >
            {status === 'connecting' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
            {status === 'connecting' ? '连接中...' : status === 'error' ? '重连' : '连接语音'}
          </Button>

          {status === 'ready' && (
            <Button onClick={sendVoiceMessage} variant="danger" className="flex-1">
              <Mic className="h-4 w-4" />
              按住说话
            </Button>
          )}

          {(status === 'thinking' || status === 'speaking') && (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] py-3 text-center text-sm font-medium text-[var(--color-warning-strong)]">
              {status === 'thinking' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4 animate-pulse" />}
              {status === 'thinking' ? 'AI思考中...' : 'AI说话中...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 工具: Web Speech API 转写
function transcribeAudio(audioBlob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!recognition) {
      resolve('');
      return;
    }

    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.onloadedmetadata = () => {
      const recognizer = new recognition();
      recognizer.continuous = false;
      recognizer.interimResults = false;
      recognizer.lang = 'zh-CN';

      recognizer.onresult = (event) => {
        resolve(event.results[0][0].transcript);
      };
      recognizer.onerror = () => resolve('');
      recognizer.onend = () => resolve('');
      recognizer.start();

      setTimeout(() => {
        recognizer.stop();
        URL.revokeObjectURL(audioUrl);
      }, 10000);
    };
    audio.onerror = () => resolve('');
  });
}
