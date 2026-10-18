from datetime import date
from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.scheduler import TOPICS, generate_plan


ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(
    title="SmartPrep API",
    description="A personalized study planner and exam-readiness toolkit.",
    version="1.0.0",
)


class PlanRequest(BaseModel):
    exam_date: date
    daily_hours: float = Field(ge=1, le=12)
    weak_topics: List[str] = Field(default_factory=list)
    completed_topics: List[str] = Field(default_factory=list)


class QuizRequest(BaseModel):
    topic: str
    correct_answers: int = Field(ge=0)
    total_questions: int = Field(gt=0, le=100)
    time_taken_minutes: int = Field(ge=0, le=600)
    previous_mastery: float = Field(default=0.5, ge=0, le=1)


class ReadinessRequest(BaseModel):
    topics: List[dict]
    quiz_scores: List[float] = Field(default_factory=list)
    revision_rate: float = Field(default=0.0, ge=0, le=1)
    days_remaining: int = Field(ge=0, le=730)


class AssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    weak_topics: List[str] = Field(default_factory=list)
    days_remaining: int = Field(ge=0, le=730)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "SmartPrep"}


@app.get("/api/topics")
def list_topics():
    return {"topics": TOPICS}


@app.post("/api/plan/generate")
def create_plan(request: PlanRequest):
    try:
        return generate_plan(
            exam_date=request.exam_date,
            daily_hours=request.daily_hours,
            weak_topics=request.weak_topics,
            completed_topics=request.completed_topics,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))


@app.post("/api/quiz/submit")
def submit_quiz(request: QuizRequest):
    if request.correct_answers > request.total_questions:
        raise HTTPException(status_code=422, detail="correct_answers cannot exceed total_questions")
    accuracy = request.correct_answers / request.total_questions
    mastery = min(1.0, max(0.0, request.previous_mastery * 0.6 + accuracy * 0.4))
    return {
        "topic": request.topic,
        "accuracy": round(accuracy, 3),
        "mastery": round(mastery, 3),
        "is_weak": mastery < 0.65,
        "next_review_days": 1 if accuracy < 0.5 else (3 if accuracy < 0.8 else 7),
        "time_taken_minutes": request.time_taken_minutes,
    }


@app.post("/api/analytics/readiness")
def exam_readiness(request: ReadinessRequest):
    topic_count = len(request.topics)
    completion = (
        sum(1 for topic in request.topics if topic.get("status") == "complete") / topic_count
        if topic_count else 0.0
    )
    quiz_average = (
        sum(request.quiz_scores) / len(request.quiz_scores)
        if request.quiz_scores else 0.5
    )
    urgency_factor = max(0.0, min(1.0, request.days_remaining / 120))
    score = round(
        100 * (0.45 * completion + 0.35 * quiz_average + 0.20 * request.revision_rate)
    )
    if request.days_remaining <= 7:
        suggestion = "Prioritize short revisions and timed practice over new topics."
    elif completion < 0.4 or urgency_factor < 0.25:
        suggestion = "Focus on your highest-priority unfinished topics and protect daily study time."
    elif quiz_average < 0.65:
        suggestion = "Review recent mistakes, then retry topic-wise practice questions."
    else:
        suggestion = "Keep your revision cadence and add a timed mock test this week."
    return {
        "score": score,
        "label": "Strong" if score >= 75 else ("Building" if score >= 50 else "Getting started"),
        "completion": round(completion, 3),
        "quiz_average": round(quiz_average, 3),
        "suggestion": suggestion,
    }


@app.post("/api/assistant/reply")
def assistant_reply(request: AssistantRequest):
    question = request.question.lower()
    weak = request.weak_topics[:3]
    if any(word in question for word in ("weak", "focus", "priority")):
        focus = ", ".join(weak) if weak else "your lowest-scoring recent quiz topic"
        reply = "Start with {}. Try a 45-minute concept review, solve 5 focused questions, then record what still feels unclear.".format(focus)
    elif any(word in question for word in ("revision", "review", "forget")):
        reply = "Use short retrieval practice before rereading: recall the key ideas from memory, check gaps, then schedule another review in 3 days."
    elif any(word in question for word in ("plan", "schedule", "missed")):
        reply = "Your plan puts higher-weight and weaker topics first while staying within your daily hours. If you missed a session, regenerate your plan with your latest availability."
    else:
        reply = "I can help you prioritize weak areas, plan a revision session, or explain how the schedule is balanced. Try asking about one of those."
    if request.days_remaining <= 14:
        reply += " With {} days left, keep sessions focused and include timed practice.".format(request.days_remaining)
    return {"reply": reply, "source": "SmartPrep study-planning guidance"}


@app.get("/")
def index():
    return FileResponse(ROOT / "static" / "index.html")


app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")
