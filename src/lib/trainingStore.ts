import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

export type QuestionType = 'sales_faq' | 'product_basics';

export interface TrainingMessage {
  id: string;
  sessionId: string;
  role: 'ai' | 'user';
  content: string;
  createdAt: string;
}

export interface TrainingScore {
  questionIndex: number;
  score: number;
  maxScore: number;
  feedback: string;
  correctAnswer?: string;
}

export interface TrainingQuestion {
  id: string;
  question: string;
  standardAnswer: string;
  scenario: string;
  node: string;
}

export interface TrainingSession {
  id: string;
  questionType: QuestionType;
  status: 'active' | 'finished';
  messages: TrainingMessage[];
  scores: TrainingScore[];
  questions: TrainingQuestion[];
  currentQuestionIndex: number;
  askedQuestionIds: string[];
  startedAt: string;
  finishedAt?: string;
}

// Excel file mapping
const QUESTION_TYPE_FILE_MAP: Record<QuestionType, string> = {
  sales_faq: 'Sales_FAQs.xlsx',
  product_basics: 'Product_FAQs.xlsx',
};

const QUESTION_TYPE_NAME_MAP: Record<QuestionType, string> = {
  sales_faq: '销售常见问题',
  product_basics: '产品基础知识',
};

const DATA_DIR = path.join(process.cwd(), 'src/data/tables');
const DATA_FILE = path.join(process.cwd(), 'data', 'training_sessions.json');
const sessions = new Map<string, TrainingSession>();



function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadFromFile() {
  try {
    if (existsSync(DATA_FILE)) {
      const data = readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach((s: TrainingSession) => sessions.set(s.id, s));
      }
    }
  } catch (e) {
    console.error('[TrainingStore] Failed to load:', e);
  }
}

function saveToFile() {
  try {
    ensureDataDir();
    writeFileSync(DATA_FILE, JSON.stringify(Array.from(sessions.values()), null, 2), 'utf-8');
  } catch (e) {
    console.error('[TrainingStore] Failed to save:', e);
  }
}

loadFromFile();

// 各题型对应的 Excel 列名配置
const COLUMN_CONFIG: Record<QuestionType, { question: string; answer: string }> = {
  sales_faq:      { question: '常见问题', answer: '话术建议' },
  product_basics: { question: '问题',     answer: '答案' },
};

/**
 * Read questions from Excel file
 * 表格格式：第一行为表头，从第二行开始每行一道题
 */
function readQuestionsFromExcel(questionType: QuestionType): TrainingQuestion[] {
  try {
    // serverExternalPackages: ["xlsx"] 已配置，xlsx 由 Node.js 原生加载，静态 import 安全可用
    const filePath = path.join(DATA_DIR, QUESTION_TYPE_FILE_MAP[questionType]);

    console.log(`[TrainingStore] Reading Excel: ${filePath}`);

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

    const { question: questionCol, answer: answerCol } = COLUMN_CONFIG[questionType];

    const questions: TrainingQuestion[] = rawData
      .map((row, rowIndex) => ({
        id: `${questionType}-${rowIndex}`,
        question: (row[questionCol] || '').trim(),
        standardAnswer: (row[answerCol] || '').trim(),
        scenario: (row['场景类型'] || '通用').trim(),
        node: (row['节点'] || '通用').trim(),
      }))
      .filter(q => {
        if (q.question.length === 0) return false;
        // 误把第二行再写一遍表头时，整行等于列名，不作为题目
        if (q.question === questionCol && q.standardAnswer === answerCol) return false;
        return true;
      });

    console.log(`[TrainingStore] Loaded ${questions.length} questions for ${questionType}`);
    return questions;
  } catch (e) {
    console.error(`[TrainingStore] Failed to read Excel for ${questionType}:`, e);
    return [];
  }
}

/**
 * 直接从 Excel 读取题库，每次获取最新数据
 */
function getQuestions(questionType: QuestionType): TrainingQuestion[] {
  return readQuestionsFromExcel(questionType);
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function generateId(): string {
  return `training-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createTrainingSession(questionType: QuestionType): TrainingSession {
  // 使用带缓存的题库读取，避免每次请求重新读取 Excel
  const allQuestions = getQuestions(questionType);
  
  if (allQuestions.length === 0) {
    throw new Error('题库为空或读取失败');
  }

  // Shuffle questions
  const shuffledQuestions = shuffleArray(allQuestions);

  const session: TrainingSession = {
    id: generateId(),
    questionType,
    status: 'active',
    messages: [],
    scores: [],
    questions: shuffledQuestions,
    currentQuestionIndex: 0,
    askedQuestionIds: [],
    startedAt: new Date().toISOString(),
  };
  sessions.set(session.id, session);
  saveToFile();
  return session;
}

export function getTrainingSession(id: string): TrainingSession | undefined {
  return sessions.get(id);
}

export function addTrainingMessage(
  sessionId: string,
  role: 'ai' | 'user',
  content: string
): TrainingMessage {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Training session not found');

  const message: TrainingMessage = {
    id: `${sessionId}-${Date.now()}`,
    sessionId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
  session.messages.push(message);
  sessions.set(sessionId, session);
  saveToFile();
  return message;
}

export function addTrainingScore(
  sessionId: string,
  score: Omit<TrainingScore, 'questionIndex'>
): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  const scoreRecord: TrainingScore = {
    ...score,
    questionIndex: session.scores.length,
  };
  session.scores.push(scoreRecord);
  sessions.set(sessionId, session);
  saveToFile();
}

export function getNextQuestion(sessionId: string): TrainingQuestion | null {
  const session = sessions.get(sessionId);
  if (!session || session.status === 'finished') return null;

  // Find next unanswered question
  const nextQuestion = session.questions.find(
    q => !session.askedQuestionIds.includes(q.id)
  );

  return nextQuestion || null;
}

export function markQuestionAsked(sessionId: string, questionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  if (!session.askedQuestionIds.includes(questionId)) {
    session.askedQuestionIds.push(questionId);
  }
  session.currentQuestionIndex = session.askedQuestionIds.length;

  // Check if all questions have been asked
  if (session.currentQuestionIndex >= session.questions.length) {
    session.status = 'finished';
    session.finishedAt = new Date().toISOString();
  }

  sessions.set(sessionId, session);
  saveToFile();
}

export function finishSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.status = 'finished';
  session.finishedAt = new Date().toISOString();
  sessions.set(sessionId, session);
  saveToFile();
}

export function getQuestionTypeName(questionType: QuestionType): string {
  return QUESTION_TYPE_NAME_MAP[questionType];
}
