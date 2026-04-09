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
    return generateDemoResponse(conversationHistory[conversationHistory.length - 1]?.content || '');
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

// Demo模式回复
function generateDemoResponse(lastMessage: string): string {
  const demoResponses = [
    '哦，那孩子这次数学大概多少分？',
    '我们家孩子确实有点偏科，数学一直不太好。',
    '那你们这个课是怎么收费的？',
    '效果怎么样啊？有和我们家孩子情况类似的例子吗？',
    '那要不我周末带孩子过去看看？',
  ];
  
  // 根据上一轮内容选择合适的回复
  const msg = lastMessage.toLowerCase();
  if (msg.includes('分数') || msg.includes('成绩')) {
    return '这次期中考试数学考了72分，班级中等吧。';
  }
  if (msg.includes('时间') || msg.includes('来')) {
    return '周末的话，周日下午两点应该可以。';
  }
  if (msg.includes('例子') || msg.includes('案例')) {
    return '还真有，我们邻居家孩子也是数学不好，后来在你们这学了两个月，提了20多分。';
  }
  
  return demoResponses[Math.floor(Math.random() * demoResponses.length)];
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
