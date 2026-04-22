'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { textToSpeech } from '@/lib/minimax';
import { SCORING_CONFIG, DialogNode, NODE_ORDER, type ParentType } from '@/types';
import RealtimeRoom from './RealtimeRoom';

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
  const [nodeScore, setNodeScore] = useState<NodeScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [scores, setScores] = useState<NodeScore[]>([]);
  const [mode, setMode] = useState<Mode>('text');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [showScorePanel, setShowScorePanel] = useState(false);
  const [showEndConfirmDialog, setShowEndConfirmDialog] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const hasShownTenRoundDialog = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** 静音自动结束录音时，回调可能在数秒后执行，需始终调用最新的发送逻辑 */
  const handleSendRef = useRef<(textToSend?: string) => Promise<void>>(async () => {});
  const sessionIdRef = useRef<string | null>(null);

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
          setSession({
            id: data.session.id,
            customerType: data.session.customerType,
            customerScore: data.session.customerScore,
            customerSubject: data.session.customerSubject,
            currentNode: data.session.currentNode,
            aiOpeningMessage: data.session.aiOpeningMessage || '',
            aiOpeningAudio: data.session.aiOpeningAudio,
            parentType: data.session.parentType,
          });
          setCurrentNode(data.session.currentNode);

          // 加载完整对话历史
          if (data.session.messages && data.session.messages.length > 0) {
            const loadedMessages: Message[] = data.session.messages.map((m: any) => ({
              id: m.id,
              role: m.role as 'ai' | 'sales',
              content: m.content,
              node: m.node as DialogNode,
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
    const { text, error } = await transcribeAudio(blob);
    if (error) {
      setVoiceTranscribeHint(error);
      return;
    }
    if (!text) {
      setVoiceTranscribeHint('未识别到文字，请再说一次或使用文字输入');
      return;
    }
    await handleSendRef.current(text);
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
    <div className="flex flex-col h-screen bg-gray-100 safe-area-top">
      {/* 顶部栏 */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/practice/new" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200">
            <span className="text-gray-600 text-xl">←</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {/* 模式切换 */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['text', 'voice', 'realtime'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === m ? 'bg-white shadow text-blue-600' : 'text-gray-500'
                }`}
              >
                {m === 'text' ? '💬' : m === 'voice' ? '🎤' : '📞'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowScorePanel(!showScorePanel)} className={`px-3 py-2 rounded-lg text-sm transition-colors ${showScorePanel ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
            📊
          </button>
          <button
            onClick={handleEnd}
            disabled={isEnding}
            className={`px-3 py-2 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5 ${isEnding ? 'bg-red-300 cursor-not-allowed' : 'bg-red-500 active:bg-red-600'}`}
          >
            {isEnding && (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isEnding ? '结束中' : '结束'}
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 hide-scrollbar">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'sales' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${msg.role === 'sales' ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm shadow-sm'}`}>
              <div className="text-xs opacity-70 mb-1 flex items-center gap-2">
                <span>{msg.role === 'sales' ? '你' : 'AI'}</span>
                {msg.role === 'ai' && msg.audioUrl && mode === 'voice' && (
                  <button
                    onClick={() => handlePlayAudio(msg.id, msg.audioUrl!)}
                    className={`px-2 py-0.5 rounded text-xs ${playingAudioId === msg.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {playingAudioId === msg.id && voice.isPlaying ? '⏸' : '▶'}
                  </button>
                )}
              </div>
              <div className="text-sm leading-relaxed">{msg.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        {aiSpeaking && (
          <div className="flex justify-start">
            <div className="bg-blue-50 px-4 py-2 rounded-full text-blue-600 text-sm flex items-center gap-2">
              <span className="animate-pulse">🔊</span>
              AI正在说话...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {voice.error && (
        <div className="mx-4 mb-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {voice.error}
        </div>
      )}
      {voiceTranscribeHint && (
        <div className="mx-4 mb-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          {voiceTranscribeHint}
        </div>
      )}

      {/* 输入区域 */}
      <div className="bg-white border-t p-4 shrink-0">
        {mode === 'voice' ? (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleVoiceButton}
              disabled={isLoading || isFinished}
              className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all active:scale-95 ${
                voice.isRecording
                  ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
                  : 'bg-blue-500 text-white active:bg-blue-600'
              } ${isLoading || isFinished ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {voice.isRecording ? '⏹' : '🎤'}
            </button>
            {voice.isRecording && (
              <div className="text-center">
                <div className="text-red-500 font-medium animate-pulse text-sm">录音中... {formatDuration(voice.duration)}</div>
                <div className="text-gray-500 text-xs mt-1">说完停顿约 1.5 秒将自动转文字并发送，也可点击停止立即发送</div>
              </div>
            )}
            {!voice.isRecording && !isLoading && (
              <div className="text-gray-500 text-sm text-center px-2">点击麦克风说话，停顿后自动发送</div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="输入你的回复..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              disabled={isLoading || isFinished}
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isLoading || isFinished}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium active:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              发送
            </button>
          </div>
        )}
      </div>

      {/* 评分面板 - 显示历史对话总结评分 */}
      {showScorePanel && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowScorePanel(false)} />
          <div className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl z-50 max-h-[70vh] overflow-y-auto safe-area-bottom">
            <div className="sticky top-0 bg-white px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg">对话评分总结</h3>
              <button onClick={() => setShowScorePanel(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
            </div>
            <div className="p-4">
              {/* 综合评分展示 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-4">
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-1">综合评分</div>
                  <div className="text-4xl font-bold text-blue-600">
                    {scores.length > 0 
                      ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
                      : '--'
                    }
                    <span className="text-lg text-gray-400">/15</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">共 {scores.length} 次评价</div>
                </div>
              </div>

              {/* 最佳/最差表现 */}
              {scores.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-green-600 mb-1">最佳表现</div>
                    <div className="text-lg font-bold text-green-700">
                      {Math.max(...scores.map(s => s.score))}分
                    </div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs text-red-600 mb-1">最差表现</div>
                    <div className="text-lg font-bold text-red-700">
                      {Math.min(...scores.map(s => s.score))}分
                    </div>
                  </div>
                </div>
              )}

              {/* 最近一次评分详情 */}
              {scores.length > 0 && scores[scores.length - 1] && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">最近评价</span>
                    <span className="text-lg font-bold text-blue-600">
                      {scores[scores.length - 1].score}/{scores[scores.length - 1].maxScore}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{scores[scores.length - 1].feedback}</p>
                  {scores[scores.length - 1].suggestions.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs text-gray-500 mb-1">改进建议：</div>
                      <ul className="text-xs text-gray-600 space-y-1">
                        {scores[scores.length - 1].suggestions.map((s, i) => <li key={i}>• {s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 所有改进建议 */}
              {scores.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">全部改进建议</div>
                  <div className="space-y-2">
                    {Array.from(new Set(scores.flatMap(s => s.suggestions))).slice(0, 5).map((suggestion, i) => (
                      <div key={i} className="text-xs text-gray-600 bg-yellow-50 rounded-lg px-3 py-2">
                        • {suggestion}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scores.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  暂无评分数据，继续对话后会自动评分
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 10 轮对话结束确认弹窗 */}
      {showEndConfirmDialog && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl z-50 shadow-xl overflow-hidden">
            <div className="px-5 pt-6 pb-2 text-center">
              <div className="text-3xl mb-3">💬</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">已进行 {MAX_SHOW_END_CONFIRM_DIALOG_COUNT} 轮对话</h3>
              <p className="text-sm text-gray-500">本次沟通是否已经结束？</p>
            </div>
            <div className="p-4 space-y-2">
              <button
                onClick={() => {
                  setShowEndConfirmDialog(false);
                  handleEnd();
                }}
                disabled={isEnding}
                className={`w-full py-3 text-white rounded-xl font-medium text-base flex items-center justify-center gap-2 ${isEnding ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 active:bg-blue-700'}`}
              >
                {isEnding && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {isEnding ? '正在结束...' : '已结束，查看评分报告'}
              </button>
              <button
                onClick={() => setShowEndConfirmDialog(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-base active:bg-gray-200"
              >
                还没结束，继续对话
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
