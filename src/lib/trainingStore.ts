import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

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

export interface TrainingSession {
  id: string;
  questionType: QuestionType;
  status: 'active' | 'finished';
  messages: TrainingMessage[];
  scores: TrainingScore[];
  totalQuestions: number;
  currentQuestionIndex: number;
  startedAt: string;
  finishedAt?: string;
}

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

export function generateId(): string {
  return `training-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createTrainingSession(questionType: QuestionType): TrainingSession {
  const session: TrainingSession = {
    id: generateId(),
    questionType,
    status: 'active',
    messages: [],
    scores: [],
    totalQuestions: 5,
    currentQuestionIndex: 0,
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
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sessionId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
  session.messages.push(message);
  saveToFile();
  return message;
}

export function addTrainingScore(sessionId: string, score: TrainingScore): void {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Training session not found');
  session.scores.push(score);
  session.currentQuestionIndex += 1;
  if (session.currentQuestionIndex >= session.totalQuestions) {
    session.status = 'finished';
    session.finishedAt = new Date().toISOString();
  }
  saveToFile();
}

export function finishTrainingSession(sessionId: string): TrainingSession {
  const session = sessions.get(sessionId);
  if (!session) throw new Error('Training session not found');
  session.status = 'finished';
  session.finishedAt = new Date().toISOString();
  saveToFile();
  return session;
}

export function getAllTrainingSessions(): TrainingSession[] {
  return Array.from(sessions.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}
