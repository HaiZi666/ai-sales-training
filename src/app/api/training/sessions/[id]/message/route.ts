import { NextRequest, NextResponse } from 'next/server';
import { getTrainingSession, addTrainingMessage, addTrainingScore } from '@/lib/trainingStore';
import { generateAIResponse } from '@/lib/minimax';

function buildEvalSystemPrompt(questionType: string, totalQuestions: number): string {
  const typeName = questionType === 'sales_faq' ? '销售常见问题' : '产品基础知识';
  return `你是一位资深销售培训考官，正在对教育机构销售人员进行【${typeName}】培训测试，共${totalQuestions}道题。

你的任务：
1. 对学员的回答进行评价（10分制）
2. 指出回答的优点和不足，给出标准答案/参考要点
3. 如果题目还没做完，给出下一道题

回复格式（严格按以下JSON格式输出，不要有多余内容）：
{
  "score": 分数(1-10整数),
  "feedback": "对这次回答的评价（2-3句话）",
  "correctAnswer": "标准答案或关键要点（2-4条）",
  "nextQuestion": "下一道题目内容（如果已是最后一题则为空字符串\"\"）",
  "isFinished": true/false
}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getTrainingSession(id);

    if (!session) {
      return NextResponse.json({ error: '培训会话不存在' }, { status: 404 });
    }
    if (session.status === 'finished') {
      return NextResponse.json({ error: '培训已结束' }, { status: 400 });
    }

    const body = await request.json();
    const { text, currentQuestion, questionIndex } = body as {
      text: string;
      currentQuestion: string;
      questionIndex: number;
    };

    if (!text?.trim()) {
      return NextResponse.json({ error: '回答内容不能为空' }, { status: 400 });
    }

    // 保存用户回答
    addTrainingMessage(id, 'user', text);

    const isLastQuestion = questionIndex >= session.totalQuestions - 1;
    const systemPrompt = buildEvalSystemPrompt(session.questionType, session.totalQuestions);

    // 构建对话历史给 AI 参考
    const conversationHistory = session.messages.map(m => ({
      role: m.role === 'ai' ? 'ai' : 'sales',
      content: m.content,
    }));

    // 追加本次评价请求
    const evalRequest = `【第${questionIndex + 1}题】${currentQuestion}

【学员回答】${text}

${isLastQuestion ? '这是最后一题，请在评价后将nextQuestion设为空字符串，isFinished设为true。' : `这是第${questionIndex + 1}题（共${session.totalQuestions}题），评价完请出第${questionIndex + 2}题。`}`;

    conversationHistory.push({ role: 'sales', content: evalRequest });

    const aiRawResponse = await generateAIResponse(systemPrompt, conversationHistory);

    // 解析 AI 返回的 JSON
    let parsed: {
      score: number;
      feedback: string;
      correctAnswer: string;
      nextQuestion: string;
      isFinished: boolean;
    };

    try {
      const jsonMatch = aiRawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : aiRawResponse.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      // 解析失败时给默认值，保证流程继续
      parsed = {
        score: 6,
        feedback: aiRawResponse.slice(0, 200),
        correctAnswer: '',
        nextQuestion: isLastQuestion ? '' : `请继续回答第${questionIndex + 2}题`,
        isFinished: isLastQuestion,
      };
    }

    // 保存 AI 回复消息
    const aiContent = `评价：${parsed.feedback}${parsed.correctAnswer ? `\n\n参考要点：${parsed.correctAnswer}` : ''}`;
    addTrainingMessage(id, 'ai', aiContent);

    // 保存评分
    addTrainingScore(id, {
      questionIndex,
      score: parsed.score,
      maxScore: 10,
      feedback: parsed.feedback,
      correctAnswer: parsed.correctAnswer,
    });

    // 如果有下一题，保存为 AI 消息
    if (parsed.nextQuestion) {
      addTrainingMessage(id, 'ai', parsed.nextQuestion);
    }

    return NextResponse.json({
      score: parsed.score,
      maxScore: 10,
      feedback: parsed.feedback,
      correctAnswer: parsed.correctAnswer,
      nextQuestion: parsed.nextQuestion,
      isFinished: parsed.isFinished || isLastQuestion,
      currentQuestionIndex: questionIndex + 1,
    });
  } catch (error) {
    console.error('培训消息处理失败:', error);
    return NextResponse.json({ error: '处理失败' }, { status: 500 });
  }
}
