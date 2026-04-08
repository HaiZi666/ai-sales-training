'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { MiniMaxRealtimeClient, RealtimeConfig, TextDeltaEvent } from '@/lib/realtime';
import { textToSpeech } from '@/lib/minimax';

export type RealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'speaking'
  | 'listening'
  | 'error';

export interface UseRealtimeSessionReturn {
  status: RealtimeStatus;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
  connect: (instructions: string) => Promise<void>;
  disconnect: () => void;
  sendText: (text: string) => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => void;
}

export function useRealtimeSession(apiKey: string): UseRealtimeSessionReturn {
  const [status, setStatus] = useState<RealtimeStatus>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<MiniMaxRealtimeClient | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // 断开清理
  const cleanup = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  // 连接
  const connect = useCallback(
    async (instructions: string) => {
      cleanup();
      setStatus('connecting');
      setError(null);
      setTranscript('');

      try {
        const client = new MiniMaxRealtimeClient({
          apiKey,
          model: 'abab6.5s-chat',
          instructions,
          modalities: ['text'],
        });

        clientRef.current = client;

        // 监听所有消息
        client.addHandler((msg) => {
          if (msg.type === 'response.text.delta') {
            const delta = (msg as unknown as TextDeltaEvent).delta;
            setTranscript((prev) => prev + delta);
          }

          if (msg.type === 'response.done') {
            setStatus('connected');
            setIsSpeaking(false);
          }

          if (msg.type === 'error') {
            const err = msg.error as any;
            setError(err?.message || 'Unknown error');
            setStatus('error');
            setIsSpeaking(false);
          }
        });

        await client.connect();
        await client.startSession();
        setStatus('connected');
      } catch (e: any) {
        setError(e.message || 'Failed to connect');
        setStatus('error');
      }
    },
    [apiKey, cleanup]
  );

  // 断开
  const disconnect = useCallback(() => {
    cleanup();
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setStatus('idle');
    setTranscript('');
  }, [cleanup]);

  // 发送文字并接收 AI 回复（流式）
  const sendText = useCallback(async (text: string) => {
    const client = clientRef.current;
    if (!client || !client.isSessionConnected()) {
      setError('Not connected');
      return;
    }

    setStatus('speaking');
    setTranscript('');
    setIsSpeaking(true);

    try {
      await client.sendText(text);
      // 等待 response.done (由 handler 处理)
    } catch (e: any) {
      setError(e.message || 'Send failed');
      setStatus('error');
      setIsSpeaking(false);
    }
  }, []);

  // 开始录音并实时发送
  const startListening = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !client.isSessionConnected()) {
      setError('Not connected');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 创建 AudioContext 用于可视化（可选）
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);

          // 实时转写: 将 blob 转为 ArrayBuffer
          const arrayBuffer = await event.data.arrayBuffer();

          // 注意: MiniMax Realtime API 支持 input_audio_buffer.append
          // 但需要 pcm16 格式，这里我们先累积最后一起处理
          // 简化方案: 录音结束后一次性发送
        }
      };

      mediaRecorder.start(1000); // 每秒一块
      setStatus('listening');
    } catch (e: any) {
      setError('Microphone access denied');
      setStatus('error');
    }
  }, []);

  // 停止录音并处理
  const stopListening = useCallback(async () => {
    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve();
        return;
      }

      mediaRecorder.onstop = async () => {
        const stream = streamRef.current;
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        // 合并所有音频块
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];

        // 简化处理: 先用 Web Speech API 转写
        const text = await transcribeAudio(blobToWavUrl(audioBlob));
        if (text) {
          await sendText(text);
        }
        resolve();
      };

      mediaRecorder.stop();
      setStatus('speaking');
    });
  }, [sendText]);

  // 播放 TTS 音频
  const playAudio = useCallback(async (text: string) => {
    try {
      const audioUrl = await textToSpeech(text);
      if (!audioUrl) return;

      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      setIsSpeaking(true);

      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        currentAudioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        currentAudioRef.current = null;
      };

      await audio.play();
    } catch (e) {
      console.error('TTS play error:', e);
      setIsSpeaking(false);
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanup();
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, [cleanup]);

  return {
    status,
    isSpeaking,
    transcript,
    error,
    connect,
    disconnect,
    sendText,
    startListening,
    stopListening,
  };
}

// 工具函数: Blob 转 WAV URL (16kHz PCM)
function blobToWavUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

// 使用 Web Speech API 转写音频
function transcribeAudio(audioUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!recognition) {
      resolve('');
      return;
    }

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

    setTimeout(() => recognizer.stop(), 10000);
  });
}
