import { Session, Message, NodeScore, PracticeReport, DialogNode, SCORING_CONFIG, NODE_ORDER } from '@/types';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'sessions.json');

// 内存存储
const sessions = new Map<string, Session>();

// 确保数据目录存在
function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// 从文件加载数据
function loadFromFile() {
  try {
    if (existsSync(DATA_FILE)) {
      const data = readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach(s => sessions.set(s.id, s));
      }
      console.log(`[Store] Loaded ${sessions.size} sessions from disk`);
    }
  } catch (e) {
    console.error('[Store] Failed to load sessions:', e);
  }
}

// 保存数据到文件
function saveToFile() {
  try {
    ensureDataDir();
    const all = Array.from(sessions.values());
    writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Store] Failed to save sessions:', e);
  }
}

// 初始化时加载数据
loadFromFile();

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
  saveToFile();
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
  saveToFile();
  return message;
}

// 添加评分
export function addScore(sessionId: string, score: NodeScore): void {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  session.scores.push(score);
  saveToFile();
}

// 更新当前节点
export function updateCurrentNode(sessionId: string, node: DialogNode): void {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  session.currentNode = node;
  saveToFile();
}

// 结束会话
export function finishSession(sessionId: string): Session {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  session.status = 'finished';
  session.finishedAt = new Date().toISOString();
  saveToFile();
  return session;
}

// 生成报告
export function generateReport(sessionId: string): PracticeReport {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  // 计算综合评分
  const allScores = session.scores;
  const totalScore = allScores.reduce((sum, s) => sum + s.score, 0);
  const totalMax = allScores.reduce((sum, s) => sum + s.maxScore, 0);
  const avgScore = allScores.length > 0 ? Math.round(totalScore / allScores.length) : 0;
  
  // 获取最后一次反馈作为主要评价
  const lastFeedback = allScores.length > 0 
    ? allScores[allScores.length - 1].feedback 
    : '暂无评价';

  // 由于当前版本没有节点推进，所有评分都计入"综合表现"
  const dimensions = [{
    name: '综合表现',
    score: avgScore,
    max: 15,
    detail: lastFeedback,
  }];

  // 计算百分制
  const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

  let grade: string;
  if (percentage >= 90) grade = 'A+';
  else if (percentage >= 85) grade = 'A';
  else if (percentage >= 80) grade = 'B+';
  else if (percentage >= 70) grade = 'B';
  else if (percentage >= 60) grade = 'C';
  else grade = 'D';

  // 亮点：找出得分最高的一次评价
  const bestScore = allScores.length > 0 
    ? Math.max(...allScores.map(s => s.score))
    : 0;
  const bestFeedbackObj = allScores.find(s => s.score === bestScore);
  const highlight = allScores.length > 0 
    ? `最佳表现（${bestScore}分）：${bestFeedbackObj?.feedback?.slice(0, 50) || ''}...` 
    : '';

  // 薄弱点：找出得分最低的一次评价
  const worstScore = allScores.length > 0 
    ? Math.min(...allScores.map(s => s.score))
    : 0;
  const worstFeedbackObj = allScores.find(s => s.score === worstScore);
  const weakness = allScores.length > 0 && worstScore < avgScore - 2
    ? `有待提高（${worstScore}分）：${worstFeedbackObj?.feedback?.slice(0, 50) || ''}...`
    : '';

  // 收集所有改进建议（去重）
  const improvements = allScores
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
