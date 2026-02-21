from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession
from typing import Dict

from ..database import get_db
from .. import models, schemas
from ..utils import generate_math_question, fuse_emotions
from ..ai.agent import agent

router = APIRouter()

# In-memory ephemeral question store per session to validate answers if needed.
# Key: (session_id, question_id) -> {"answer": int, "question": str, "concept": str, "difficulty": int}
_QUESTION_CACHE: Dict[tuple, Dict] = {}


@router.get("/next", response_model=schemas.NextQuestionResponse)
def get_next_question(session_id: str, concept: str = "Maths Concept", db: OrmSession = Depends(get_db)):
    sess = db.query(models.Session).filter(models.Session.session_id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    # Use current session difficulty
    difficulty = sess.difficulty

    # Generate a question
    question_text, correct_answer, hint = generate_math_question(concept=concept, difficulty=difficulty)

    # Create a deterministic ephemeral question_id by using total_questions+1
    question_id = sess.total_questions + 1

    # Cache question for verification if needed on submit
    _QUESTION_CACHE[(session_id, question_id)] = {
        "answer": int(correct_answer),
        "question": question_text,
        "concept": concept,
        "difficulty": int(difficulty),
    }

    return schemas.NextQuestionResponse(
        id=question_id,
        concept=concept,
        difficulty=int(difficulty),
        question=question_text,
        answer=int(correct_answer),
        hint=hint,
    )


@router.post("/submit", response_model=schemas.SubmitResponse)
def submit_answer(payload: schemas.SubmitRequest, db: OrmSession = Depends(get_db)):
    sess = db.query(models.Session).filter(models.Session.session_id == payload.session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    # Evaluate correctness strictly by comparing with provided correct_answer (and optionally cache)
    try:
        user_value = int(payload.answer_text)
    except ValueError:
        user_value = None
    is_correct = user_value is not None and user_value == int(payload.correct_answer)

    # Prepare FER values
    fer = {
        "positive": float(payload.fer_positive),
        "neutral": float(payload.fer_neutral),
        "frustrated": float(payload.fer_frustrated),
    }
    
    # Prepare SER values (if provided)
    ser = None
    if payload.ser_positive is not None and payload.ser_neutral is not None and payload.ser_frustrated is not None:
        ser = {
            "positive": float(payload.ser_positive),
            "neutral": float(payload.ser_neutral),
            "frustrated": float(payload.ser_frustrated),
        }
    
    # Fuse FER and SER emotions
    emotions = fuse_emotions(
        fer=fer,
        ser=ser,
        ser_vad=payload.ser_vad,
        lambda_weight=0.6,  # 60% FER, 40% SER (matches frontend default)
        min_vad=0.2,  # Minimum VAD to use SER
    )
    
    # Debug logging to verify fusion is working
    print(f"[EMOTION FUSION] FER: pos={fer['positive']:.3f}, neu={fer['neutral']:.3f}, fru={fer['frustrated']:.3f}")
    if ser:
        print(f"[EMOTION FUSION] SER: pos={ser['positive']:.3f}, neu={ser['neutral']:.3f}, fru={ser['frustrated']:.3f}, vad={payload.ser_vad:.3f}")
    else:
        print(f"[EMOTION FUSION] SER: None (VAD={payload.ser_vad})")
    print(f"[EMOTION FUSION] Fused: pos={emotions['positive']:.3f}, fru={emotions['frustrated']:.3f}")


    try:
        rl_result = agent.step(
            session_id=sess.session_id,
            current_mastery=float(sess.mastery),
            current_difficulty=int(payload.difficulty),
            is_correct=bool(is_correct),
            emotions=emotions,
        )
    except Exception as e:
        print(f"[ERROR] Exception in agent.step(): {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    reward = float(rl_result["reward"])
    new_mastery = float(rl_result["updated_mastery"])
    new_difficulty = int(rl_result["next_difficulty"])
    diff_delta = new_difficulty - sess.difficulty  # Calculate delta for response

    # Feedback rules
    if is_correct:
        feedback = "neutral"
    else:
        if payload.fer_frustrated >= max(payload.fer_positive, payload.fer_neutral):
            feedback = "encourage"
        else:
            feedback = "hint"

    # Persist log
    log = models.QuestionLog(
        session_id=sess.session_id,
        question_text=_QUESTION_CACHE.get((sess.session_id, payload.question_id), {}).get("question", ""),
        correct_answer=str(payload.correct_answer),
        user_answer=str(payload.answer_text),
        is_correct=bool(is_correct),
        difficulty=int(payload.difficulty),
        reward=reward,
        fer_positive=float(payload.fer_positive),
        fer_neutral=float(payload.fer_neutral),
        fer_frustrated=float(payload.fer_frustrated),
        response_time=int(payload.rt_ms),
    )
    db.add(log)

    # Update session aggregates
    sess.total_questions += 1
    if is_correct:
        sess.correct_count += 1
    sess.mastery = new_mastery
    sess.difficulty = new_difficulty

    db.commit()

    # Cleanup cache entry for the submitted question (optional)
    _QUESTION_CACHE.pop((sess.session_id, payload.question_id), None)

    return schemas.SubmitResponse(
        reward=reward,
        mastery=new_mastery,
        next_action=schemas.NextAction(diff_delta=int(diff_delta), feedback=feedback),
    )


