'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { textToSpeech } from '@/lib/minimax';
import { SCORING_CONFIG, DialogNode, NODE_ORDER } from '@/types';
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
}

type Mode = 'text' | 'voice' | 'realtime';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const voice = useVoiceRecording();

  useEffect(() => {
    params.then(p => setSessionId(p.id));
  }, [params]);

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
          });
          setCurrentNode(data.session.currentNode);

          if (data.session.aiOpeningMessage) {
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
    } catch (error) {
      console.error('发送消息失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordingComplete = async () => {
    const blob = await voice.stopRecording();
    if (blob && sessionId) {
      const text = await transcribeAudio(blob);
      if (text) {
        await handleSend(text);
      }
    }
  };

  const transcribeAudio = async (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!recognition) {
        resolve('');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const audio = new Audio(reader.result as string);
        audio.onloadedmetadata = () => {};
      };
      reader.readAsDataURL(blob);

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
  };

  const handleVoiceButton = async () => {
    if (voice.isRecording) {
      await handleRecordingComplete();
    } else {
      await voice.startRecording();
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
    if (!sessionId) return;
    voice.stopPlaying();
    voice.stopRecording();
    try {
      await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST' });
      router.push(`/practice/${sessionId}/report`);
    } catch (error) {
      console.error('结束会话失败:', error);
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
          <div>
            <h2 className="font-semibold text-base">{session?.customerType} · {session?.customerScore}</h2>
            <p className="text-gray-500 text-xs">当前：{currentNode}</p>
          </div>
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
          <button onClick={handleEnd} className="px-3 py-2 bg-red-500 text-white text-sm rounded-lg active:bg-red-600">
            结束
          </button>
        </div>
      </div>

      {/* 进度条 */}
      <div className="bg-white px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-gray-500 shrink-0">{Math.round(progress)}%</span>
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

      {/* 输入区域 */}
      <div className="bg-white border-t p-4 safe-area-bottom shrink-0">
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
                <div className="text-gray-500 text-xs mt-1">点击停止发送</div>
              </div>
            )}
            {!voice.isRecording && !isLoading && (
              <div className="text-gray-500 text-sm">点击麦克风开始说话</div>
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

      {/* 评分面板 */}
      {showScorePanel && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowScorePanel(false)} />
          <div className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl z-50 max-h-[70vh] overflow-y-auto safe-area-bottom">
            <div className="sticky top-0 bg-white px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg">实时评分</h3>
              <button onClick={() => setShowScorePanel(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-2">当前节点</div>
                <div className="flex flex-wrap gap-2">
                  {NODE_ORDER.map((node, i) => (
                    <div key={node} className={`px-3 py-1 rounded-full text-sm ${i <= currentNodeIndex ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {node}
                    </div>
                  ))}
                </div>
              </div>

              {nodeScore && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{nodeScore.node}</span>
                    <span className="text-lg font-bold text-blue-600">{nodeScore.score}/{nodeScore.maxScore}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{nodeScore.feedback}</p>
                  {nodeScore.suggestions.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs text-gray-500 mb-1">改进建议：</div>
                      <ul className="text-xs text-gray-600 space-y-1">
                        {nodeScore.suggestions.map((s, i) => <li key={i}>• {s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700">评分维度</div>
                {NODE_ORDER.map(node => {
                  const config = SCORING_CONFIG[node];
                  const nodeScores = scores.filter(s => s.node === node);
                  const latestScore = nodeScores[nodeScores.length - 1];
                  return (
                    <div key={node} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{node}</span>
                        <span className="text-sm text-gray-500">{latestScore ? `${latestScore.score}/` : '0/'}{config.maxScore}</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all"
                          style={{ width: latestScore ? `${(latestScore.score / config.maxScore) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
