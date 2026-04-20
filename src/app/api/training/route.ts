import { NextRequest, NextResponse } from 'next/server';
import {
  createTrainingSession,
  getSession,
  getQuestionsByCategory,
  TrainingCategory,
} from '@/lib/training';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category } = body as { category: TrainingCategory };

    if (!category || !['sales', 'product'].includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category. Must be "sales" or "product".' },
        { status: 400 }
      );
    }

    const session = createTrainingSession(category);
    const totalQuestions = session.questions.length;

    return NextResponse.json({
      sessionId: session.id,
      category: session.category,
      totalQuestions,
      status: session.status,
    });
  } catch (error) {
    console.error('Error creating training session:', error);
    return NextResponse.json(
      { error: 'Failed to create training session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as TrainingCategory | null;

    if (!category || !['sales', 'product'].includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category. Must be "sales" or "product".' },
        { status: 400 }
      );
    }

    const questions = getQuestionsByCategory(category);

    return NextResponse.json({
      category,
      totalQuestions: questions.length,
      questions: questions.map(q => ({
        id: q.id,
        question: q.question,
        scenario: q.scenario,
        node: q.node,
      })),
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}
