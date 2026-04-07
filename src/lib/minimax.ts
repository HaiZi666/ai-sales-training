// MiniMax API 配置
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_BASE_URL = 'https://api.minimax.chat/v1';

// 对话生成
export async function generateAIResponse(
  systemPrompt: string,
  conversationHistory: { role: string; content: string }[],
  model: string = 'MiniMax-Text-01'
): Promise<string> {
  if (!MINIMAX_API_KEY) {
    throw new Error('MINIMAX_API_KEY is not configured');
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
  ];

  const response = await fetch(`${MINIMAX_BASE_URL}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// 评分生成
export async function generateScore(
  scoringPrompt: string,
  model: string = 'MiniMax-Text-01'
): Promise<{
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}> {
  if (!MINIMAX_API_KEY) {
    // Fallback for demo - return mock score
    return {
      score: Math.floor(Math.random() * 10) + 5,
      feedback: '（Demo模式：API未配置）',
      strengths: ['话术基本完整'],
      weaknesses: ['需要接入MiniMax API获取真实评分'],
      suggestions: ['请配置MINIMAX_API_KEY环境变量'],
    };
  }

  const messages = [
    { role: 'system', content: '你是一个专业的销售话术评分专家，输出标准JSON格式。' },
    { role: 'user', content: scoringPrompt },
  ];

  const response = await fetch(`${MINIMAX_BASE_URL}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    throw new Error(`MiniMax API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  try {
    // 尝试解析JSON
    return JSON.parse(content);
  } catch {
    // 如果解析失败，返回默认值
    return {
      score: 0,
      feedback: '评分解析失败',
      strengths: [],
      weaknesses: ['格式错误'],
      suggestions: [],
    };
  }
}

// TTS语音合成（预留接口）
export async function textToSpeech(
  text: string
): Promise<string> {
  // MiniMax TTS API 预留
  // 暂不实现，Phase 1使用文字对话
  return '';
}
