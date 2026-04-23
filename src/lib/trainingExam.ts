import { evaluateTrainingAnswerTenPoint } from '@/lib/trainingScoring';

export const EXAM_PAPER_CATEGORY_COUNT = 10;

export function getExamPaperCategoryCount(totalCategories: number): number {
  return Math.min(EXAM_PAPER_CATEGORY_COUNT, Math.max(totalCategories, 0));
}

export interface ExamQuestion {
  id: string;
  category: string;
  question: string;
  referenceAnswer: string;
  explanation: string;
  source: 'exam';
}

export interface ParsedExamQuestionsResult {
  questions: ExamQuestion[];
  errors: string[];
  warnings: string[];
}

export interface ExamPaperBuildResult {
  paper: ExamQuestion[];
  error?: string;
}

export interface ExamResultItem {
  id: string;
  category: string;
  question: string;
  userAnswer: string;
  referenceAnswer: string;
  score: number;
  maxScore: number;
  isCorrect: boolean;
  feedback: string;
}

export interface ExamResult {
  items: ExamResultItem[];
  totalScore: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
}

type RawObjectRow = Record<string, unknown>;

function normalizeCellValue(value: unknown): string {
  if (value == null) return '';
  return String(value).replace(/\r\n/g, '\n').trim();
}

function isObjectRow(value: unknown): value is RawObjectRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactHeaderRow(row: string[]): boolean {
  return row.length >= 3 && row[0] === '分类' && row[1] === '常见问题' && row[2] === '话术建议';
}

export function normalizeExamQuestion(
  row: {
    category: string;
    question: string;
    referenceAnswer: string;
  },
  index: number
): ExamQuestion {
  return {
    id: `exam-${index + 1}`,
    category: row.category,
    question: row.question,
    referenceAnswer: row.referenceAnswer,
    explanation: row.referenceAnswer,
    source: 'exam',
  };
}

function parseArrayRows(rows: unknown[][]): ParsedExamQuestionsResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rows.length === 0) {
    return {
      questions: [],
      errors: ['ExamQuestions 无数据'],
      warnings,
    };
  }

  const headerRow = (rows[0] ?? []).slice(0, 3).map(normalizeCellValue);
  if (headerRow.length < 3 || headerRow.some(cell => cell.length === 0)) {
    errors.push('ExamQuestions 表头不完整，至少需要“分类 / 常见问题 / 话术建议”三列');
  }

  const questions: ExamQuestion[] = [];
  let lastCategory = '';

  rows.slice(1).forEach((row, index) => {
    const rawCategory = normalizeCellValue(row[0]);
    const question = normalizeCellValue(row[1]);
    const referenceAnswer = normalizeCellValue(row[2]);
    const category = rawCategory || lastCategory;

    if (rawCategory) {
      lastCategory = rawCategory;
    }

    if (!category) {
      warnings.push(`第 ${index + 2} 行分类为空，且无法向下继承，已跳过`);
      return;
    }

    if (!question) {
      return;
    }

    if (!referenceAnswer) {
      warnings.push(`第 ${index + 2} 行“话术建议”为空，已跳过`);
      return;
    }

    questions.push(
      normalizeExamQuestion(
        {
          category,
          question,
          referenceAnswer,
        },
        questions.length
      )
    );
  });

  return { questions, errors, warnings };
}

function findRowKey(row: RawObjectRow, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  return keys.find(key => candidates.includes(key.trim()));
}

function parseObjectRows(rows: RawObjectRow[]): ParsedExamQuestionsResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rows.length === 0) {
    return {
      questions: [],
      errors: ['ExamQuestions 无数据'],
      warnings,
    };
  }

  const firstRow = rows[0];
  const categoryKey = findRowKey(firstRow, ['分类']);
  const questionKey = findRowKey(firstRow, ['常见问题']);
  const referenceKey = findRowKey(firstRow, ['话术建议']);

  if (!categoryKey || !questionKey || !referenceKey) {
    errors.push('ExamQuestions 缺少关键列，请检查“分类 / 常见问题 / 话术建议”');
    return { questions: [], errors, warnings };
  }

  const questions: ExamQuestion[] = [];
  let lastCategory = '';

  rows.forEach((row, index) => {
    const rawCategory = normalizeCellValue(row[categoryKey]);
    const question = normalizeCellValue(row[questionKey]);
    const referenceAnswer = normalizeCellValue(row[referenceKey]);
    const category = rawCategory || lastCategory;

    if (rawCategory) {
      lastCategory = rawCategory;
    }

    if (!category) {
      warnings.push(`第 ${index + 2} 行分类为空，且无法向下继承，已跳过`);
      return;
    }

    if (!question) {
      return;
    }

    if (!referenceAnswer) {
      warnings.push(`第 ${index + 2} 行“话术建议”为空，已跳过`);
      return;
    }

    if (question === '常见问题' && referenceAnswer === '话术建议') {
      return;
    }

    questions.push(
      normalizeExamQuestion(
        {
          category,
          question,
          referenceAnswer,
        },
        questions.length
      )
    );
  });

  return { questions, errors, warnings };
}

export function parseExamQuestions(rawData: unknown): ParsedExamQuestionsResult {
  if (!Array.isArray(rawData)) {
    return {
      questions: [],
      errors: ['ExamQuestions 数据格式无效'],
      warnings: [],
    };
  }

  if (rawData.length === 0) {
    return {
      questions: [],
      errors: ['ExamQuestions 无数据'],
      warnings: [],
    };
  }

  if (Array.isArray(rawData[0])) {
    const rows = rawData as unknown[][];
    const parsed = parseArrayRows(rows);
    if (!hasExactHeaderRow((rows[0] ?? []).slice(0, 3).map(normalizeCellValue))) {
      parsed.warnings.unshift('ExamQuestions 表头与预期不完全一致，已按前三列顺序解析');
    }
    return parsed;
  }

  if (isObjectRow(rawData[0])) {
    return parseObjectRows(rawData as RawObjectRow[]);
  }

  return {
    questions: [],
    errors: ['ExamQuestions 数据格式无效'],
    warnings: [],
  };
}

export function groupQuestionsByCategory(questions: ExamQuestion[]): Record<string, ExamQuestion[]> {
  return questions.reduce<Record<string, ExamQuestion[]>>((groups, question) => {
    if (!groups[question.category]) {
      groups[question.category] = [];
    }
    groups[question.category].push(question);
    return groups;
  }, {});
}

function shuffleArray<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function pickRandomCategories(categories: string[], count: number): string[] {
  if (count <= 0) {
    return [];
  }

  if (categories.length < count) {
    return [];
  }

  return shuffleArray(categories).slice(0, count);
}

export function buildExamPaper(
  questions: ExamQuestion[],
  selectedCategories: string[]
): ExamPaperBuildResult {
  if (selectedCategories.length <= 0) {
    return { paper: [], error: '当前没有可用于组卷的分类' };
  }

  const grouped = groupQuestionsByCategory(questions);
  const paper: ExamQuestion[] = [];

  for (const category of selectedCategories) {
    const bucket = grouped[category];
    if (!bucket || bucket.length === 0) {
      return { paper: [], error: `分类“${category}”下没有可用题目，无法组卷` };
    }

    const randomIndex = Math.floor(Math.random() * bucket.length);
    paper.push(bucket[randomIndex]);
  }

  return {
    paper: shuffleArray(paper),
  };
}

export function scoreExamPaper(
  paper: ExamQuestion[],
  userAnswers: Record<string, string>
): ExamResult {
  const items = paper.map(question => {
    const userAnswer = userAnswers[question.id] ?? '';
    const evaluation = evaluateTrainingAnswerTenPoint(userAnswer, question.referenceAnswer);

    return {
      id: question.id,
      category: question.category,
      question: question.question,
      userAnswer,
      referenceAnswer: question.referenceAnswer,
      score: evaluation.tenPointScore,
      maxScore: 10,
      isCorrect: evaluation.isCorrect,
      feedback: evaluation.feedback,
    } satisfies ExamResultItem;
  });

  const totalScore = items.reduce((sum, item) => sum + item.score, 0);
  const correctCount = items.filter(item => item.isCorrect).length;
  const incorrectCount = items.length - correctCount;
  const accuracy = items.length > 0 ? Math.round((correctCount / items.length) * 100) : 0;

  return {
    items,
    totalScore,
    correctCount,
    incorrectCount,
    accuracy,
  };
}
