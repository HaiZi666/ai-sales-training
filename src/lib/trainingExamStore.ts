import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { type ExamQuestion } from '@/lib/trainingExam';

export interface TrainingExamSession {
  id: string;
  status: 'active' | 'finished';
  questions: ExamQuestion[];
  selectedCategories: string[];
  startedAt: string;
  finishedAt?: string;
}

const DATA_FILE = path.join(process.cwd(), 'data', 'training_exam_sessions.json');
const sessions = new Map<string, TrainingExamSession>();

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadFromFile() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const content = readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(content) as TrainingExamSession[];
    if (Array.isArray(parsed)) {
      parsed.forEach(session => sessions.set(session.id, session));
    }
  } catch (error) {
    console.error('[TrainingExamStore] Failed to load:', error);
  }
}

function saveToFile() {
  try {
    ensureDataDir();
    writeFileSync(DATA_FILE, JSON.stringify(Array.from(sessions.values()), null, 2), 'utf-8');
  } catch (error) {
    console.error('[TrainingExamStore] Failed to save:', error);
  }
}

loadFromFile();

function generateId(): string {
  return `training-exam-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createTrainingExamSession(
  questions: ExamQuestion[],
  selectedCategories: string[]
): TrainingExamSession {
  const session: TrainingExamSession = {
    id: generateId(),
    status: 'active',
    questions,
    selectedCategories,
    startedAt: new Date().toISOString(),
  };

  sessions.set(session.id, session);
  saveToFile();
  return session;
}

export function getTrainingExamSession(id: string): TrainingExamSession | undefined {
  return sessions.get(id);
}

export function finishTrainingExamSession(id: string): void {
  const session = sessions.get(id);
  if (!session) return;

  session.status = 'finished';
  session.finishedAt = new Date().toISOString();
  sessions.set(id, session);
  saveToFile();
}
