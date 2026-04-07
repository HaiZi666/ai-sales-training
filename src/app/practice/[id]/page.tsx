'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { textToSpeech } from '@/lib/minimax';
import { SCORING_CONFIG, DialogNode, NODE_ORDER } from '@/types';

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

export default function PracticeSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const voice = useVoiceRecording();

  useEffect(() => {
    params.then(p => setSessionId(p.id));
  }, [params]);

  // 初始化会话
  useEffect(() => {
    if (!sessionId) return;

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
            
            // 自动播放开场白
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
  }, [sessionId, isVoiceMode]);

  // 自动滚动
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
        
        // 语音模式下生成TTS
        if (isVoiceMode) {
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
        
        // 自动播放AI回复
        if (isVoiceMode && audioUrl) {
          const audio = new Audio(audioUrl);
          audio.onplay = () => setAiSpeaking(true);
          audio.onended = () => setAiSpeaking(false);
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

  // 语音录制结束处理
  const handleRecordingComplete = async () => {
    const blob = await voice.stopRecording();
    if (blob && sessionId) {
      // 语音转文字 - 简单处理，使用Web Speech API
      const text = await transcribeAudio(blob);
      if (text) {
        await handleSend(text);
      }
    }
  };

  // 使用Web Speech API进行语音识别
  const transcribeAudio = async (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      // 简单的语音识别，使用浏览器原生API
      const recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!recognition) {
        console.warn('浏览器不支持语音识别');
        resolve('');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        // 创建音频元素用于验证
        const audio = new Audio(reader.result as string);
        audio.onloadedmetadata = () => {
          // 提示用户开始说话
          console.log('准备语音识别...');
        };
      };
      reader.readAsDataURL(blob);
      
      // 使用语音识别
      const recognizer = new recognition();
      recognizer.continuous = false;
      recognizer.interimResults = false;
      recognizer.lang = 'zh-CN';
      
      recognizer.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        resolve(text);
      };
      
      recognizer.onerror = (event: any) => {
        console.error('语音识别错误:', event.error);
        resolve('');
      };
      
      recognizer.start();
      
      // 设置超时
      setTimeout(() => {
        recognizer.stop();
      }, 10000);
    });
  };

  // 处理语音按钮点击
  const handleVoiceButton = async () => {
    if (voice.isRecording) {
      await handleRecordingComplete();
    } else {
      await voice.startRecording();
    }
  };

  // 播放AI语音
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

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 左侧：对话区域 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部栏 */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">
              {session?.customerType} · {session?.customerScore} · {session?.customerSubject}
            </h2>
            <p className="text-gray-500 text-sm">当前节点：{currentNode}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* 语音模式切换 */}
            <button
              onClick={() => setIsVoiceMode(!isVoiceMode)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                isVoiceMode 
                  ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {isVoiceMode ? '🔊' : '🎤'} {isVoiceMode ? '语音模式' : '文字模式'}
            </button>
            <button
              onClick={handleEnd}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              结束演练
            </button>
          </div>
        </div>

        {/* 进度条 */}
        <div className="bg-white px-6 py-2 border-b">
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'sales' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xl px-4 py-3 rounded-2xl ${
                  msg.role === 'sales'
                    ? 'bg-blue-500 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm shadow-sm'
                }`}
              >
                <div className="text-sm opacity-70 mb-1 flex items-center gap-2">
                  <span>{msg.role === 'sales' ? '你' : 'AI家长'}</span>
                  {msg.role === 'ai' && msg.audioUrl && isVoiceMode && (
                    <button
                      onClick={() => handlePlayAudio(msg.id, msg.audioUrl!)}
                      className={`px-2 py-0.5 rounded text-xs ${
                        playingAudioId === msg.id 
                          ? 'bg-blue-100 text-blue-600' 
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {playingAudioId === msg.id && voice.isPlaying ? '⏸ 暂停' : '▶ 播放'}
                    </button>
                  )}
                </div>
                <div>{msg.content}</div>
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

        {/* 错误提示 */}
        {voice.error && (
          <div className="mx-6 mb-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {voice.error}
          </div>
        )}

        {/* 输入区域 */}
        <div className="bg-white border-t p-4">
          {isVoiceMode ? (
            /* 语音模式 */
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleVoiceButton}
                  disabled={isLoading || isFinished}
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all ${
                    voice.isRecording
                      ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-200'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  } ${isLoading || isFinished ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {voice.isRecording ? '⏹' : '🎤'}
                </button>
              </div>
              
              {voice.isRecording && (
                <div className="text-center">
                  <div className="text-red-500 font-medium animate-pulse">
                    录音中... {formatDuration(voice.duration)}
                  </div>
                  <div className="text-gray-500 text-sm mt-1">
                    请说话，然后点击停止
                  </div>
                </div>
              )}
              
              {!voice.isRecording && !isLoading && (
                <div className="text-gray-500 text-sm">
                  点击麦克风开始说话
                </div>
              )}
            </div>
          ) : (
            /* 文字模式 */
            <div className="flex gap-3">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="输入你的回复..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading || isFinished}
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputText.trim() || isLoading || isFinished}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                发送
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 右侧：评分面板 */}
      <div className="w-80 bg-white border-l overflow-y-auto">
        <div className="p-6">
          <h3 className="font-semibold text-lg mb-4">实时评分</h3>
          
          {/* 当前节点 */}
          <div className="mb-6">
            <div className="text-sm text-gray-500 mb-2">当前节点</div>
            <div className="flex flex-wrap gap-2">
              {NODE_ORDER.map((node, i) => (
                <div
                  key={node}
                  className={`px-3 py-1 rounded-full text-sm ${
                    i <= currentNodeIndex
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {node}
                </div>
              ))}
            </div>
          </div>

          {/* 本轮评分 */}
          {nodeScore && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{nodeScore.node}</span>
                <span className="text-lg font-bold text-blue-600">
                  {nodeScore.score}/{nodeScore.maxScore}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{nodeScore.feedback}</p>
              {nodeScore.suggestions.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-1">改进建议：</div>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {nodeScore.suggestions.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 评分维度 */}
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
                    <span className="text-sm text-gray-500">
                      {latestScore ? `${latestScore.score}/` : '0/'}{config.maxScore}
                    </span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{
                        width: latestScore
                          ? `${(latestScore.score / config.maxScore) * 100}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
