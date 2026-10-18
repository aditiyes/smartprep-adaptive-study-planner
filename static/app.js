const TOPICS = [
  { name: "Data Structures & Algorithms", subject: "Programming", hours: 8, weight: .95, difficulty: .8 },
  { name: "Database Management Systems", subject: "Core CS", hours: 7, weight: .9, difficulty: .7 },
  { name: "Operating Systems", subject: "Core CS", hours: 7, weight: .9, difficulty: .8 },
  { name: "Computer Networks", subject: "Core CS", hours: 6, weight: .8, difficulty: .7 },
  { name: "Computer Organization", subject: "Core CS", hours: 6, weight: .75, difficulty: .8 },
  { name: "Theory of Computation", subject: "Core CS", hours: 6, weight: .75, difficulty: .9 },
  { name: "Discrete Mathematics", subject: "Mathematics", hours: 6, weight: .8, difficulty: .75 },
  { name: "Engineering Mathematics", subject: "Mathematics", hours: 7, weight: .85, difficulty: .7 },
  { name: "General Aptitude", subject: "Aptitude", hours: 4, weight: .7, difficulty: .45 }
];
const STORAGE_KEY = "smartprep-state-v1";
const today = new Date();
today.setHours(0, 0, 0, 0);
const dateString = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const futureDate = new Date(today);
futureDate.setDate(futureDate.getDate() + 120);
let state = readState();
let currentFilter = "all";

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.plan)) return saved;
  } catch (error) {
    console.warn("Could not load saved study progress.", error);
  }
  return {
    examDate: dateString(futureDate),
    dailyHours: 4,
    weakTopics: ["Operating Systems", "Database Management Systems"],
    completed: [],
    completedTopics: [],
    mastery: {},
    quizScores: [],
    plan: []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

async function api(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.detail || "Request failed. Please try again.");
  return result;
}

async function generatePlan(notify = false) {
  const result = await api("/api/plan/generate", {
    exam_date: state.examDate,
    daily_hours: Number(state.dailyHours),
    weak_topics: state.weakTopics,
    completed_topics: state.completedTopics
  });
  state.plan = result.sessions;
  saveState();
  renderAll();
  if (notify) {
    const unplanned = result.summary.unscheduled_topics.length;
    showToast(unplanned ? `Plan updated. ${unplanned} topic(s) need more time.` : "Your personalized study plan is ready.");
  }
}

function topicStatus(topic) {
  if (state.completedTopics.includes(topic.name)) return "complete";
  const sessions = state.plan.filter((session) => session.topic === topic.name);
  return state.completed.includes(...sessions.map((session) => session.id)) ? "in progress" : (sessions.length ? "planned" : "not planned");
}

function daysToExam() {
  return Math.max(0, Math.ceil((new Date(`${state.examDate}T00:00:00`) - today) / 86400000));
}

function renderSessions(target, sessions, limit) {
  const container = document.getElementById(target);
  const list = limit ? sessions.slice(0, limit) : sessions;
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">Nothing scheduled yet. Build a plan to see your next sessions.</div>';
    return;
  }
  container.innerHTML = list.map((session) => {
    const done = state.completed.includes(session.id);
    const date = new Date(`${session.date}T00:00:00`);
    const displayDate = session.date === dateString(today) ? "Today" : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const label = session.type === "Review" ? "Review" : "Learn";
    return `<div class="session-row ${done ? "session-done" : ""}"><div class="session-time">${displayDate}</div><div class="session-info"><span class="session-color"></span><strong>${escapeHtml(session.title)}</strong><span>${escapeHtml(session.subject)} · ${label}</span></div><span class="${session.type === "Review" ? "session-tag" : "session-duration"}">${done ? "Done ✓" : `${session.duration} hr${session.duration === 1 ? "" : "s"}`}</span></div>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function topicCompleteCount() {
  return state.completedTopics.length;
}

function quizAverage() {
  if (!state.quizScores.length) return null;
  return state.quizScores.reduce((sum, score) => sum + score, 0) / state.quizScores.length;
}

function renderDashboard() {
  const countdown = daysToExam();
  document.getElementById("countdown").textContent = countdown;
  document.getElementById("exam-subtitle").textContent = `Exam date: ${new Date(`${state.examDate}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} · Your plan is built around your time.`;
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const week = state.plan.filter((session) => new Date(`${session.date}T00:00:00`) >= today && new Date(`${session.date}T00:00:00`) < weekEnd);
  const plannedHours = week.reduce((sum, item) => sum + item.duration, 0);
  const doneHours = week.filter((item) => state.completed.includes(item.id)).reduce((sum, item) => sum + item.duration, 0);
  const denominator = Number(state.dailyHours) * 7;
  const percent = denominator ? Math.min(100, Math.round(doneHours / denominator * 100)) : 0;
  document.getElementById("weekly-hours").textContent = `${doneHours} / ${Math.min(denominator, plannedHours)} hrs`;
  document.getElementById("weekly-percent").textContent = `${percent}%`;
  document.getElementById("weekly-ring").style.setProperty("--ring", `${percent * 3.6}deg`);
  document.getElementById("metric-hours").innerHTML = `${plannedHours}<span> hrs</span>`;
  const completion = TOPICS.length ? Math.round(topicCompleteCount() / TOPICS.length * 100) : 0;
  document.getElementById("metric-syllabus").innerHTML = `${completion}<span>%</span>`;
  document.getElementById("metric-topics").textContent = `${topicCompleteCount()} of ${TOPICS.length} topics`;
  document.getElementById("syllabus-progress").style.width = `${completion}%`;
  const average = quizAverage();
  document.getElementById("metric-accuracy").innerHTML = `${average === null ? "—" : Math.round(average * 100)}<span>%</span>`;
  document.getElementById("quiz-message").textContent = average === null ? "Try a quick quiz to start" : `${state.quizScores.length} practice attempt${state.quizScores.length === 1 ? "" : "s"}`;
  document.getElementById("metric-weak").innerHTML = `${state.weakTopics.length}<span> topics</span>`;
  const todays = state.plan.filter((session) => session.date === dateString(today));
  renderSessions("today-sessions", todays, 3);
  document.getElementById("today-total").textContent = todays.length ? `${todays.reduce((sum, item) => sum + item.duration, 0)} hours planned today` : "No sessions scheduled for today";
  const next = state.plan.find((session) => !state.completed.includes(session.id));
  document.getElementById("complete-next").disabled = !next;
  document.getElementById("complete-next").style.opacity = next ? "1" : ".55";
  renderWeekChart(week);
  updateReadiness();
}

function renderWeekChart(week) {
  const container = document.getElementById("week-chart");
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() + index);
    const key = dateString(date);
    const planned = week.filter((item) => item.date === key).reduce((sum, item) => sum + item.duration, 0);
    const done = week.filter((item) => item.date === key && state.completed.includes(item.id)).reduce((sum, item) => sum + item.duration, 0);
    const max = Math.max(Number(state.dailyHours), planned, 1);
    return `<div class="day-column"><span class="day-label">${date.toLocaleDateString(undefined, { weekday: "short" })}</span><div class="bar-pair"><i style="height:${Math.max(4, planned / max * 56)}px"></i><i class="done" style="height:${done ? Math.max(4, done / max * 56) : 3}px"></i></div><span class="day-date">${date.getDate()}</span></div>`;
  });
  container.innerHTML = days.join("");
}

async function updateReadiness() {
  const statuses = TOPICS.map((topic) => ({ status: state.completedTopics.includes(topic.name) ? "complete" : "planned" }));
  try {
    const result = await api("/api/analytics/readiness", {
      topics: statuses,
      quiz_scores: state.quizScores,
      revision_rate: state.plan.length ? state.completed.filter((id) => state.plan.find((item) => item.id === id && item.type === "Review")).length / Math.max(1, state.plan.filter((item) => item.type === "Review").length) : 0,
      days_remaining: daysToExam()
    });
    document.getElementById("readiness-score").textContent = result.score;
    document.getElementById("readiness-label").textContent = result.label;
    document.getElementById("readiness-bar").style.width = `${result.score}%`;
    document.getElementById("readiness-completion").textContent = `${Math.round(result.completion * 100)}%`;
    document.getElementById("readiness-tip").textContent = result.suggestion;
    document.getElementById("analytics-readiness").textContent = `${result.score}/100`;
  } catch (error) {
    showToast(error.message);
  }
}

function renderTopics() {
  const container = document.getElementById("topic-table-body");
  const filterTopics = TOPICS.filter((topic) => {
    if (currentFilter === "focus") return state.weakTopics.includes(topic.name);
    if (currentFilter === "complete") return state.completedTopics.includes(topic.name);
    return true;
  });
  container.innerHTML = filterTopics.map((topic) => {
    const weak = state.weakTopics.includes(topic.name);
    const mastery = state.mastery[topic.name];
    const status = state.completedTopics.includes(topic.name) ? "complete" : (mastery !== undefined ? "in progress" : "planned");
    const priority = topic.weight >= .85 || weak ? "High" : (topic.weight >= .75 ? "Medium" : "Steady");
    return `<tr><td><span class="subject-pill">${escapeHtml(topic.subject)}</span></td><td class="topic-name">${escapeHtml(topic.name)}${weak ? ' <span title="Focus topic">✦</span>' : ""}</td><td><span class="subject-pill priority-${priority.toLowerCase()}">${priority}</span></td><td>${topic.hours} hrs</td><td><span class="status-pill ${status === "complete" ? "complete" : status === "in progress" ? "in-progress" : ""}">${status}</span></td><td><button class="row-action" data-topic="${escapeHtml(topic.name)}">${status === "complete" ? "Undo" : "Mark done"}</button></td></tr>`;
  }).join("") || '<tr><td colspan="6" class="empty-state">No topics match this filter yet.</td></tr>';
  document.getElementById("syllabus-big-percent").textContent = `${Math.round(topicCompleteCount() / TOPICS.length * 100)}%`;
  document.getElementById("syllabus-big-progress").style.width = `${Math.round(topicCompleteCount() / TOPICS.length * 100)}%`;
  document.getElementById("syllabus-count").textContent = TOPICS.length;
  document.getElementById("focus-count").textContent = state.weakTopics.length;
  document.getElementById("syllabus-progress-label").textContent = `${topicCompleteCount()} of ${TOPICS.length} topics marked complete.`;
}

function renderAnalytics() {
  const average = quizAverage();
  document.getElementById("analytics-sessions").textContent = state.completed.length;
  document.getElementById("analytics-quiz").textContent = average === null ? "—" : `${Math.round(average * 100)}%`;
  document.getElementById("practice-accuracy").textContent = average === null ? "—" : `${Math.round(average * 100)}%`;
  document.getElementById("practice-progress").style.width = `${average === null ? 0 : Math.round(average * 100)}%`;
  const subjects = [...new Set(TOPICS.map((topic) => topic.subject))].map((subject) => {
    const items = state.plan.filter((session) => session.subject === subject);
    const hours = items.reduce((sum, item) => sum + item.duration, 0);
    const total = state.plan.reduce((sum, item) => sum + item.duration, 0) || 1;
    return `<div><div class="subject-bar-header"><span>${escapeHtml(subject)}</span><strong>${hours}h · ${Math.round(hours / total * 100)}%</strong></div><div class="subject-track"><i style="width:${hours / total * 100}%"></i></div></div>`;
  }).filter((item) => item).join("");
  document.getElementById("subject-bars").innerHTML = subjects || '<div class="empty-state">Generate a plan to see your study allocation.</div>';
  const focus = state.weakTopics.slice(0, 3);
  document.getElementById("recommendations").innerHTML = focus.map((topic, index) => `<div class="recommendation"><span class="recommendation-symbol">${index + 1}</span><div><strong>${escapeHtml(topic)}</strong><p>${state.mastery[topic] !== undefined ? `Current mastery: ${Math.round(state.mastery[topic] * 100)}%. Keep practicing in short sessions.` : "Focus on one concept, then solve a few practice questions."}</p></div></div>`).join("") || '<div class="empty-state">Complete a quiz to build your personalized focus list.</div>';
}

function renderAll() {
  renderDashboard();
  renderTopics();
  renderAnalytics();
  renderSessions("upcoming-sessions", state.plan.filter((session) => session.date >= dateString(today)), 12);
  document.getElementById("session-count").textContent = `${state.plan.length} sessions`;
  document.getElementById("context-countdown").textContent = `${daysToExam()} days`;
  document.getElementById("context-hours").textContent = `${state.dailyHours} hours`;
  document.getElementById("context-focus").textContent = `${state.weakTopics.length} selected`;
}

function goToView(name) {
  document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === `page-${name}`));
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  const active = document.querySelector(`.nav-item[data-view="${name}"]`);
  document.getElementById("page-name").textContent = active ? active.textContent.trim() : "Overview";
  document.getElementById("sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderWeakTopicOptions() {
  const container = document.getElementById("weak-topic-options");
  container.innerHTML = TOPICS.map((topic) => `<button type="button" class="topic-chip ${state.weakTopics.includes(topic.name) ? "selected" : ""}" data-weak="${escapeHtml(topic.name)}">${escapeHtml(topic.name)}</button>`).join("");
}

function markComplete(sessionId) {
  const session = state.plan.find((item) => item.id === sessionId);
  if (!session || state.completed.includes(sessionId)) return;
  state.completed.push(sessionId);
  if (session.type === "Learn" && !state.plan.some((item) => item.type === "Learn" && item.topic === session.topic && !state.completed.includes(item.id))) {
    if (!state.completedTopics.includes(session.topic)) state.completedTopics.push(session.topic);
  }
  saveState();
  renderAll();
  showToast("Nice work. Your progress is saved on this device.");
}

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", (event) => {
  event.preventDefault();
  goToView(button.dataset.view);
}));
document.getElementById("menu-toggle").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
document.getElementById("help-button").addEventListener("click", () => showToast("Your study data is saved privately in this browser."));
document.getElementById("today-label").textContent = today.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
document.getElementById("exam-date").min = dateString(new Date(today.getTime() + 86400000));
document.getElementById("exam-date").value = state.examDate;
document.getElementById("daily-hours").value = state.dailyHours;
document.getElementById("hours-value").textContent = state.dailyHours;
renderWeakTopicOptions();

document.getElementById("daily-hours").addEventListener("input", (event) => {
  document.getElementById("hours-value").textContent = event.target.value;
});
document.getElementById("weak-topic-options").addEventListener("click", (event) => {
  const topic = event.target.closest("[data-weak]")?.dataset.weak;
  if (!topic) return;
  state.weakTopics = state.weakTopics.includes(topic) ? state.weakTopics.filter((item) => item !== topic) : [...state.weakTopics, topic];
  event.target.closest("[data-weak]").classList.toggle("selected");
});
document.getElementById("planner-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  state.examDate = document.getElementById("exam-date").value;
  state.dailyHours = Number(document.getElementById("daily-hours").value);
  saveState();
  try {
    await generatePlan(true);
    goToView("planner");
  } catch (error) {
    showToast(error.message);
  }
});
document.getElementById("complete-next").addEventListener("click", () => {
  const next = state.plan.find((session) => !state.completed.includes(session.id));
  if (next) markComplete(next.id);
});
document.getElementById("refresh-plan").addEventListener("click", async () => {
  try {
    await generatePlan(true);
  } catch (error) {
    showToast(error.message);
  }
});
document.querySelectorAll(".filter-pill").forEach((button) => button.addEventListener("click", () => {
  currentFilter = button.dataset.filter;
  document.querySelectorAll(".filter-pill").forEach((item) => item.classList.toggle("active", item === button));
  renderTopics();
}));
document.getElementById("topic-table-body").addEventListener("click", async (event) => {
  const topic = event.target.closest("[data-topic]")?.dataset.topic;
  if (!topic) return;
  if (state.completedTopics.includes(topic)) state.completedTopics = state.completedTopics.filter((item) => item !== topic);
  else state.completedTopics.push(topic);
  state.completed = state.plan.filter((session) => session.topic === topic).map((session) => session.id).filter((id) => !state.completed.includes(id)).concat(state.completed);
  saveState();
  try {
    await generatePlan(false);
    showToast(state.completedTopics.includes(topic) ? "Topic marked complete." : "Topic reopened.");
  } catch (error) {
    showToast(error.message);
  }
});
document.getElementById("quiz-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const questions = [...document.querySelectorAll(".question")];
  const correct = questions.reduce((count, question, index) => count + (question.querySelector(`input[name="q${index + 1}"]:checked`)?.value === question.dataset.answer ? 1 : 0), 0);
  const previous = state.mastery["Operating Systems"] ?? 0.5;
  try {
    const result = await api("/api/quiz/submit", { topic: "Operating Systems", correct_answers: correct, total_questions: questions.length, time_taken_minutes: 3, previous_mastery: previous });
    state.mastery[result.topic] = result.mastery;
    state.quizScores.push(result.accuracy);
    if (result.is_weak && !state.weakTopics.includes(result.topic)) state.weakTopics.push(result.topic);
    if (!result.is_weak) state.weakTopics = state.weakTopics.filter((topic) => topic !== result.topic);
    saveState();
    const box = document.getElementById("quiz-result");
    box.hidden = false;
    box.textContent = `You got ${correct} of ${questions.length} correct (${Math.round(result.accuracy * 100)}%). ${result.is_weak ? `Keep practicing — we’ll revisit this topic in ${result.next_review_days} day(s).` : "Great work — the next suggested review is in " + result.next_review_days + " days."}`;
    renderAll();
    renderWeakTopicOptions();
    showToast("Quiz results added to your study insights.");
  } catch (error) {
    showToast(error.message);
  }
});
document.getElementById("assistant-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("assistant-question");
  const question = input.value.trim();
  if (!question) return;
  const messages = document.getElementById("chat-messages");
  messages.insertAdjacentHTML("beforeend", `<div class="chat-bubble user-bubble"><p>${escapeHtml(question)}</p></div>`);
  input.value = "";
  try {
    const result = await api("/api/assistant/reply", { question, weak_topics: state.weakTopics, days_remaining: daysToExam() });
    messages.insertAdjacentHTML("beforeend", `<div class="chat-bubble assistant-bubble"><div class="bubble-avatar">✧</div><p>${escapeHtml(result.reply)}</p></div>`);
    messages.scrollTop = messages.scrollHeight;
  } catch (error) {
    showToast(error.message);
  }
});
document.querySelectorAll(".suggestion-chip").forEach((button) => button.addEventListener("click", () => {
  document.getElementById("assistant-question").value = button.textContent;
  document.getElementById("assistant-form").requestSubmit();
}));
document.getElementById("download-report").addEventListener("click", () => {
  const content = [
    "SMARTPREP STUDY REPORT",
    `Generated: ${new Date().toLocaleString()}`,
    `Exam date: ${state.examDate} (${daysToExam()} days remaining)`,
    `Daily study availability: ${state.dailyHours} hours`,
    `Completed topics: ${state.completedTopics.length} of ${TOPICS.length}`,
    `Completed sessions: ${state.completed.length}`,
    `Quiz attempts: ${state.quizScores.length}`,
    `Average quiz accuracy: ${quizAverage() === null ? "Not yet available" : Math.round(quizAverage() * 100) + "%"}`,
    `Focus topics: ${state.weakTopics.join(", ") || "None selected"}`,
    "",
    "UPCOMING SESSIONS",
    ...state.plan.filter((session) => session.date >= dateString(today)).slice(0, 20).map((session) => `${session.date} | ${session.title} | ${session.duration}h | ${state.completed.includes(session.id) ? "Done" : "Planned"}`),
    "",
    "This report was generated by SmartPrep in your browser."
  ].join("\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "smartprep-study-report.txt";
  link.click();
  URL.revokeObjectURL(url);
  showToast("Your report has been downloaded.");
});

renderAll();
if (!state.plan.length) {
  generatePlan(false).catch((error) => showToast(error.message));
}
