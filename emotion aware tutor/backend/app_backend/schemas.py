from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ---------- Core Schemas ----------

class StartResponse(BaseModel):
    session_id: str


class NextQuestionResponse(BaseModel):
    id: int = Field(..., description="Ephemeral question identifier within the session")
    concept: str
    difficulty: int
    question: str
    answer: int
    hint: str


class SubmitRequest(BaseModel):
    session_id: str
    question_id: int
    answer_text: str
    rt_ms: int
    fer_positive: float
    fer_neutral: float
    fer_frustrated: float
    ser_positive: Optional[float] = None
    ser_neutral: Optional[float] = None
    ser_frustrated: Optional[float] = None
    ser_vad: Optional[float] = None
    correct_answer: int
    concept: str
    difficulty: int


class NextAction(BaseModel):
    diff_delta: int
    feedback: str


class SubmitResponse(BaseModel):
    reward: float
    mastery: float
    next_action: NextAction


class SessionStats(BaseModel):
    totalQuestions: int
    accuracy: float
    averageResponseTime: Optional[float] = None
    mastery: float


