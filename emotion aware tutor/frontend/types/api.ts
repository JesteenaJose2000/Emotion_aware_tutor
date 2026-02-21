export type Question = {
  id: number;
  concept: string;
  difficulty: number;
  question: string;
  answer: number;
  hint?: string;
};

export type SubmitPayload = {
  session_id: string;
  question_id: number;
  answer_text: string;
  rt_ms: number;
  fer_positive: number;
  fer_neutral: number;
  fer_frustrated: number;
  ser_positive?: number;
  ser_neutral?: number;
  ser_frustrated?: number;
  ser_vad?: number;
  correct_answer: number;
  concept: string;
  difficulty: number;
};

export type SubmitResponse = {
  reward: number;
  mastery: number;
  next_action: {
    diff_delta: -1 | 0 | 1;
    feedback: "hint" | "encourage" | "neutral";
  };
};

export type FERState = {
  positive: number;
  neutral: number;
  frustrated: number;
};

export type SessionMode = "baseline" | "bandit";

export type SessionHistory = {
  questionId: number;
  concept: string;
  difficulty: number;
  userAnswer: string;
  correctAnswer: number;
  responseTime: number;
  fer: FERState;
  reward: number;
  mastery: number;
  timestamp: number;
};
