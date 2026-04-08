'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MiniMaxRealtimeClient, TextDeltaEvent } from '@/lib/realtime';
import { textToSpeech } from '@/lib/minimax';
import { DialogNode, NODE_ORDER } from '@/types';

interface RealtimeRoomProps {
  sessionId: string;
  apiKey: string;
  customerType: string;
  customerScore: string;
  customerSubject: string;
  currentNode: DialogNode;
  onNodeChange: (node: DialogNode) => void;
  onFinish: () => void;
}

export default function RealtimeRoom({
  sessionId,
  apiKey,
  customerType,
  customerScore,
  customerSubject,
  currentNode,
  onNodeChange,
  onFinish,
}: RealtimeRoomProps) {
  const [status, setStatus] = useState<
    'idle' | 'connecting' | 'ready' | 'listening' | 'thinking' | 'speaking' | 'error'
  >('idle');
  const [messages, setMessages] = useState<{ role: 'ai' | 'sales'; content: string }[]>([]);
  const [transcript, setTranscript] = useState('');
  const [aiText, setAiText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<MiniMaxRealtimeClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isConnectedRef = useRef(false);

  const MINIMAX_API_KEY = apiKey;

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
      const client = new MiniMaxRealtimeClient({
        apiKey: MINIMAX_API_KEY,
        model: 'abab6.5s-chat',
        modalities: ['text'],
        instructions: `你是学生家长的角色，模拟真实对话。
- 孩子成绩类型: ${customerScore}
- 弱科: ${customerSubject}
- 性格: 根据成绩类型设定，${customerScore === '优秀' ? '挑剔、喜欢比较' : customerScore === '较差' ? '焦虑、担心效果' : '犹豫不决、需要案例'}
- 说话自然，口语化，不要太长
- 适当提出质疑，测试销售应对能力`,
      });

      clientRef.current = client;

      client.addHandler((msg) => {
        // 文字增量
        if (msg.type === 'response.text.delta') {
          const delta = (msg as unknown as TextDeltaEvent).delta;
          setAiText((prev) => prev + delta);
        }

        // AI 说话结束
        if (msg.type === 'response.done') {
          setStatus('ready');
          if (aiText) {
            // 播放 AI 回复
            playTTS(aiText);
          }
        }

        // 错误
        if (msg.type === 'error') {
          const err = msg.error as any;
          setError(err?.message || 'Unknown error');
          setStatus('error');
        }
      });

      await client.connect();
      await client.startSession();
      isConnectedRef.current = true;
      setStatus('ready');
    } catch (e: any) {
      setError(e.message || 'Connection failed');
      setStatus('error');
    }
  }, [MINIMAX_API_KEY, customerScore, customerSubject, cleanup, aiText]);

  // 播放 TTS
  const playTTS = async (text: string) => {
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
  };

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
    } catch (e) {
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
    } catch (e: any) {
      setError(e.message);
      setStatus('error');
    }
  };

  // AI 回复到达时添加到消息列表
  useEffect(() => {
    if (aiText && status === 'ready') {
      setMessages((prev) => [...prev, { role: 'ai', content: aiText }]);
      setAiText('');
    }
  }, [aiText, status]);

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
    <div className="flex flex-col h-full bg-gray-50">
      {/* 顶部栏 */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${statusColor}`} />
          <div>
            <div className="font-semibold text-base">
              {customerType} · {customerScore}
            </div>
            <div className="text-gray-500 text-xs">实时语音模式</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={status === 'ready' ? sendVoiceMessage : undefined}
            disabled={!['ready', 'idle'].includes(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === 'ready'
                ? 'bg-red-500 text-white active:bg-red-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            🎤 {status === 'ready' ? '按住说话' : statusText}
          </button>
          <button
            onClick={handleEnd}
            className="px-3 py-2 bg-red-500 text-white text-sm rounded-lg"
          >
            结束
          </button>
        </div>
      </div>

      {/* 当前节点提示 */}
      <div className="bg-white border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">当前节点：</span>
          <span className="text-sm font-medium text-blue-600">{currentNode}</span>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && status === 'ready' && (
          <div className="text-center text-gray-400 text-sm mt-8">
            点击下方按钮开始对话
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'sales' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${
                msg.role === 'sales'
                  ? 'bg-blue-500 text-white rounded-br-sm'
                  : 'bg-white text-gray-800 rounded-bl-sm shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* AI 正在输入 */}
        {aiText && (
          <div className="flex justify-start">
            <div className="bg-white px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-sm text-sm">
              <span className="animate-pulse text-gray-400">AI 输入中...</span>
            </div>
          </div>
        )}
      </div>

      {/* 底部操作 */}
      <div className="bg-white border-t p-4 safe-area-bottom">
        <div className="flex gap-3">
          <button
            onClick={status === 'idle' ? connect : undefined}
            disabled={!['idle', 'error'].includes(status)}
            className={`flex-1 py-3 rounded-xl font-medium text-sm transition-colors ${
              status === 'idle' || status === 'error'
                ? 'bg-blue-600 text-white active:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {status === 'connecting' ? '连接中...' : status === 'error' ? '重连' : '连接语音'}
          </button>

          {status === 'ready' && (
            <button
              onClick={sendVoiceMessage}
              className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium text-sm active:bg-red-600"
            >
              🎤 按住说话
            </button>
          )}

          {(status === 'thinking' || status === 'speaking') && (
            <div className="flex-1 py-3 bg-yellow-100 text-yellow-700 rounded-xl font-medium text-sm text-center animate-pulse">
              {status === 'thinking' ? '🤔 AI思考中...' : '🔊 AI说话中...'}
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
    const recognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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

      recognizer.onresult = (event: any) => {
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
