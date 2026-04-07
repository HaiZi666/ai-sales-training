import { Session, Message, NodeScore, PracticeReport, DialogNode, SCORING_CONFIG, NODE_ORDER } from '@/types';

// 内存存储（MVP阶段使用）
const sessions = new Map<string, Session>();

// 生成唯一ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// 创建演练会话
export function createSession(
  salespersonId: string,
  customerType: string,
  customerScore: string,
  customerSubject: string
): Session {
  const session: Session = {
    id: generateId(),
    salespersonId,
    customerType: customerType as Session['customerType'],
    customerScore: customerScore as Session['customerScore'],
    customerSubject,
    status: 'active',
    currentNode: '开场',
    messages: [],
    scores: [],
    startedAt: new Date().toISOString(),
  };
  sessions.set(session.id, session);
  return session;
}

// 获取会话
export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

// 添加消息
export function addMessage(
  sessionId: string,
  role: 'ai' | 'sales',
  content: string,
  node: DialogNode
): Message {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  const message: Message = {
    id: generateId(),
    sessionId,
    role,
    content,
    node,
    createdAt: new Date().toISOString(),
  };
  session.messages.push(message);
  return message;
}

// 添加评分
export function addScore(sessionId: string, score: NodeScore): void {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  session.scores.push(score);
}

// 更新当前节点
export function updateCurrentNode(sessionId: string, node: DialogNode): void {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  session.currentNode = node;
}

// 结束会话
export function finishSession(sessionId: string): Session {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  session.status = 'finished';
  session.finishedAt = new Date().toISOString();
  return session;
}

// 生成报告
export function generateReport(sessionId: string): PracticeReport {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  // 计算各维度得分
  const dimensionScores = SCORING_CONFIG;
  const dimensions = NODE_ORDER.map(node => {
    const nodeScores = session.scores.filter(s => s.node === node);
    const totalScore = nodeScores.reduce((sum, s) => sum + s.score, 0);
    const avgScore = nodeScores.length > 0 ? Math.round(totalScore / nodeScores.length) : 0;
    return {
      name: node,
      score: avgScore,
      max: dimensionScores[node].maxScore,
      detail: nodeScores.length > 0 
        ? nodeScores[nodeScores.length - 1].feedback 
        : '该环节未进行评估',
    };
  });

  const totalScore = dimensions.reduce((sum, d) => sum + d.score, 0);
  const maxTotal = dimensions.reduce((sum, d) => sum + d.max, 0);
  const percentage = (totalScore / maxTotal) * 100;

  // 计算等级
  let grade: string;
  if (percentage >= 90) grade = 'A+';
  else if (percentage >= 85) grade = 'A';
  else if (percentage >= 80) grade = 'B+';
  else if (percentage >= 70) grade = 'B';
  else if (percentage >= 60) grade = 'C';
  else grade = 'D';

  // 找出亮点和薄弱点
  const sorted = [...dimensions].sort((a, b) => (b.score / b.max) - (a.score / a.max));
  const highlight = sorted[0] ? `${sorted[0].name}环节表现最佳（${sorted[0].score}/${sorted[0].max}）` : '';
  const weakness = sorted[sorted.length - 1]?.score < (sorted[sorted.length - 1]?.max || 1) * 0.6
    ? `${sorted[sorted.length - 1].name}环节需要加强` 
    : '';

  // 收集改进建议
  const improvements = session.scores
    .flatMap(s => s.suggestions)
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .slice(0, 5);

  return {
    sessionId,
    totalScore,
    grade,
    dimensions,
    highlight,
    weakness,
    improvements,
  };
}

// 获取所有历史会话
export function getAllSessions(): Session[] {
  return Array.from(sessions.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

// 获取会话列表（简化版，用于历史页面）
export function getSessionList(): { id: string; customerType: string; customerScore: string; status: string; startedAt: string; totalScore?: number }[] {
  return getAllSessions().map(s => ({
    id: s.id,
    customerType: s.customerType,
    customerScore: s.customerScore,
    status: s.status,
    startedAt: s.startedAt,
    totalScore: s.scores.length > 0 
      ? s.scores.reduce((sum, sc) => sum + sc.score, 0)
      : undefined,
  }));
}
