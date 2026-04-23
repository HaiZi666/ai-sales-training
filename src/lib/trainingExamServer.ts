import path from 'path';
import * as XLSX from 'xlsx';
import {
  buildExamPaper,
  EXAM_PAPER_CATEGORY_COUNT,
  getExamPaperCategoryCount,
  groupQuestionsByCategory,
  parseExamQuestions,
  pickRandomCategories,
  type ExamQuestion,
} from '@/lib/trainingExam';

const EXAM_FILE_PATH = path.join(process.cwd(), 'src/data/tables', 'ExamQuestions.xlsx');

export interface LoadedExamQuestionBank {
  questions: ExamQuestion[];
  categories: string[];
  categoryCounts: Record<string, number>;
  validCategories: string[];
  errors: string[];
  warnings: string[];
}

export interface RandomExamPaperResult {
  paper: ExamQuestion[];
  selectedCategories: string[];
  actualCategoryCount: number;
  errors: string[];
  warnings: string[];
}

export function loadExamQuestionBank(): LoadedExamQuestionBank {
  const workbook = XLSX.readFile(EXAM_FILE_PATH);
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return {
      questions: [],
      categories: [],
      categoryCounts: {},
      validCategories: [],
      errors: ['ExamQuestions 无可读取工作表'],
      warnings: [],
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  const parsed = parseExamQuestions(rawData);
  const grouped = groupQuestionsByCategory(parsed.questions);
  const categoryCounts = Object.fromEntries(
    Object.entries(grouped).map(([category, questions]) => [category, questions.length])
  );
  const categories = Object.keys(grouped);
  const validCategories = categories.filter(category => (categoryCounts[category] ?? 0) > 0);

  return {
    questions: parsed.questions,
    categories,
    categoryCounts,
    validCategories,
    errors: parsed.errors,
    warnings: parsed.warnings,
  };
}

export function createRandomExamPaper(
  requestedCategoryCount = EXAM_PAPER_CATEGORY_COUNT
): RandomExamPaperResult {
  const bank = loadExamQuestionBank();

  if (bank.questions.length === 0 || bank.validCategories.length === 0) {
    return {
      paper: [],
      selectedCategories: [],
      actualCategoryCount: 0,
      errors: bank.errors.length > 0 ? bank.errors : ['ExamQuestions 无有效数据，无法开始考试'],
      warnings: bank.warnings,
    };
  }

  const actualCategoryCount = getExamPaperCategoryCount(
    Math.min(requestedCategoryCount, bank.validCategories.length)
  );

  const selectedCategories = pickRandomCategories(bank.validCategories, actualCategoryCount);
  if (selectedCategories.length !== actualCategoryCount) {
    return {
      paper: [],
      selectedCategories: [],
      actualCategoryCount,
      errors: [`随机抽取 ${actualCategoryCount} 个分类失败，请稍后重试`],
      warnings: bank.warnings,
    };
  }

  const buildResult = buildExamPaper(bank.questions, selectedCategories);
  if (buildResult.error) {
    return {
      paper: [],
      selectedCategories,
      actualCategoryCount,
      errors: [buildResult.error],
      warnings: bank.warnings,
    };
  }

  return {
    paper: buildResult.paper,
    selectedCategories,
    actualCategoryCount,
    errors: bank.errors,
    warnings: bank.warnings,
  };
}
