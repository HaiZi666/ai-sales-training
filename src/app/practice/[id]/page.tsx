'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SCORING_CONFIG, DialogNode, NODE_ORDER } from '@/types';

interface Message {
  id: string;
  role: 'ai' | 'sales';
  content: string;
  node: DialogNode;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
            aiOpeningMessage: '',
          });
          setCurrentNode(data.session.currentNode);
          
          // 添加开场白
          if (data.session.aiOpeningMessage) {
            setMessages([{
              id: '1',
              role: 'ai',
              content: data.session.aiOpeningMessage,
              node: '开场',
            }]);
          }
        }
      } catch (error) {
        console.error('获取会话失败:', error);
      }
    };

    initSession();
  }, [sessionId]);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading || !sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'sales',
      content: inputText,
      node: currentNode,
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setNodeScore(null);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, node: currentNode }),
      });

      const data = await res.json();

      if (data.aiMessage) {
        const aiMessage: Message = {
          id: data.aiMessageId,
          role: 'ai',
          content: data.aiMessage,
          node: data.nextNode as DialogNode,
        };
        setMessages(prev => [...prev, aiMessage]);
        setCurrentNode(data.nextNode as DialogNode);
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

  const handleEnd = async () => {
    if (!sessionId) return;
    
    try {
      await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST' });
      router.push(`/practice/${sessionId}/report`);
    } catch (error) {
      console.error('结束会话失败:', error);
    }
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
          <button
            onClick={handleEnd}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            结束演练
          </button>
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
                <div className="text-sm opacity-70 mb-1">
                  {msg.role === 'sales' ? '你' : 'AI家长'}
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
          
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="bg-white border-t p-4">
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
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading || isFinished}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              发送
            </button>
          </div>
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
