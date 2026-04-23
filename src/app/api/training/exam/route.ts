import { NextResponse } from 'next/server';
import { loadExamQuestionBank } from '@/lib/trainingExamServer';

export async function GET() {
  try {
    const bank = loadExamQuestionBank();

    if (bank.errors.length > 0 && bank.questions.length === 0) {
      return NextResponse.json(
        {
          error: bank.errors[0],
          errors: bank.errors,
          warnings: bank.warnings,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      questions: bank.questions,
      categories: bank.categories,
      categoryCounts: bank.categoryCounts,
      errors: bank.errors,
      warnings: bank.warnings,
    });
  } catch (error) {
    console.error('读取 ExamQuestions 失败:', error);
    return NextResponse.json({ error: 'ExamQuestions 读取失败，请检查题库文件' }, { status: 500 });
  }
}
