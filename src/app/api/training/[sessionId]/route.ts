import { NextRequest, NextResponse } from 'next/server';
import {
  getSession,
  updateSessionAnswer,
  getNextQuestion,
  completeSession,
  saveSession,
} from '@/lib/training';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

// GET: Get current session state and next question
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const session = getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const nextQuestion = getNextQuestion(sessionId);

    return NextResponse.json({
      sessionId: session.id,
      category: session.category,
      totalQuestions: session.questions.length,
      askedCount: session.askedQuestionIds.length,
      status: session.status,
      nextQuestion: nextQuestion
        ? {
            id: nextQuestion.id,
            question: nextQuestion.question,
            scenario: nextQuestion.scenario,
            node: nextQuestion.node,
            standardAnswer: nextQuestion.standardAnswer, // Include for later evaluation
            iceBreakerScript: nextQuestion.iceBreakerScript,
          }
        : null,
      // Include all Q&A for evaluation phase
      qaHistory:
        session.status === 'completed'
          ? session.questions.map((q) => ({
              id: q.id,
              question: q.question,
              answer: session.answers[q.id] || '',
              standardAnswer: q.standardAnswer,
              iceBreakerScript: q.iceBreakerScript,
              scenario: q.scenario,
              node: q.node,
            }))
          : null,
    });
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

// POST: Submit answer for current question
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const { questionId, answer } = body as { questionId: string; answer: string };

    if (!questionId || answer === undefined) {
      return NextResponse.json(
        { error: 'questionId and answer are required' },
        { status: 400 }
      );
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.status === 'completed') {
      return NextResponse.json(
        { error: 'Session already completed' },
        { status: 400 }
      );
    }

    // Update the answer
    const updatedSession = updateSessionAnswer(sessionId, questionId, answer);

    if (!updatedSession) {
      return NextResponse.json(
        { error: 'Failed to update answer' },
        { status: 500 }
      );
    }

    // Check if there's a next question
    const nextQuestion = getNextQuestion(sessionId);

    return NextResponse.json({
      sessionId: updatedSession.id,
      totalQuestions: updatedSession.questions.length,
      askedCount: updatedSession.askedQuestionIds.length,
      status: updatedSession.status,
      nextQuestion: nextQuestion
        ? {
            id: nextQuestion.id,
            question: nextQuestion.question,
            scenario: nextQuestion.scenario,
            node: nextQuestion.node,
            standardAnswer: nextQuestion.standardAnswer,
            iceBreakerScript: nextQuestion.iceBreakerScript,
          }
        : null,
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    return NextResponse.json(
      { error: 'Failed to submit answer' },
      { status: 500 }
    );
  }
}
