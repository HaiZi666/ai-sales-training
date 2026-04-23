'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BarChart3, LoaderCircle, Mic, Pause, Play, Send, Volume2, X } from 'lucide-react';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { textToSpeech } from '@/lib/minimax';
import { DialogNode, NODE_ORDER, type ParentType } from '@/types';
import RealtimeRoom from './RealtimeRoom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { Progress } from '@/components/ui/progress';
import { SegmentedControl } from '@/components/ui/segmented-control';

interface Message {
  id: string;
  role: 'ai' | 'sales';
  content: string;
  node: DialogNode;
  audioUrl?: string;
}

interface NodeScore {
  node: DialogNode;
  score: number;
  maxScore: number;
  feedback: string;
  suggestions: string[];
}

interface Session {
  id: string;
  customerType: string;
  customerScore: string;
  customerSubject: string;
  currentNode: DialogNode;
  aiOpeningMessage: string;
  aiOpeningAudio?: string;
  parentType?: ParentType;
  voiceMode?: boolean;
}

type Mode = 'text' | 'voice' | 'realtime';

// 展示弹窗的最大次数
const MAX_SHOW_END_CONFIRM_DIALOG_COUNT = 10;

export default function PracticeSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentNode, setCurrentNode] = useState<DialogNode>('开场');
  const [, setNodeScore] = useState<NodeScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [scores, setScores] = useState<NodeScore[]>([]);
  const [mode, setMode] = useState<Mode>('text');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [showScorePanel, setShowScorePanel] = useState(false);
  const [showEndConfirmDialog, setShowEndConfirmDialog] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isVoiceTranscribing, setIsVoiceTranscribing] = useState(false);
  const hasShownTenRoundDialog = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** 静音自动结束录音时，回调可能在数秒后执行，需始终调用最新的发送逻辑 */
  const handleSendRef = useRef<(textToSend?: string) => Promise<void>>(async () => {});
  const sessionIdRef = useRef<string | null>(null);
  const hasInitializedModeRef = useRef(false);

  const voice = useVoiceRecording();
  const [voiceTranscribeHint, setVoiceTranscribeHint] = useState<string | null>(null);

  useEffect(() => {
    params.then(p => setSessionId(p.id));
  }, [params]);

  sessionIdRef.current = sessionId;

  // 初始化会话
  useEffect(() => {
    if (!sessionId || mode === 'realtime') return;

    const initSession = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        const data = await res.json();

        if (data.session) {
          if (!hasInitializedModeRef.current) {
            setMode(data.session.voiceMode ? 'voice' : 'text');
            hasInitializedModeRef.current = true;
          }

          setSession({
            id: data.session.id,
            customerType: data.session.customerType,
            customerScore: data.session.customerScore,
            customerSubject: data.session.customerSubject,
            currentNode: data.session.currentNode,
            aiOpeningMessage: data.session.aiOpeningMessage || '',
            aiOpeningAudio: data.session.aiOpeningAudio,
            parentType: data.session.parentType,
            voiceMode: data.session.voiceMode,
          });
          setCurrentNode(data.session.currentNode);

          // 加载完整对话历史
          if (data.session.messages && data.session.messages.length > 0) {
            const loadedMessages: Message[] = data.session.messages.map((m: {
              id: string;
              role: 'ai' | 'sales';
              content: string;
              node: DialogNode;
              audioUrl?: string;
            }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              node: m.node,
              audioUrl: m.audioUrl,
            }));
            setMessages(loadedMessages);
          } else if (data.session.aiOpeningMessage) {
            // 如果没有历史消息，只有开场白
            const audioUrl = data.session.aiOpeningAudio;
            const openingMsg: Message = {
              id: '1',
              role: 'ai',
              content: data.session.aiOpeningMessage,
              node: '开场',
              audioUrl: audioUrl || undefined,
            };
            setMessages([openingMsg]);

            if (audioUrl) {
              const audio = new Audio(audioUrl);
              audio.onplay = () => setAiSpeaking(true);
              audio.onended = () => setAiSpeaking(false);
              audio.play();
            }
          }
        }
      } catch (error) {
        console.error('获取会话失败:', error);
      }
    };

    initSession();
  }, [sessionId, mode]);

  // 实时模式未走上方 initSession，需单独拉取会话元数据（含 parentType）供 RealtimeRoom 使用
  useEffect(() => {
    if (!sessionId || mode !== 'realtime') return;

    const loadMeta = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        const data = await res.json();
        if (!data.session) return;
        setSession({
          id: data.session.id,
          customerType: data.session.customerType,
          customerScore: data.session.customerScore,
          customerSubject: data.session.customerSubject,
          currentNode: data.session.currentNode,
          aiOpeningMessage: data.session.aiOpeningMessage || '',
          aiOpeningAudio: data.session.aiOpeningAudio,
          parentType: data.session.parentType,
          voiceMode: data.session.voiceMode,
        });
        setCurrentNode(data.session.currentNode);
      } catch (e) {
        console.error('获取会话元数据失败:', e);
      }
    };

    loadMeta();
  }, [sessionId, mode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isLoading || !sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'sales',
      content: text,
      node: currentNode,
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setNodeScore(null);
    voice.stopPlaying();
    voice.stopRecording();

    try {
      const res = await fetch(`/api/sessions/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, node: currentNode }),
      });

      const data = await res.json();

      if (data.aiMessage) {
        let audioUrl: string | undefined;

        if (mode === 'voice') {
          setAiSpeaking(true);
          audioUrl = await textToSpeech(data.aiMessage) || undefined;
          setAiSpeaking(false);
        }

        const aiMessage: Message = {
          id: data.aiMessageId || (Date.now() + 1).toString(),
          role: 'ai',
          content: data.aiMessage,
          node: data.nextNode as DialogNode,
          audioUrl,
        };
        setMessages(prev => [...prev, aiMessage]);
        setCurrentNode(data.nextNode as DialogNode);

        if (mode === 'voice' && audioUrl) {
          const audio = new Audio(audioUrl);
          audio.onplay = () => setAiSpeaking(true);
          audio.onended = () => {
            setAiSpeaking(false);
            setPlayingAudioId(null);
          };
          audio.onerror = () => {
            setAiSpeaking(false);
            setPlayingAudioId(null);
          };
          setPlayingAudioId(aiMessage.id);
          audio.play();
        }
      }

      if (data.nodeScore) {
        setNodeScore(data.nodeScore);
        setScores(prev => {
          const exists = prev.find(s => s.node === data.nodeScore.node);
          if (exists) {
            return prev.map(s => s.node === data.nodeScore.node ? data.nodeScore : s);
          }
          return [...prev, data.nodeScore];
        });
      }

      if (data.isFinished) {
        setIsFinished(true);
      }

      // 10 轮对话后弹出确认弹窗（仅触发一次）
      setMessages(prev => {
        const userCount = prev.filter(m => m.role === 'sales').length;
        if (userCount >= MAX_SHOW_END_CONFIRM_DIALOG_COUNT && !hasShownTenRoundDialog.current) {
          hasShownTenRoundDialog.current = true;
          setShowEndConfirmDialog(true);
        }
        return prev;
      });
    } catch (error) {
      console.error('发送消息失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  handleSendRef.current = handleSend;

  /** blob → base64（去掉 data:xxx;base64, 前缀） */
  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const transcribeAudio = async (blob: Blob): Promise<{ text: string; error?: string }> => {
    try {
      const base64Data = await blobToBase64(blob);
      const format = blob.type?.includes('mp4') ? 'mp4' : blob.type?.includes('ogg') ? 'ogg' : 'webm';
      const res = await fetch('/api/speech-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Data, format }),
      });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) {
        return {
          text: '',
          error: data.error || (res.status === 422 ? '未识别到文字，请再说一次' : `识别失败（${res.status}）`),
        };
      }
      return { text: (data.text || '').trim() };
    } catch {
      return { text: '', error: '网络异常，识别失败' };
    }
  };

  /** 录音 Blob → 转写 → 发送（手动停止与静音自动停止共用） */
  const processVoiceBlob = async (blob: Blob | null) => {
    setVoiceTranscribeHint(null);
    if (!sessionIdRef.current) {
      setVoiceTranscribeHint('会话未就绪，请稍后再试');
      return;
    }
    if (!blob) {
      setVoiceTranscribeHint('未获取到录音，请重试');
      return;
    }
    if (blob.size === 0) {
      setVoiceTranscribeHint('录音数据为空，请重试');
      return;
    }
    setIsVoiceTranscribing(true);
    try {
      const { text, error } = await transcribeAudio(blob);
      if (error) {
        setVoiceTranscribeHint(error);
        return;
      }
      if (!text) {
        setVoiceTranscribeHint('未识别到文字，请再说一次或使用文字输入');
        return;
      }
      setIsVoiceTranscribing(false);
      await handleSendRef.current(text);
    } finally {
      setIsVoiceTranscribing(false);
    }
  };

  const handleRecordingComplete = async () => {
    const blob = await voice.stopRecording();
    await processVoiceBlob(blob);
  };

  const handleVoiceButton = async () => {
    if (voice.isRecording) {
      await handleRecordingComplete();
    } else {
      setVoiceTranscribeHint(null);
      await voice.startRecording({
        autoStopOnSilence: {
          silenceDurationMs: 1400,
          amplitudeThreshold: 0.014,
          minRecordingMs: 500,
          onComplete: blob => processVoiceBlob(blob),
        },
      });
    }
  };

  const handlePlayAudio = (msgId: string, audioUrl: string) => {
    if (playingAudioId === msgId && voice.isPlaying) {
      voice.stopPlaying();
      setPlayingAudioId(null);
    } else {
      voice.stopPlaying();
      voice.playAudio(audioUrl);
      setPlayingAudioId(msgId);
    }
  };

  const handleEnd = async () => {
    if (!sessionId || isEnding) return;
    setIsEnding(true);
    voice.stopPlaying();
    voice.stopRecording();
    try {
      // /end 仅做快速的会话状态标记，不再阻塞在 LLM 评分上
      await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST' });
      router.push(`/practice/${sessionId}/report`);
    } catch (error) {
      console.error('结束会话失败:', error);
      setIsEnding(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentNodeIndex = NODE_ORDER.indexOf(currentNode);
  const progress = ((currentNodeIndex + 1) / NODE_ORDER.length) * 100;

  // ============================================================
  // 实时语音模式
  // ============================================================
  if (mode === 'realtime') {
    return (
      <RealtimeRoom
        sessionId={sessionId || ''}
        apiKey="sk-api-tnuzXAAWKSNX6y8v_JFZJAMYysyc6f_fG90eso0Mu0n8iglsRZ5W05CauspootmNprw6_Pf3T1geyHTlA-uMJF74znoUZ5LCHOVitE642SHm3Z-aseOcozQ"
        customerType={session?.customerType || ''}
        customerScore={session?.customerScore || ''}
        customerSubject={session?.customerSubject || ''}
        parentType={session?.parentType}
        currentNode={currentNode}
        onNodeChange={setCurrentNode}
        onFinish={handleEnd}
      />
    );
  }

  // ============================================================
  // 文字 / 语音模式
  // ============================================================
  return (
    <div className="safe-area-top flex h-screen flex-col bg-[var(--color-bg)]">
      {/* 顶部栏 */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border-soft)] bg-white/88 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/practice/new" className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-fill-soft)]">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-[var(--color-text)]">AI 陪练会话</div>
            <div className="mt-1">
              <Badge variant="brand">{currentNode}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 模式切换 */}
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { value: 'text', label: '文字' },
              { value: 'voice', label: '语音' },
            ]}
            className="inline-flex"
          />
          <Button variant={showScorePanel ? 'secondary' : 'ghost'} size="sm" onClick={() => setShowScorePanel(!showScorePanel)}>
            <BarChart3 className="h-4 w-4" />
          </Button>
          <Button onClick={handleEnd} disabled={isEnding} variant="danger" size="sm">
            {isEnding ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
            {isEnding ? '结束中' : '结束'}
          </Button>
        </div>
      </div>

      <div className="border-b border-[var(--color-border-soft)] bg-white px-4 py-3">
        <div className="mx-auto max-w-4xl">
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
            <span>当前节点：{currentNode}</span>
            <span>
              {currentNodeIndex + 1} / {NODE_ORDER.length}
            </span>
          </div>
          <Progress value={progress} />
        </div>
      </div>

      {/* 消息列表 */}
      <div className="hide-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'sales' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-[22px] px-4 py-3 ${msg.role === 'sales' ? 'rounded-br-sm bg-[linear-gradient(135deg,var(--color-brand-from),var(--color-brand-to))] text-white shadow-[var(--shadow-button)]' : 'rounded-bl-sm border border-[var(--color-border-soft)] bg-white text-[var(--color-text)] shadow-[var(--shadow-card)]'}`}>
              <div className="mb-1 flex items-center gap-2 text-xs opacity-70">
                <span>{msg.role === 'sales' ? '你' : 'AI'}</span>
                {msg.role === 'ai' && msg.audioUrl && mode === 'voice' && (
                  <button
                    onClick={() => handlePlayAudio(msg.id, msg.audioUrl!)}
                    className={`rounded-full px-2 py-0.5 text-xs ${playingAudioId === msg.id ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]' : 'bg-[var(--color-fill-soft)] text-[var(--color-text-secondary)]'}`}
                  >
                    {playingAudioId === msg.id && voice.isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </button>
                )}
              </div>
              <div className="text-sm leading-relaxed">{msg.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-[22px] rounded-bl-sm border border-[var(--color-border-soft)] bg-white px-4 py-3 shadow-[var(--shadow-card)]">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        {isVoiceTranscribing && (
          <div className="flex justify-end">
            <div className="rounded-[22px] rounded-br-sm bg-[linear-gradient(135deg,var(--color-brand-from),var(--color-brand-to))] px-4 py-3 shadow-[var(--shadow-button)]">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-white/90 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-white/90 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-white/90 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        {aiSpeaking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-full bg-[var(--color-brand-soft)] px-4 py-2 text-sm text-[var(--color-brand-strong)]">
              <Volume2 className="h-4 w-4 animate-pulse" />
              AI正在说话...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {voice.error && (
        <div className="mx-4 mb-2 rounded-[var(--radius-lg)] border border-[rgba(239,68,68,0.16)] bg-[var(--color-danger-soft)] px-4 py-2 text-sm text-[var(--color-danger)]">
          {voice.error}
        </div>
      )}
      {voiceTranscribeHint && (
        <div className="mx-4 mb-2 rounded-[var(--radius-lg)] border border-[rgba(245,158,11,0.18)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm text-[var(--color-warning-strong)]">
          {voiceTranscribeHint}
        </div>
      )}

      {/* 输入区域 */}
      <div className="shrink-0 border-t border-[var(--color-border-soft)] bg-white/92 p-4 backdrop-blur-xl">
        {mode === 'voice' ? (
          <div className="flex flex-col items-center gap-3">
            <Button
              onClick={handleVoiceButton}
              disabled={isLoading || isFinished || isVoiceTranscribing}
              className={`h-20 w-20 rounded-full text-white ${
                voice.isRecording
                  ? 'bg-[var(--color-danger)] shadow-[0_24px_40px_-24px_rgba(239,68,68,0.6)]'
                  : ''
              } ${isLoading || isFinished || isVoiceTranscribing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {voice.isRecording ? <Pause className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
            </Button>
            {voice.isRecording && (
              <div className="text-center">
                <div className="text-sm font-medium text-[var(--color-danger)]">录音中... {formatDuration(voice.duration)}</div>
                <div className="mt-1 text-xs text-[var(--color-text-secondary)]">说完停顿约 1.5 秒将自动转文字并发送，也可点击停止立即发送</div>
              </div>
            )}
            {!voice.isRecording && !isLoading && !isVoiceTranscribing && (
              <div className="px-2 text-center text-sm text-[var(--color-text-secondary)]">点击麦克风说话，停顿后自动发送</div>
            )}
            {isVoiceTranscribing && (
              <div className="px-2 text-center text-sm text-[var(--color-text-secondary)]">正在识别语音...</div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="输入你的回复..."
              className="flex-1"
              disabled={isLoading || isFinished}
            />
            <Button onClick={() => handleSend()} disabled={!inputText.trim() || isLoading || isFinished} className="px-5">
              <Send className="h-4 w-4" />
              发送
            </Button>
          </div>
        )}
      </div>

      {/* 评分面板 - 显示历史对话总结评分 */}
      {showScorePanel && (
        <>
          <div className="fixed inset-0 z-40 bg-[rgba(15,23,42,0.4)]" onClick={() => setShowScorePanel(false)} />
          <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-[28px] border border-white/70 bg-white">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--color-border-soft)] bg-white/96 px-4 py-3 backdrop-blur-xl">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">对话评分总结</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowScorePanel(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              {/* 综合评分展示 */}
              <div className="mb-4 rounded-[20px] bg-[linear-gradient(135deg,rgba(238,235,255,0.95),rgba(232,241,255,0.95))] p-4">
                <div className="text-center">
                  <div className="mb-1 text-sm text-[var(--color-text-secondary)]">综合评分</div>
                  <div className="text-4xl font-bold text-[var(--color-brand-strong)]">
                    {scores.length > 0 
                      ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
                      : '--'
                    }
                    <span className="text-lg text-[var(--color-text-muted)]">/15</span>
                  </div>
                  <div className="mt-1 text-sm text-[var(--color-text-secondary)]">共 {scores.length} 次评价</div>
                </div>
              </div>

              {/* 最佳/最差表现 */}
              {scores.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-[18px] bg-[var(--color-success-soft)] p-3">
                    <div className="mb-1 text-xs text-[var(--color-success-strong)]">最佳表现</div>
                    <div className="text-lg font-bold text-green-700">
                      {Math.max(...scores.map(s => s.score))}分
                    </div>
                  </div>
                  <div className="rounded-[18px] bg-[var(--color-danger-soft)] p-3">
                    <div className="mb-1 text-xs text-[var(--color-danger-strong)]">最差表现</div>
                    <div className="text-lg font-bold text-red-700">
                      {Math.min(...scores.map(s => s.score))}分
                    </div>
                  </div>
                </div>
              )}

              {/* 最近一次评分详情 */}
              {scores.length > 0 && scores[scores.length - 1] && (
                <div className="mb-4 rounded-[18px] bg-[var(--color-fill-soft)] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--color-text)]">最近评价</span>
                    <span className="text-lg font-bold text-[var(--color-brand-strong)]">
                      {scores[scores.length - 1].score}/{scores[scores.length - 1].maxScore}
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-[var(--color-text-secondary)]">{scores[scores.length - 1].feedback}</p>
                  {scores[scores.length - 1].suggestions.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 text-xs text-[var(--color-text-muted)]">改进建议：</div>
                      <ul className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                        {scores[scores.length - 1].suggestions.map((s, i) => <li key={i}>• {s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 所有改进建议 */}
              {scores.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-medium text-[var(--color-text)]">全部改进建议</div>
                  <div className="space-y-2">
                    {Array.from(new Set(scores.flatMap(s => s.suggestions))).slice(0, 5).map((suggestion, i) => (
                      <div key={i} className="rounded-[16px] bg-[var(--color-warning-soft)] px-3 py-2 text-xs text-[var(--color-warning-strong)]">
                        • {suggestion}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scores.length === 0 && (
                <div className="py-8 text-center text-[var(--color-text-secondary)]">
                  暂无评分数据，继续对话后会自动评分
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <Dialog
        open={showEndConfirmDialog}
        onClose={() => setShowEndConfirmDialog(false)}
        title={`已进行 ${MAX_SHOW_END_CONFIRM_DIALOG_COUNT} 轮对话`}
        description="本次沟通是否已经结束？"
        footer={
          <>
            <Button
              className="flex-1"
              onClick={() => {
                setShowEndConfirmDialog(false);
                handleEnd();
              }}
              disabled={isEnding}
            >
              {isEnding ? '正在结束...' : '已结束，查看评分报告'}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setShowEndConfirmDialog(false)}>
              继续对话
            </Button>
          </>
        }
      />
    </div>
  );
}
