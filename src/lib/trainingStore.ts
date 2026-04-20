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

/**
 * Read questions from Excel file
 */
function readQuestionsFromExcel(questionType: QuestionType): TrainingQuestion[] {
  try {
    const filePath = path.join(DATA_DIR, QUESTION_TYPE_FILE_MAP[questionType]);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

    const questions: TrainingQuestion[] = [];
    let globalIndex = 0;

    rawData.forEach((row, rowIndex) => {
      const questionText = row['常问问题'] || '';
      
      // Split questions by newline and filter empty strings
      const questionList = questionText
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0);

      // Get standard answer from 破冰标准话术 or 结尾确定时间
      const standardAnswer = row['破冰标准话术'] || row['结尾确定时间，下痛点话术'] || '';

      questionList.forEach((question) => {
        globalIndex++;
        questions.push({
          id: `${questionType}-${rowIndex}-${globalIndex}`,
          question,
          standardAnswer,
          scenario: row['场景类型'] || '通用',
          node: row['节点'] || '通用',
        });
      });
    });

    return questions;
  } catch (e) {
    console.error('[TrainingStore] Failed to read Excel:', e);
    return [];
  }
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
  // Read questions from Excel
  const allQuestions = readQuestionsFromExcel(questionType);
  
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
