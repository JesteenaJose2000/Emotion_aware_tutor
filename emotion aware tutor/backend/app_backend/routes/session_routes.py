from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession
from typing import Optional
import uuid

from ..database import get_db
from .. import models, schemas
from ..utils import clamp

router = APIRouter()


@router.get("/start", response_model=schemas.StartResponse)
def start_session(
    session_id: Optional[str] = None,
    mode: str = "baseline",
    concept: str = "Maths Concept",
    db: OrmSession = Depends(get_db),
):
    # Generate a session_id if not provided
    if not session_id:
        session_id = f"sess_{uuid.uuid4().hex[:8]}"

    # Try to fetch existing session
    sess = db.query(models.Session).filter(models.Session.session_id == session_id).first()
    if not sess:
        # Create a new session with default mastery/difficulty
        sess = models.Session(
            session_id=session_id,
            concept=concept,
            mode=mode,
            difficulty=1,
            mastery=0.0,
            total_questions=0,
            correct_count=0,
        )
        db.add(sess)
        db.commit()

    return schemas.StartResponse(session_id=session_id)


@router.get("/session/{session_id}/stats", response_model=schemas.SessionStats)
def get_session_stats(session_id: str, db: OrmSession = Depends(get_db)):
    sess = db.query(models.Session).filter(models.Session.session_id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    total_questions = sess.total_questions
    accuracy = (sess.correct_count / total_questions) if total_questions > 0 else 0.0

    # Average response time from logs
    logs = db.query(models.QuestionLog).filter(models.QuestionLog.session_id == session_id).all()
    avg_rt = None
    if logs:
        avg_rt = sum(l.response_time for l in logs) / len(logs)

    return schemas.SessionStats(
        totalQuestions=total_questions,
        accuracy=accuracy,
        averageResponseTime=avg_rt,
        mastery=sess.mastery,
    )


