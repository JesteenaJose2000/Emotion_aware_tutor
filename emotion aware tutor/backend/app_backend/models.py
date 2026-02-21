from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from .database import Base


class Session(Base):
    __tablename__ = "sessions"

    session_id = Column(String, primary_key=True, index=True)
    concept = Column(String, nullable=False)
    mode = Column(String, nullable=False)
    difficulty = Column(Integer, nullable=False, default=1)
    mastery = Column(Float, nullable=False, default=0.0)
    total_questions = Column(Integer, nullable=False, default=0)
    correct_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    logs = relationship("QuestionLog", back_populates="session", cascade="all, delete-orphan")


class QuestionLog(Base):
    __tablename__ = "question_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String, ForeignKey("sessions.session_id"), nullable=False, index=True)
    question_text = Column(String, nullable=False)
    correct_answer = Column(String, nullable=False)
    user_answer = Column(String, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    difficulty = Column(Integer, nullable=False)
    reward = Column(Float, nullable=False)
    fer_positive = Column(Float, nullable=False)
    fer_neutral = Column(Float, nullable=False)
    fer_frustrated = Column(Float, nullable=False)
    response_time = Column(Integer, nullable=False)  # milliseconds
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("Session", back_populates="logs")


