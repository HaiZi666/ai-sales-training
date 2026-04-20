import * as XLSX from 'xlsx';
import path from 'path';

export type TrainingCategory = 'sales' | 'product';

export interface TrainingQuestion {
  id: string;
  category: TrainingCategory;
  scenario: string;
  customerSource: string;
  node: string;
  iceBreakerScript: string;
  closingScript: string;
  question: string;
  standardAnswer: string;
}

export interface TrainingSession {
  id: string;
  category: TrainingCategory;
  questions: TrainingQuestion[];
  askedQuestionIds: string[];
  answers: Record<string, string>;
  currentQuestionIndex: number;
  status: 'active' | 'completed';
  createdAt: number;
}

// Map category to Excel file
const CATEGORY_FILE_MAP: Record<TrainingCategory, string> = {
  sales: 'Sales_FAQs.xlsx',
  product: 'Product_FAQs.xlsx',
};

const DATA_DIR = path.join(process.cwd(), 'src/data/tables');

/**
 * Read Excel file and return raw data
 */
function readExcelFile(category: TrainingCategory): XLSX.WorkBook {
  const filePath = path.join(DATA_DIR, CATEGORY_FILE_MAP[category]);
  return XLSX.readFile(filePath);
}

/**
 * Parse Excel data into TrainingQuestion array
 * Questions are separated by newlines in the "常问问题" column
 */
export function parseQuestionsFromExcel(category: TrainingCategory): TrainingQuestion[] {
  const workbook = readExcelFile(category);
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

    // Also get the standard answer from 破冰标准话术
    const standardAnswer = row['破冰标准话术'] || row['结尾确定时间，下痛点话术'] || '';

    questionList.forEach((question) => {
      globalIndex++;
      questions.push({
        id: `${category}-${rowIndex}-${globalIndex}`,
        category,
        scenario: row['场景类型'] || '通用',
        customerSource: row['客户来源'] || '通用',
        node: row['节点'] || '通用',
        iceBreakerScript: row['破冰标准话术'] || '',
        closingScript: row['结尾确定时间，下痛点话术'] || '',
        question,
        standardAnswer,
      });
    });
  });

  return questions;
}

/**
 * Get all available questions for a category
 */
export function getQuestionsByCategory(category: TrainingCategory): TrainingQuestion[] {
  return parseQuestionsFromExcel(category);
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Create a new training session
 */
export function createTrainingSession(category: TrainingCategory): TrainingSession {
  const questions = shuffleArray(parseQuestionsFromExcel(category));
  
  return {
    id: `training-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    category,
    questions,
    askedQuestionIds: [],
    answers: {},
    currentQuestionIndex: 0,
    status: 'active',
    createdAt: Date.now(),
  };
}

/**
 * In-memory session storage (for demo purposes)
 * In production, this should be stored in a database
 */
const sessions = new Map<string, TrainingSession>();

export function saveSession(session: TrainingSession): void {
  sessions.set(session.id, session);
}

export function getSession(sessionId: string): TrainingSession | undefined {
  return sessions.get(sessionId);
}

export function updateSessionAnswer(
  sessionId: string,
  questionId: string,
  answer: string
): TrainingSession | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;

  session.answers[questionId] = answer;
  if (!session.askedQuestionIds.includes(questionId)) {
    session.askedQuestionIds.push(questionId);
  }
  session.currentQuestionIndex = session.askedQuestionIds.length;

  // Check if all questions have been asked
  if (session.currentQuestionIndex >= session.questions.length) {
    session.status = 'completed';
  }

  sessions.set(sessionId, session);
  return session;
}

export function getNextQuestion(sessionId: string): TrainingQuestion | null {
  const session = sessions.get(sessionId);
  if (!session || session.status === 'completed') return null;

  // Find next unanswered question
  const unansweredQuestion = session.questions.find(
    q => !session.askedQuestionIds.includes(q.id)
  );

  return unansweredQuestion || null;
}

export function completeSession(sessionId: string): TrainingSession | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;

  session.status = 'completed';
  sessions.set(sessionId, session);
  return session;
}
