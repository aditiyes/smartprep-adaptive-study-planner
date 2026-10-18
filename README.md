# SmartPrep — AI-powered adaptive study planner

SmartPrep is a responsive study-planning MVP for GATE and semester exam preparation. It turns an exam date, daily study availability, and focus topics into a day-by-day schedule with review sessions, then tracks quiz performance and exam readiness.

**Live demo:** <https://smartprep-y6zy.onrender.com> · **Source:** <https://github.com/aditiyes/smartprep-adaptive-study-planner>

## What works

- Responsive dashboard, weekly schedule, syllabus tracker, analytics, study assistant, and downloadable study report.
- Constraint-aware schedule generation: sessions stay within the daily hour limit and are placed before the exam date. Higher-weight and selected focus topics receive higher priority; short deadlines report topics that could not fit.
- Topic completion, a five-question Operating Systems practice quiz, lightweight spaced-review suggestions, readiness scoring, and plan regeneration.
- FastAPI JSON API with interactive OpenAPI docs at `/docs`.
- Individual progress is saved in the browser's local storage. The API does not persist personal study data, so a public demo does not expose one student's plan to another.
- Render and Docker deployment configuration.

The study assistant is a small built-in planning guide, not an LLM tutor. This starter does not yet include account registration, PDF syllabus extraction, a hosted database, third-party LLM calls, or model training. These are intentionally not presented as implemented features.

## Run locally

Requires Python 3.9 or newer.

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

Open <http://127.0.0.1:8000>. API docs: <http://127.0.0.1:8000/docs>.

## Run tests

```powershell
py -m unittest discover -s tests -v
```

## API endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/topics` | Built-in GATE CS topic catalog |
| `POST` | `/api/plan/generate` | Generate a schedule from exam date, daily hours, focus topics, and completed topics |
| `POST` | `/api/quiz/submit` | Score a quiz attempt and update topic mastery |
| `POST` | `/api/analytics/readiness` | Calculate readiness and a next-step recommendation |
| `POST` | `/api/assistant/reply` | Return built-in study-planning guidance |

### Generate a plan

```json
{
  "exam_date": "2027-02-01",
  "daily_hours": 4,
  "weak_topics": ["Operating Systems"],
  "completed_topics": []
}
```

## Deploy to Render

The included `render.yaml` creates a free Python web service. Push this folder to a GitHub repository, then in Render choose **New + → Blueprint**, connect that repository, review the `smartprep` web service, and apply. Render builds with `pip install -r requirements.txt`, starts Uvicorn, and checks `/api/health`. The public URL is shown on the service page when deployment succeeds.

This is a stateless demo API; progress is stored locally in each visitor's browser. Clearing that browser's local storage clears its saved progress. The public repository and demo should not be used to store sensitive personal information.

## Docker

```powershell
docker build -t smartprep .
docker run --rm -p 8000:8000 smartprep
```
