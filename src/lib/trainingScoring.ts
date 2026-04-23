export interface AnswerEvaluation {
  score: number;
  feedback: string;
}

export interface TenPointAnswerEvaluation extends AnswerEvaluation {
  tenPointScore: number;
  isCorrect: boolean;
}

export function evaluateTrainingAnswer(userAnswer: string, standardAnswer: string): AnswerEvaluation {
  if (!userAnswer.trim()) {
    return { score: 0, feedback: '未作答' };
  }

  if (!standardAnswer.trim()) {
    return { score: 7, feedback: '已作答' };
  }

  const cleanAnswer = standardAnswer.replace(/[*#]/g, '').toLowerCase();
  const cleanUser = userAnswer.replace(/[*#]/g, '').toLowerCase();

  const keyPhrases = cleanAnswer
    .split(/[,，。.、\n]/)
    .map(phrase => phrase.trim())
    .filter(phrase => phrase.length > 2);

  const matchedPhrases = keyPhrases.filter(phrase => cleanUser.includes(phrase));
  const matchRate = keyPhrases.length > 0 ? matchedPhrases.length / keyPhrases.length : 0;

  if (matchRate >= 0.6) {
    return { score: 9, feedback: '回答准确，要点齐全' };
  }

  if (matchRate >= 0.4) {
    return { score: 7, feedback: '回答基本正确，但有遗漏' };
  }

  if (matchRate >= 0.2) {
    return { score: 5, feedback: '回答部分正确，核心要点不完整' };
  }

  return { score: 3, feedback: '回答偏离要点' };
}

export function evaluateTrainingAnswerTenPoint(
  userAnswer: string,
  standardAnswer: string
): TenPointAnswerEvaluation {
  const base = evaluateTrainingAnswer(userAnswer, standardAnswer);

  const scoreMap: Record<number, number> = {
    0: 0,
    3: 4,
    5: 6,
    7: 8,
    9: 10,
  };

  const tenPointScore = scoreMap[base.score] ?? 0;

  return {
    ...base,
    tenPointScore,
    isCorrect: tenPointScore >= 8,
  };
}
