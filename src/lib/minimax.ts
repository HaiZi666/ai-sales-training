// MiniMax API 配置
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID || '';
const MINIMAX_BASE_URL = 'https://api.minimax.chat/v1';

// TTS语音合成 - 转换为URL
export async function textToSpeech(
  text: string,
  voiceId: string = 'male-qn-qingse'
): Promise<string> {
  if (!MINIMAX_API_KEY) {
    console.warn('MiniMax API未配置，TTS跳过');
    return '';
  }

  try {
    const response = await fetch(`${MINIMAX_BASE_URL}/t2a_v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'speech-02-hd',
        group_id: MINIMAX_GROUP_ID,
        text,
        stream: false,
        voice_setting: {
          voice_id: voiceId,
        },
        audio_setting: {
          sample_rate: 32000,
          format: 'mp3',
          speed: 1.0,
          volume: 1.0,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status}`);
    }

    const data = await response.arrayBuffer();
    // 将音频转换为base64或blob URL
    const blob = new Blob([data], { type: 'audio/mp3' });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('TTS error:', error);
    return '';
  }
}

// STT语音识别 - 将音频文件发送到服务器转文字
export async function speechToText(
  audioBlob: Blob
): Promise<string> {
  if (!MINIMAX_API_KEY) {
    console.warn('MiniMax API未配置，STT跳过');
    return '';
  }

  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', 'speech-01');

    const response = await fetch(`${MINIMAX_BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`STT API error: ${response.status}`);
    }

    const data = await response.json();
    return data.text || '';
  } catch (error) {
    console.error('STT error:', error);
    return '';
  }
}

// 对话生成
export async function generateAIResponse(
  systemPrompt: string,
  conversationHistory: { role: string; content: string }[],
  model: string = 'abab6.5s-chat'
): Promise<string> {
  if (!MINIMAX_API_KEY) {
    // Demo模式 - 返回模拟回复
    return generateDemoResponse(conversationHistory);
  }

  // 转换角色：sales->user, ai->assistant (MiniMax只支持这三种角色)
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({
      role: m.role === 'sales' ? 'user' : 'assistant',
      content: m.content,
    })),
  ];

  const response = await fetch(`${MINIMAX_BASE_URL}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      group_id: MINIMAX_GROUP_ID,
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`MiniMax API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Demo模式回复（按对话轮次模拟真实家长节奏）
function generateDemoResponse(history: { role: string; content: string }[]): string {
  const lastMessage = (history[history.length - 1]?.content || '').toLowerCase();
  // 销售发出的轮数（history 中 role=sales 的数量）
  const salesTurns = history.filter(m => m.role === 'sales').length;

  // 第1轮：只做身份确认，绝不涉及孩子/课程
  if (salesTurns <= 1) {
    return '你好，你是哪位啊？';
  }

  // 第2轮：了解来意
  if (salesTurns === 2) {
    return '哦，教育机构啊，你们主要做什么辅导的？';
  }

  // 第3轮：开始了解机构
  if (salesTurns === 3) {
    return '嗯，那你先简单说说你们的课程是怎么安排的？';
  }

  // 中期：根据销售说的内容自然回应
  if (lastMessage.includes('分数') || lastMessage.includes('成绩')) {
    return '孩子成绩就是中等吧，想再提提，但也没特别急。';
  }
  if (lastMessage.includes('时间') || lastMessage.includes('过来') || lastMessage.includes('来看看')) {
    return '时间不一定，我要看看我们的安排，不一定能去。';
  }
  if (lastMessage.includes('例子') || lastMessage.includes('案例')) {
    return '有没有跟我家孩子情况差不多的？成绩一般那种。';
  }
  if (lastMessage.includes('老师') || lastMessage.includes('教师')) {
    return '老师是固定的还是会换人啊？';
  }
  if (lastMessage.includes('价格') || lastMessage.includes('收费') || lastMessage.includes('费用')) {
    return '大概怎么收费的，能说说吗？';
  }

  // 后期默认：保持谨慎，不轻易表态
  const lateResponses = [
    '嗯，那我先了解了解，还没想好要不要报。',
    '这样啊，我考虑一下，跟家里人商量商量。',
    '那孩子那边还得看他自己愿不愿意。',
    '还要再对比一下别家，你们有什么优势？',
  ];
  return lateResponses[salesTurns % lateResponses.length];
}

// 评分生成
export async function generateScore(
  scoringPrompt: string,
  model: string = 'abab6.5s-chat'
): Promise<{
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}> {
  if (!MINIMAX_API_KEY) {
    // Demo模式 - 返回基于规则的评分
    const score = Math.floor(Math.random() * 5) + 7; // 7-12分随机
    return {
      score,
      feedback: '（Demo模式：API未配置，模拟评分）',
      strengths: ['话术基本完整', '态度友好'],
      weaknesses: ['可以更深入挖掘需求'],
      suggestions: ['建议多了解孩子的具体学习情况'],
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
      group_id: MINIMAX_GROUP_ID,
      messages,
      temperature: 0.3,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    throw new Error(`MiniMax API error: ${response.status}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || '{}';

  // 尝试从markdown代码块中提取JSON
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    content = jsonMatch[1].trim();
  }

  // 尝试解析JSON，如果失败则返回错误
  try {
    const result = JSON.parse(content);
    // 确保返回的格式正确
    if (typeof result.score !== 'number') {
      throw new Error('Invalid score format');
    }
    return result;
  } catch {
    // 如果JSON解析失败，尝试从文本中提取信息
    const scoreMatch = content.match(/"score"\s*:\s*(\d+)/);
    const feedbackMatch = content.match(/"feedback"\s*:\s*"([^"]*)"/);
    
    if (scoreMatch) {
      return {
        score: parseInt(scoreMatch[1], 10),
        feedback: feedbackMatch ? feedbackMatch[1] : '评分已生成',
        strengths: [],
        weaknesses: [],
        suggestions: [],
      };
    }
    
    return {
      score: 0,
      feedback: '评分解析失败',
      strengths: [],
      weaknesses: ['格式错误'],
      suggestions: [],
    };
  }
}

// 综合评分生成（对话结束时调用）
export async function generateComprehensiveScore(
  scoringPrompt: string,
  model: string = 'MiniMax-Text-01'
): Promise<{
  dimensions: { name: string; score: number; maxScore: number; detail: string }[];
  totalScore: number;
  grade: string;
  highlight: string;
  weakness: string;
  improvements: string[];
}> {
  if (!MINIMAX_API_KEY) {
    // Demo模式
    return {
      dimensions: [
        { name: '开场', score: 10, maxScore: 15, detail: '（Demo模式）' },
        { name: '挖需求', score: 15, maxScore: 25, detail: '（Demo模式）' },
        { name: '提信心', score: 10, maxScore: 15, detail: '（Demo模式）' },
        { name: '举例', score: 12, maxScore: 20, detail: '（Demo模式）' },
        { name: '给方案', score: 10, maxScore: 15, detail: '（Demo模式）' },
        { name: '邀约确认', score: 6, maxScore: 10, detail: '（Demo模式）' },
      ],
      totalScore: 63,
      grade: 'C',
      highlight: 'Demo模式综合评分',
      weakness: 'Demo模式',
      improvements: ['建议配置API Key'],
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
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`MiniMax API error: ${response.status}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || '{}';

  // 尝试从markdown代码块中提取JSON
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    content = jsonMatch[1].trim();
  }

  try {
    const result = JSON.parse(content);
    // 确保返回格式正确
    if (!result.dimensions || !Array.isArray(result.dimensions)) {
      throw new Error('Invalid comprehensive score format');
    }
    return result;
  } catch (error) {
    console.error('综合评分解析失败:', error);
    // 返回默认评分
    return {
      dimensions: [
        { name: '开场', score: 0, maxScore: 15, detail: '评分解析失败' },
        { name: '挖需求', score: 0, maxScore: 25, detail: '评分解析失败' },
        { name: '提信心', score: 0, maxScore: 15, detail: '评分解析失败' },
        { name: '举例', score: 0, maxScore: 20, detail: '评分解析失败' },
        { name: '给方案', score: 0, maxScore: 15, detail: '评分解析失败' },
        { name: '邀约确认', score: 0, maxScore: 10, detail: '评分解析失败' },
      ],
      totalScore: 0,
      grade: 'D',
      highlight: '评分解析失败',
      weakness: '请检查对话内容',
      improvements: [],
    };
  }
}
