import unittest
from datetime import date, timedelta

from backend.scheduler import TOPICS, generate_plan


class StudyPlanTests(unittest.TestCase):
    def setUp(self):
        self.today = date(2026, 10, 18)
        self.exam_date = self.today + timedelta(days=30)

    def test_schedule_respects_daily_hour_limit(self):
        result = generate_plan(self.exam_date, 3, today=self.today)
        totals = {}
        for session in result["sessions"]:
            totals[session["date"]] = totals.get(session["date"], 0) + session["duration"]
        self.assertTrue(all(hours <= 3 for hours in totals.values()))

    def test_exam_date_bounds_plan(self):
        result = generate_plan(self.exam_date, 4, today=self.today)
        self.assertTrue(all(session["date"] < self.exam_date.isoformat() for session in result["sessions"]))

    def test_focus_topics_receive_higher_priority(self):
        result = generate_plan(
            self.exam_date,
            4,
            weak_topics=["Operating Systems"],
            today=self.today,
        )
        topics = {topic["name"]: topic for topic in result["topics"]}
        self.assertGreater(
            topics["Operating Systems"]["priority"],
            topics["General Aptitude"]["priority"],
        )

    def test_completed_topics_are_not_scheduled(self):
        topic = TOPICS[0]["name"]
        result = generate_plan(self.exam_date, 4, completed_topics=[topic], today=self.today)
        self.assertNotIn(topic, [session["topic"] for session in result["sessions"]])
        self.assertEqual(
            next(item for item in result["topics"] if item["name"] == topic)["status"],
            "complete",
        )

    def test_short_deadline_reports_topics_that_do_not_fit(self):
        result = generate_plan(self.today + timedelta(days=1), 1, today=self.today)
        self.assertTrue(result["summary"]["unscheduled_topics"])

    def test_invalid_exam_date_is_rejected(self):
        with self.assertRaises(ValueError):
            generate_plan(self.today, 4, today=self.today)


if __name__ == "__main__":
    unittest.main()
