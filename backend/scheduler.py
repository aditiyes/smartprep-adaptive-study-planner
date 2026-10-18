from datetime import date, timedelta
from typing import Any, Dict, List, Optional


TOPICS = [
    {"name": "Data Structures & Algorithms", "subject": "Programming", "hours": 8, "weight": 0.95, "difficulty": 0.8},
    {"name": "Database Management Systems", "subject": "Core CS", "hours": 7, "weight": 0.9, "difficulty": 0.7},
    {"name": "Operating Systems", "subject": "Core CS", "hours": 7, "weight": 0.9, "difficulty": 0.8},
    {"name": "Computer Networks", "subject": "Core CS", "hours": 6, "weight": 0.8, "difficulty": 0.7},
    {"name": "Computer Organization", "subject": "Core CS", "hours": 6, "weight": 0.75, "difficulty": 0.8},
    {"name": "Theory of Computation", "subject": "Core CS", "hours": 6, "weight": 0.75, "difficulty": 0.9},
    {"name": "Discrete Mathematics", "subject": "Mathematics", "hours": 6, "weight": 0.8, "difficulty": 0.75},
    {"name": "Engineering Mathematics", "subject": "Mathematics", "hours": 7, "weight": 0.85, "difficulty": 0.7},
    {"name": "General Aptitude", "subject": "Aptitude", "hours": 4, "weight": 0.7, "difficulty": 0.45},
]


def _priority(topic: Dict[str, Any], is_weak: bool, revision_urgency: float) -> float:
    weakness = 1.0 if is_weak else 0.35
    return (
        0.35 * topic["weight"]
        + 0.25 * topic["difficulty"]
        + 0.25 * weakness
        + 0.15 * revision_urgency
    )


def _session_id(study_date: date, session_type: str, topic_name: str) -> str:
    topic_slug = "-".join(topic_name.lower().replace("&", "and").split())
    return "{}-{}-{}".format(study_date.isoformat(), session_type.lower(), topic_slug)


def generate_plan(
    exam_date: date,
    daily_hours: float,
    weak_topics: Optional[List[str]] = None,
    completed_topics: Optional[List[str]] = None,
    today: Optional[date] = None,
) -> Dict[str, Any]:
    """Build a balanced weekly plan within daily study-hour and exam-date limits."""
    today = today or date.today()
    weak = set(weak_topics or [])
    completed = set(completed_topics or [])
    days_remaining = (exam_date - today).days
    if days_remaining <= 0:
        raise ValueError("exam_date must be after today")
    if days_remaining > 730:
        raise ValueError("exam_date must be within the next two years")

    remaining = {
        topic["name"]: float(topic["hours"])
        for topic in TOPICS
        if topic["name"] not in completed
    }
    topic_lookup = {topic["name"]: topic for topic in TOPICS}
    sessions: List[Dict[str, Any]] = []
    daily_capacity = float(daily_hours)
    scheduled_learning = 0.0

    for offset in range(days_remaining):
        study_date = today + timedelta(days=offset)
        available = daily_capacity
        day_topics = sorted(
            remaining,
            key=lambda name: _priority(
                topic_lookup[name],
                name in weak,
                0.75 if name in weak else 0.35,
            ),
            reverse=True,
        )
        for name in day_topics:
            if available < 0.5:
                break
            unallocated = remaining[name]
            duration = min(2.0, unallocated, available)
            duration = round(duration * 2) / 2
            if duration < 0.5:
                continue
            topic = topic_lookup[name]
            session_id = _session_id(study_date, "learn", name)
            sessions.append(
                {
                    "id": session_id,
                    "date": study_date.isoformat(),
                    "topic": name,
                    "subject": topic["subject"],
                    "type": "Learn",
                    "title": "Learn: {}".format(name),
                    "duration": duration,
                    "priority": round(_priority(topic, name in weak, 0.35), 2),
                }
            )
            remaining[name] = round(unallocated - duration, 2)
            available = round(available - duration, 2)
            scheduled_learning += duration
            if remaining[name] <= 0:
                del remaining[name]

        if available >= 0.5 and offset > 0 and offset % 3 == 0:
            recently_studied = [
                session for session in sessions
                if session["type"] == "Learn"
                and 1 <= (study_date - date.fromisoformat(session["date"])).days <= 4
            ]
            if recently_studied:
                previous = recently_studied[-1]
                duration = min(1.0, available)
                sessions.append(
                    {
                        "id": _session_id(study_date, "review", previous["topic"]),
                        "date": study_date.isoformat(),
                        "topic": previous["topic"],
                        "subject": previous["subject"],
                        "type": "Review",
                        "title": "Spaced review: {}".format(previous["topic"]),
                        "duration": duration,
                        "priority": previous["priority"],
                    }
                )

        if not remaining:
            break

    sessions.sort(key=lambda item: (item["date"], item["type"] != "Review", -item["priority"]))
    planned_hours = round(sum(session["duration"] for session in sessions), 1)
    all_names = {topic["name"] for topic in TOPICS}
    return {
        "sessions": sessions,
        "topics": [
            {
                "name": topic["name"],
                "subject": topic["subject"],
                "estimated_hours": topic["hours"],
                "priority": round(_priority(topic, topic["name"] in weak, 0.35), 2),
                "status": "complete" if topic["name"] in completed else (
                    "planned" if topic["name"] not in remaining else "in progress"
                ),
            }
            for topic in TOPICS
        ],
        "summary": {
            "exam_date": exam_date.isoformat(),
            "days_remaining": days_remaining,
            "daily_hours": daily_capacity,
            "planned_hours": planned_hours,
            "learning_hours": round(scheduled_learning, 1),
            "unscheduled_topics": sorted(set(remaining).intersection(all_names)),
        },
    }
