import { CUSTOMER_TYPE_CONFIG, CustomerType } from '@/types';

// AI角色设定Prompt
export function buildSystemPrompt(
  customerType: CustomerType,
  customerScore: string,
  customerSubject: string,
  currentNode: string
): string {
  const config = CUSTOMER_TYPE_CONFIG[customerType];
  
  const nodeGuides: Record<string, string> = {
    开场: '家长简单回应，观察销售的自我介绍是否清晰专业。不要主动透露太多信息。',
    挖需求: '家长开始透露孩子的一些情况，但要有所保留，等待销售挖掘。不要一次性说太多。',
    提信心: '家长表达顾虑或质疑（如：真的有用吗？），测试销售是否能打消疑虑、提升信心。',
    举例: '家长要求看案例，测试销售是否能给出有说服力的真实案例。',
    给方案: '家长询问具体怎么学、时间怎么安排，测试销售是否能给出可行方案。',
    邀约确认: '家长态度软化，愿意考虑到店体验，但可能还在犹豫具体时间。销售需要确认具体时间。',
  };

  return `你是${config.name}的家长，正在和教育机构的销售顾问通话。

## 你的背景
${config.promptAddition}
孩子成绩：${customerScore}
弱科：${customerSubject}

## 当前对话节点：${currentNode}
${nodeGuides[currentNode] || ''}

## 你的性格特点
${config.description}
${config.typicalQuestions.map(q => `- "${q}"`).join('\n')}

## 对话原则
1. 保持角色一致性，不要主动提供太多信息
2. 可以提出合理的异议和质疑
3. 遇到压力时可以有轻微情绪反应（不耐烦、质疑）
4. 适当时机可以被说服，但不要太快答应
5. 用词符合家长身份，自然口语化
6. 不要一次性说完所有信息，循序渐进

## 重要
- 以【家长】的身份回复
- 回复要简洁，像真实的对话（1-3句话）
- 每次只回应销售说的内容，不要自己扩展太多`;
}

// 评分Prompt
export function buildScoringPrompt(
  node: string,
  salesResponse: string,
  maxScore: number,
  criteria: string[]
): string {
  return `你是销售话术评分专家。请对销售的${node}环节话术进行评分。

## 销售的回答：
"${salesResponse}"

## 该环节分值：${maxScore}分

## 考核标准：
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## 输出要求
请严格按照以下JSON格式输出，不要添加任何其他内容：
{
  "score": 数字（0-${maxScore}之间的整数）,
  "feedback": "具体反馈说明，要指出回答中好的地方和不足之处",
  "strengths": ["亮点1", "亮点2"],
  "weaknesses": ["不足1", "不足2"],
  "suggestions": ["改进建议1", "改进建议2"]
}`;
}

// 节点升级判断Prompt
export function buildNodeTransitionPrompt(
  aiMessage: string,
  salesMessage: string,
  currentNode: string
): { nextNode: string; reason: string } {
  // 简化的节点升级逻辑
  // 实际生产中可以用AI判断
  const nodeOrder = ['开场', '挖需求', '提信心', '举例', '给方案', '邀约确认'];
  const currentIndex = nodeOrder.indexOf(currentNode);
  
  // 根据关键词判断是否升级
  const upgradeKeywords: Record<string, string[]> = {
    挖需求: ['分数', '排名', '成绩', '弱科', '听不懂', '考试'],
    提信心: ['基础', '方法', '提高', '提升', '信心', '解决'],
    举例: ['案例', '例子', '学生', '之前', '效果', '提分'],
    给方案: ['课程', '安排', '时间', '学习', '方案', '体验'],
    邀约确认: ['时间', '地点', '地址', '过来', '到店', '预约', '周'],
  };

  // 检查销售回复是否触发节点升级
  const salesLower = salesMessage.toLowerCase();
  for (let i = currentIndex + 1; i < nodeOrder.length; i++) {
    const keywords = upgradeKeywords[nodeOrder[i]] || [];
    if (keywords.some(kw => salesLower.includes(kw))) {
      return { nextNode: nodeOrder[i], reason: `检测到"${keywords.find(kw => salesLower.includes(kw))}"相关表述` };
    }
  }

  // 每2轮对话后自动升级到下一个节点
  return { nextNode: currentNode, reason: '继续当前节点' };
}
