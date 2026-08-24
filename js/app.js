const STORAGE_KEY = "thcs-question-bank-v4";
const SYNC_CONFIG_KEY = "thcs-question-bank-sync-v1";
const LEGACY_KEYS = ["thcs-question-bank-v3", "thcs-question-bank-v2-1", "thcs-question-bank-v2", "thcs-question-bank-v1"];
const SAMPLE_URL = "data/sample-questions.json";
const CATALOG_URL = "data/lesson-catalog.json";
const DEFAULT_BOOK = "Kết nối tri thức";

const state = {
  questions: [],
  catalog: { lessons: [] },
  editingId: null,
  bulkRows: [],
  validationRows: [],
  sync: {
    config: { url: "", token: "", autoSync: true },
    ready: false,
    timer: null,
    syncing: false,
    lastSyncedAt: null,
  },
};

const LEVEL_LABELS = { NB: "Nhận biết", TH: "Thông hiểu", VD: "Vận dụng" };
const STATUS_LABELS = { draft: "Nháp", approved: "Đã duyệt", inactive: "Ngừng sử dụng" };
const QUALITY_LABELS = { good: "Đạt", warning: "Cần xem lại", blocking: "Có lỗi" };

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();
  loadSyncConfig();
  await Promise.all([loadCatalog(), loadQuestions()]);
  normalizeAllQuestions(false);
  refreshFilterTopicOptions();
  render();
  state.sync.ready = true;
  updateSyncStatus();
  if (isCloudConfigured()) {
    await initialCloudSync();
  }
}

function cacheElements() {
  [
    "questionTableBody", "emptyState", "resultCount", "statTotal", "statNB", "statTH", "statVD",
    "statApproved", "statNeedsReview", "questionDialog", "questionForm", "dialogTitle", "formErrors",
    "fileImport", "fileBulkImport", "bulkImportDialog", "bulkPreviewBody", "bulkSummary",
    "btnConfirmBulkImport", "qualityPanel", "qualitySummary", "qualityScore", "qualityIssues",
    "validationDialog", "validationSummary", "validationTableBody",
    "syncStatus", "syncSettingsDialog", "syncSettingsForm", "syncTestResult", "syncChoiceDialog",
  ].forEach((id) => { els[id] = document.querySelector(`#${id}`); });
}

function bindEvents() {
  on("btnAdd", "click", openCreateDialog);
  on("btnCloseDialog", "click", closeQuestionDialog);
  on("btnCancel", "click", closeQuestionDialog);
  on("btnExport", "click", exportJson);
  on("btnExportExcel", "click", exportExcel);
  on("btnImport", "click", () => els.fileImport.click());
  on("btnBulkImport", "click", () => els.fileBulkImport.click());
  on("btnReset", "click", resetSampleData);
  on("btnClearFilters", "click", clearFilters);
  on("btnValidateAll", "click", validateAllQuestions);
  on("btnCloseBulkDialog", "click", () => els.bulkImportDialog.close());
  on("btnChooseBulkFile", "click", () => els.fileBulkImport.click());
  on("btnCloseValidationDialog", "click", closeValidationDialog);
  on("btnCloseValidationBottom", "click", closeValidationDialog);
  on("btnExportValidation", "click", exportValidationCsv);
  on("btnCloudSettings", "click", openSyncSettings);
  on("btnCloseSyncSettings", "click", () => els.syncSettingsDialog.close());
  on("btnSyncNow", "click", openSyncChoice);
  on("btnCloseSyncChoice", "click", () => els.syncChoiceDialog.close());
  on("btnTestCloud", "click", testCloudFromForm);
  on("btnPullCloud", "click", () => pullFromCloud(true));
  on("btnPushCloud", "click", () => pushToCloud(true));
  on("btnDisconnectCloud", "click", disconnectCloud);
  on("btnSyncPullChoice", "click", async () => { els.syncChoiceDialog.close(); await pullFromCloud(true); });
  on("btnSyncPushChoice", "click", async () => { els.syncChoiceDialog.close(); await pushToCloud(true); });

  els.btnConfirmBulkImport.addEventListener("click", confirmBulkImport);
  els.fileImport.addEventListener("change", importJson);
  els.fileBulkImport.addEventListener("change", readBulkFile);
  els.questionForm.addEventListener("submit", saveQuestion);
  els.syncSettingsForm.addEventListener("submit", saveSyncSettings);
  els.questionTableBody.addEventListener("click", handleTableAction);

  on("grade", "change", refreshTopicOptions);
  on("topic", "change", refreshLessonOptions);
  on("lesson", "change", syncLessonName);

  ["content", "optionA", "optionB", "optionC", "optionD", "explanation", "level", "status"]
    .forEach((id) => on(id, "input", updateLiveQuality));
  document.querySelectorAll('input[name="correctAnswer"]').forEach((radio) => {
    radio.addEventListener("change", updateLiveQuality);
  });

  ["filterKeyword", "filterLevel", "filterStatus", "filterQuality"]
    .forEach((id) => {
      on(id, "input", render);
      on(id, "change", render);
    });
  on("filterGrade", "change", refreshFilterTopicOptions);
  on("filterTopic", "change", refreshFilterLessonOptions);
  on("filterLesson", "change", render);
}

function on(id, eventName, handler) {
  const element = document.querySelector(`#${id}`);
  if (element) element.addEventListener(eventName, handler);
}

async function loadCatalog() {
  const response = await fetch(CATALOG_URL);
  if (!response.ok) throw new Error("Không thể tải danh mục bài học.");
  state.catalog = await response.json();
  state.catalog.lessons = (state.catalog.lessons || []).filter((item) => item.book === DEFAULT_BOOK);
}

async function loadQuestions() {
  const saved = localStorage.getItem(STORAGE_KEY) || LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (saved) {
    try {
      state.questions = JSON.parse(saved);
      return;
    } catch {
      // Nếu dữ liệu cũ hỏng, dùng dữ liệu mẫu.
    }
  }
  await loadSampleData();
}

async function loadSampleData() {
  const response = await fetch(SAMPLE_URL);
  if (!response.ok) throw new Error("Không thể tải dữ liệu mẫu.");
  state.questions = await response.json();
  normalizeAllQuestions(false);
  persist(false);
}

function normalizeAllQuestions(remote = false) {
  state.questions = state.questions.map((question) => normalizeStoredQuestion(question));
  persist(remote);
}

function normalizeStoredQuestion(question) {
  const now = new Date().toISOString();
  return {
    ...question,
    grade: String(question.grade ?? ""),
    book: DEFAULT_BOOK,
    topic: String(question.topic ?? ""),
    lesson: String(question.lesson ?? ""),
    lessonName: String(question.lessonName ?? ""),
    level: ["NB", "TH", "VD"].includes(question.level) ? question.level : "NB",
    options: Array.isArray(question.options) ? question.options.slice(0, 4).map(String) : ["", "", "", ""],
    correctAnswer: Number.isInteger(question.correctAnswer) ? question.correctAnswer : 0,
    explanation: String(question.explanation ?? ""),
    tags: Array.isArray(question.tags) ? question.tags : [],
    status: ["draft", "approved", "inactive"].includes(question.status) ? question.status : "draft",
    source: question.source || "manual",
    createdAt: question.createdAt || now,
    updatedAt: question.updatedAt || now,
  };
}

function persist(remote = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.questions));
  if (remote && state.sync.ready && state.sync.config.autoSync && isCloudConfigured()) {
    scheduleCloudSave();
  }
}

function render() {
  updateStats();
  const filtered = getFilteredQuestions();
  els.questionTableBody.innerHTML = "";
  els.resultCount.textContent = `${filtered.length} câu hỏi`;
  els.emptyState.hidden = filtered.length > 0;

  filtered.forEach((question) => {
    const quality = assessQuestion(question, question.id);
    const row = document.querySelector("#rowTemplate").content.firstElementChild.cloneNode(true);
    row.dataset.id = question.id;
    row.querySelector(".col-id").textContent = question.id;
    row.querySelector(".col-grade").textContent = `Lớp ${question.grade}`;
    row.querySelector(".col-lesson").innerHTML = `<strong>${escapeHtml(question.lesson)}</strong><br><small>${escapeHtml(question.lessonName)}</small>`;
    row.querySelector(".col-level").innerHTML = `<span class="badge ${question.level.toLowerCase()}">${LEVEL_LABELS[question.level]}</span>`;
    row.querySelector(".col-content").textContent = question.content;
    row.querySelector(".col-answer").textContent = `${answerLetter(question.correctAnswer)}. ${question.options[question.correctAnswer] || ""}`;
    row.querySelector(".col-quality").innerHTML = `<span class="badge ${quality.grade}" title="${escapeHtml(quality.issues.map((item) => item.message).join("; "))}">${quality.score} · ${QUALITY_LABELS[quality.grade]}</span>`;
    row.querySelector(".col-status").innerHTML = `<span class="badge ${question.status}">${STATUS_LABELS[question.status]}</span>`;
    els.questionTableBody.appendChild(row);
  });
}

function updateStats() {
  const qualities = state.questions.map((question) => assessQuestion(question, question.id));
  els.statTotal.textContent = state.questions.length;
  els.statNB.textContent = state.questions.filter((q) => q.level === "NB").length;
  els.statTH.textContent = state.questions.filter((q) => q.level === "TH").length;
  els.statVD.textContent = state.questions.filter((q) => q.level === "VD").length;
  els.statApproved.textContent = state.questions.filter((q) => q.status === "approved").length;
  els.statNeedsReview.textContent = qualities.filter((q) => q.grade !== "good").length;
}

function getFilteredQuestions() {
  const keyword = valueOf("filterKeyword").toLowerCase();
  const grade = valueOf("filterGrade");
  const topic = valueOf("filterTopic").toLowerCase();
  const lesson = valueOf("filterLesson").toLowerCase();
  const level = valueOf("filterLevel");
  const status = valueOf("filterStatus");
  const quality = valueOf("filterQuality");

  return state.questions
    .filter((q) => !grade || q.grade === grade)
    .filter((q) => !topic || q.topic.toLowerCase().includes(topic))
    .filter((q) => !lesson || `${q.lesson} ${q.lessonName}`.toLowerCase().includes(lesson))
    .filter((q) => !level || q.level === level)
    .filter((q) => !status || q.status === status)
    .filter((q) => !quality || assessQuestion(q, q.id).grade === quality)
    .filter((q) => {
      if (!keyword) return true;
      return [q.id, q.content, q.explanation, q.lesson, q.lessonName, q.topic, ...(q.tags || [])]
        .join(" ").toLowerCase().includes(keyword);
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function openCreateDialog() {
  state.editingId = null;
  els.questionForm.reset();
  setValue("book", DEFAULT_BOOK);
  setValue("bookDisplay", DEFAULT_BOOK);
  setValue("status", "draft");
  setValue("grade", "6");
  setValue("lessonName", "");
  els.dialogTitle.textContent = "Thêm câu hỏi";
  hideErrors();
  refreshTopicOptions("Chủ đề 1. Máy tính và cộng đồng");
  updateLiveQuality();
  els.questionDialog.showModal();
}

function openEditDialog(question) {
  state.editingId = question.id;
  els.dialogTitle.textContent = "Sửa câu hỏi";
  hideErrors();
  setValue("questionId", question.id);
  setValue("grade", question.grade);
  setValue("book", DEFAULT_BOOK);
  setValue("bookDisplay", DEFAULT_BOOK);
  refreshTopicOptions(question.topic);
  refreshLessonOptions(question.lesson);
  setValue("lessonName", question.lessonName);
  setValue("level", question.level);
  setValue("status", question.status);
  setValue("content", question.content);
  setValue("optionA", question.options[0]);
  setValue("optionB", question.options[1]);
  setValue("optionC", question.options[2]);
  setValue("optionD", question.options[3]);
  setValue("explanation", question.explanation);
  setValue("tags", (question.tags || []).join(", "));
  const radio = document.querySelector(`input[name="correctAnswer"][value="${question.correctAnswer}"]`);
  if (radio) radio.checked = true;
  updateLiveQuality();
  els.questionDialog.showModal();
}

function closeQuestionDialog() {
  els.questionDialog.close();
}

function refreshTopicOptions(selectedTopic = "") {
  const grade = valueOf("grade");
  const topics = [...new Set(state.catalog.lessons
    .filter((item) => item.grade === grade)
    .map((item) => item.topic))];
  const topicSelect = document.querySelector("#topic");
  topicSelect.innerHTML = `<option value="">Chọn chủ đề</option>` + topics
    .map((topic) => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join("");
  const nextTopic = selectedTopic && topics.includes(selectedTopic) ? selectedTopic : (topics[0] || "");
  setValue("topic", nextTopic);
  refreshLessonOptions();
}

function refreshLessonOptions(selectedLesson = "") {
  const grade = valueOf("grade");
  const topic = valueOf("topic");
  const lessons = state.catalog.lessons.filter((item) => item.grade === grade && item.topic === topic);
  const lessonSelect = document.querySelector("#lesson");
  lessonSelect.innerHTML = `<option value="">Chọn bài học</option>` + lessons
    .map((item) => `<option value="${escapeHtml(item.lesson)}">${escapeHtml(item.lesson)} – ${escapeHtml(item.lessonName)}</option>`).join("");
  const nextLesson = selectedLesson && lessons.some((item) => item.lesson === selectedLesson)
    ? selectedLesson : (lessons[0]?.lesson || "");
  setValue("lesson", nextLesson);
  syncLessonName();
}

function syncLessonName() {
  const item = state.catalog.lessons.find((lesson) => lesson.grade === valueOf("grade") && lesson.topic === valueOf("topic") && lesson.lesson === valueOf("lesson"));
  setValue("lessonName", item?.lessonName || "");
}

function refreshFilterTopicOptions() {
  const grade = valueOf("filterGrade");
  const topics = [...new Set(state.catalog.lessons
    .filter((item) => !grade || item.grade === grade)
    .map((item) => item.topic))];
  const select = document.querySelector("#filterTopic");
  const current = select.value;
  select.innerHTML = `<option value="">Tất cả</option>` + topics
    .map((topic) => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join("");
  select.value = topics.includes(current) ? current : "";
  refreshFilterLessonOptions();
}

function refreshFilterLessonOptions() {
  const grade = valueOf("filterGrade");
  const topic = valueOf("filterTopic");
  const lessons = state.catalog.lessons.filter((item) =>
    (!grade || item.grade === grade) && (!topic || item.topic === topic));
  const select = document.querySelector("#filterLesson");
  const current = select.value;
  select.innerHTML = `<option value="">Tất cả</option>` + lessons
    .map((item) => `<option value="${escapeHtml(item.lesson)}">${escapeHtml(item.lesson)} – ${escapeHtml(item.lessonName)}</option>`).join("");
  select.value = lessons.some((item) => item.lesson === current) ? current : "";
  render();
}

function collectFormQuestion() {
  const checked = document.querySelector('input[name="correctAnswer"]:checked');
  return {
    grade: valueOf("grade"),
    book: DEFAULT_BOOK,
    topic: valueOf("topic"),
    lesson: valueOf("lesson"),
    lessonName: valueOf("lessonName"),
    level: valueOf("level"),
    status: valueOf("status"),
    content: valueOf("content"),
    options: [valueOf("optionA"), valueOf("optionB"), valueOf("optionC"), valueOf("optionD")],
    correctAnswer: checked ? Number(checked.value) : -1,
    explanation: valueOf("explanation"),
    tags: valueOf("tags").split(",").map((tag) => tag.trim()).filter(Boolean),
  };
}

function saveQuestion(event) {
  event.preventDefault();
  const draft = collectFormQuestion();
  const structuralErrors = validateQuestionStructure(draft);
  const quality = assessQuestion(draft, state.editingId);

  if (structuralErrors.length) {
    showErrors(structuralErrors);
    return;
  }

  if (draft.status === "approved" && quality.grade === "blocking") {
    showErrors(["Không thể chuyển sang Đã duyệt khi câu hỏi còn lỗi nghiêm trọng.", ...quality.issues.filter((item) => item.severity === "blocking").map((item) => item.message)]);
    return;
  }

  const now = new Date().toISOString();
  if (state.editingId) {
    const index = state.questions.findIndex((q) => q.id === state.editingId);
    state.questions[index] = { ...state.questions[index], ...draft, updatedAt: now };
  } else {
    state.questions.push({
      id: generateQuestionId(draft),
      ...draft,
      source: "manual",
      createdAt: now,
      updatedAt: now,
    });
  }

  persist();
  closeQuestionDialog();
  render();
}

function validateQuestionStructure(question) {
  const errors = [];
  if (!question.grade || !question.topic || !question.lesson || !question.lessonName || !question.level || !question.content || !question.explanation) {
    errors.push("Vui lòng nhập đầy đủ các trường bắt buộc.");
  }
  if (question.options.some((option) => !option)) errors.push("Phải nhập đủ bốn phương án.");
  if (question.correctAnswer < 0 || question.correctAnswer > 3) errors.push("Hãy chọn một đáp án đúng.");
  if (new Set(question.options.map(normalizeText)).size !== question.options.length) errors.push("Các phương án không được trùng nhau.");
  if (question.content.length < 10) errors.push("Nội dung câu hỏi quá ngắn.");
  return errors;
}

function assessQuestion(question, excludedId = null) {
  const issues = [];
  const add = (severity, code, message, penalty) => issues.push({ severity, code, message, penalty });
  const content = String(question.content || "").trim();
  const options = Array.isArray(question.options) ? question.options.map((item) => String(item || "").trim()) : [];
  const answer = options[question.correctAnswer] || "";
  const explanation = String(question.explanation || "").trim();

  validateQuestionStructure(question).forEach((message) => add("blocking", "structure", message, 25));

  if (content.length > 240) add("warning", "long-question", "Nội dung câu hỏi khá dài; nên kiểm tra tính rõ ràng.", 7);
  if (!/[?？]$/.test(content) && !/[:.]$/.test(content)) add("warning", "punctuation", "Nội dung câu hỏi chưa có dấu kết thúc phù hợp.", 3);
  if (/\b(không|chưa|sai|không đúng)\b/i.test(content) && !/(KHÔNG|CHƯA|SAI)/.test(content)) {
    add("warning", "negative", "Câu hỏi có từ phủ định; nên viết nổi bật từ KHÔNG/CHƯA/SAI.", 6);
  }
  if (/tất cả (các )?(đáp án|phương án) (trên|đều đúng)/i.test(options.join(" "))) {
    add("warning", "all-above", "Nên tránh phương án “tất cả các đáp án trên/đều đúng”.", 8);
  }
  if (/cả a và b|a và b đều đúng/i.test(options.join(" "))) {
    add("warning", "combo-option", "Phương án kết hợp có thể làm giảm chất lượng câu hỏi.", 5);
  }

  const lengths = options.map((option) => option.length).filter((length) => length > 0);
  if (lengths.length === 4 && answer) {
    const others = lengths.filter((_, index) => index !== question.correctAnswer);
    const averageOther = others.reduce((sum, value) => sum + value, 0) / others.length;
    if (answer.length >= Math.max(averageOther * 1.65, averageOther + 18)) {
      add("warning", "answer-length", "Đáp án đúng dài nổi bật so với các phương án nhiễu.", 10);
    }
  }

  if (explanation && answer && !normalizeText(explanation).includes(normalizeText(answer).slice(0, Math.min(12, normalizeText(answer).length)))) {
    add("warning", "explanation-link", "Giải thích chưa nhắc rõ nội dung cốt lõi của đáp án đúng; cần kiểm tra lại.", 5);
  }
  if (explanation.length > 0 && explanation.length < 20) add("warning", "short-explanation", "Giải thích đáp án còn quá ngắn.", 6);

  const exactDuplicate = state.questions.find((item) => item.id !== excludedId && normalizeText(item.content) === normalizeText(content));
  if (exactDuplicate) add("blocking", "exact-duplicate", `Trùng hoàn toàn với câu ${exactDuplicate.id}.`, 35);
  else {
    const nearDuplicate = state.questions
      .filter((item) => item.id !== excludedId)
      .map((item) => ({ item, score: textSimilarity(item.content, content) }))
      .sort((a, b) => b.score - a.score)[0];
    if (nearDuplicate?.score >= 0.82) {
      add("warning", "near-duplicate", `Có nội dung gần giống câu ${nearDuplicate.item.id} (${Math.round(nearDuplicate.score * 100)}%).`, 12);
    }
  }

  for (let i = 0; i < options.length; i += 1) {
    for (let j = i + 1; j < options.length; j += 1) {
      if (options[i] && options[j] && textSimilarity(options[i], options[j]) >= 0.88) {
        add("warning", "similar-options", `Phương án ${answerLetter(i)} và ${answerLetter(j)} quá giống nhau.`, 7);
      }
    }
  }

  const uniqueIssues = [...new Map(issues.map((issue) => [`${issue.code}-${issue.message}`, issue])).values()];
  const score = Math.max(0, 100 - uniqueIssues.reduce((sum, issue) => sum + issue.penalty, 0));
  const grade = uniqueIssues.some((issue) => issue.severity === "blocking") ? "blocking" : uniqueIssues.length ? "warning" : "good";
  return { score, grade, issues: uniqueIssues };
}

function updateLiveQuality() {
  if (!els.qualityScore) return;
  const draft = collectFormQuestion();
  const quality = assessQuestion(draft, state.editingId);
  els.qualityScore.textContent = quality.score;
  els.qualityScore.className = `quality-score ${quality.grade}`;
  els.qualitySummary.textContent = quality.grade === "good"
    ? "Câu hỏi đạt các kiểm tra tự động cơ bản."
    : quality.grade === "blocking"
      ? "Còn lỗi nghiêm trọng; chưa thể duyệt."
      : "Có cảnh báo cần giáo viên xem lại.";
  els.qualityIssues.innerHTML = quality.issues.map((issue) => `<li class="${issue.severity}">${escapeHtml(issue.message)}</li>`).join("");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function textSimilarity(a, b) {
  const aTokens = new Set(normalizeText(a).split(" ").filter((token) => token.length > 1));
  const bTokens = new Set(normalizeText(b).split(" ").filter((token) => token.length > 1));
  if (!aTokens.size || !bTokens.size) return 0;
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return intersection / union;
}

function validateAllQuestions() {
  state.validationRows = state.questions.map((question) => ({ question, quality: assessQuestion(question, question.id) }));
  const good = state.validationRows.filter((row) => row.quality.grade === "good").length;
  const warnings = state.validationRows.filter((row) => row.quality.grade === "warning").length;
  const blocking = state.validationRows.filter((row) => row.quality.grade === "blocking").length;
  els.validationSummary.textContent = `${state.validationRows.length} câu: ${good} đạt, ${warnings} cần xem lại, ${blocking} có lỗi nghiêm trọng.`;
  els.validationTableBody.innerHTML = state.validationRows.map(({ question, quality }) => `
    <tr>
      <td>${escapeHtml(question.id)}</td>
      <td><span class="badge ${quality.grade}">${quality.score}</span></td>
      <td>${QUALITY_LABELS[quality.grade]}</td>
      <td>${escapeHtml(quality.issues.map((issue) => issue.message).join("; ") || "Không phát hiện vấn đề")}</td>
    </tr>`).join("");
  els.validationDialog.showModal();
}

function closeValidationDialog() {
  els.validationDialog.close();
}

function exportValidationCsv() {
  if (!state.validationRows.length) validateAllQuestions();
  const rows = [["id", "score", "quality", "issues"]];
  state.validationRows.forEach(({ question, quality }) => {
    rows.push([question.id, quality.score, QUALITY_LABELS[quality.grade], quality.issues.map((issue) => issue.message).join("; ")]);
  });
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
  downloadBlob(csv, `bao-cao-kiem-dinh-${today()}.csv`, "text/csv;charset=utf-8");
}

function handleTableAction(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const id = button.closest("tr")?.dataset.id;
  const question = state.questions.find((item) => item.id === id);
  if (!question) return;
  if (button.classList.contains("edit")) openEditDialog(question);
  if (button.classList.contains("duplicate")) duplicateQuestion(question);
  if (button.classList.contains("validate")) showSingleValidation(question);
  if (button.classList.contains("delete")) deactivateQuestion(question);
}

function showSingleValidation(question) {
  const quality = assessQuestion(question, question.id);
  const message = quality.issues.length
    ? quality.issues.map((issue, index) => `${index + 1}. ${issue.message}`).join("\n")
    : "Không phát hiện vấn đề trong các kiểm tra tự động.";
  alert(`${question.id}\nĐiểm chất lượng: ${quality.score}/100 — ${QUALITY_LABELS[quality.grade]}\n\n${message}`);
}

function duplicateQuestion(question) {
  const now = new Date().toISOString();
  const copy = { ...question, content: `${question.content} (bản sao)`, status: "draft", createdAt: now, updatedAt: now };
  copy.id = generateQuestionId(copy);
  state.questions.push(copy);
  persist();
  render();
}

function deactivateQuestion(question) {
  if (!confirm(`Chuyển câu hỏi ${question.id} sang trạng thái Ngừng sử dụng?\nDữ liệu sẽ được giữ lại để bảo toàn lịch sử.`)) return;
  question.status = "inactive";
  question.updatedAt = new Date().toISOString();
  persist();
  render();
}

async function readBulkFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (!window.XLSX) throw new Error("Không tải được thư viện đọc Excel. Hãy kiểm tra kết nối Internet.");
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    state.bulkRows = rows.map((row, index) => normalizeImportRow(row, index + 2));
    renderBulkPreview();
    els.bulkImportDialog.showModal();
  } catch (error) {
    alert(`Không đọc được tệp: ${error.message}`);
  }
}

function normalizeImportRow(row, rowNumber) {
  const answer = String(row.correctAnswer ?? row.correct ?? row.answer ?? "").trim().toUpperCase();
  const answerMap = { A: 0, B: 1, C: 2, D: 3, "0": 0, "1": 1, "2": 2, "3": 3 };
  const question = {
    grade: String(row.grade ?? row["Khối"] ?? "").trim(),
    book: DEFAULT_BOOK,
    topic: String(row.topic ?? row["Chủ đề"] ?? "").trim(),
    lesson: String(row.lesson ?? row["Bài"] ?? "").trim(),
    lessonName: String(row.lessonName ?? row["Tên bài"] ?? "").trim(),
    level: String(row.level ?? row["Mức độ"] ?? "").trim().toUpperCase(),
    status: String(row.status ?? "draft").trim() || "draft",
    content: String(row.content ?? row["Câu hỏi"] ?? "").trim(),
    options: [row.optionA ?? row.A ?? "", row.optionB ?? row.B ?? "", row.optionC ?? row.C ?? "", row.optionD ?? row.D ?? ""].map((item) => String(item).trim()),
    correctAnswer: answerMap[answer] ?? -1,
    explanation: String(row.explanation ?? row["Giải thích"] ?? "").trim(),
    tags: String(row.tags ?? "").split(",").map((item) => item.trim()).filter(Boolean),
  };
  const errors = validateQuestionStructure(question);
  const quality = assessQuestion(question, null);
  if (question.status === "approved" && quality.grade === "blocking") {
    question.status = "draft";
    errors.push("Câu có lỗi nghiêm trọng nên trạng thái được chuyển về Nháp.");
  }
  return { rowNumber, question, errors, quality };
}

function renderBulkPreview() {
  els.bulkPreviewBody.innerHTML = "";
  const validCount = state.bulkRows.filter((row) => row.errors.length === 0).length;
  els.bulkSummary.textContent = `Đọc được ${state.bulkRows.length} dòng: ${validCount} hợp lệ, ${state.bulkRows.length - validCount} có lỗi.`;
  els.btnConfirmBulkImport.disabled = validCount === 0;
  state.bulkRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.rowNumber}</td><td class="${row.errors.length ? "import-error" : "import-ok"}">${row.errors.length ? "Lỗi" : `Hợp lệ · ${row.quality.score}`}</td><td>${escapeHtml(row.question.content || "(trống)")}</td><td>${escapeHtml(row.errors.join("; "))}</td>`;
    els.bulkPreviewBody.appendChild(tr);
  });
}

function confirmBulkImport() {
  const validRows = state.bulkRows.filter((row) => row.errors.length === 0).map((row) => row.question);
  const now = new Date().toISOString();
  validRows.forEach((question) => {
    const quality = assessQuestion(question, null);
    state.questions.push({
      id: generateQuestionId(question),
      ...question,
      status: quality.grade === "blocking" ? "draft" : question.status,
      source: "import",
      createdAt: now,
      updatedAt: now,
    });
  });
  persist();
  render();
  els.bulkImportDialog.close();
  alert(`Đã nhập ${validRows.length} câu hỏi hợp lệ.`);
}

function exportExcel() {
  if (!window.XLSX) return alert("Không tải được thư viện Excel.");
  const rows = state.questions.map((question) => {
    const quality = assessQuestion(question, question.id);
    return {
      id: question.id, grade: question.grade, book: DEFAULT_BOOK, topic: question.topic,
      lesson: question.lesson, lessonName: question.lessonName, level: question.level,
      status: question.status, qualityScore: quality.score, qualityResult: QUALITY_LABELS[quality.grade],
      content: question.content, optionA: question.options[0], optionB: question.options[1],
      optionC: question.options[2], optionD: question.options[3], correctAnswer: answerLetter(question.correctAnswer),
      explanation: question.explanation, tags: (question.tags || []).join(", "),
    };
  });
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
  XLSX.writeFile(workbook, `ngan-hang-cau-hoi-${today()}.xlsx`);
}

function exportJson() {
  downloadBlob(JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), questions: state.questions }, null, 2), `ngan-hang-cau-hoi-${today()}.json`, "application/json;charset=utf-8");
}

async function importJson(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const questions = Array.isArray(parsed) ? parsed : parsed.questions;
    if (!Array.isArray(questions) || !questions.every(isQuestionShape)) throw new Error("Sai cấu trúc dữ liệu.");
    const normalized = questions.map(normalizeStoredQuestion);
    if (confirm("Nhấn OK để thay toàn bộ dữ liệu. Nhấn Cancel để nhập bổ sung và bỏ qua mã trùng.")) {
      state.questions = normalized;
    } else {
      const ids = new Set(state.questions.map((question) => question.id));
      state.questions.push(...normalized.filter((question) => !ids.has(question.id)));
    }
    persist();
    render();
  } catch (error) {
    alert(`Không thể nhập: ${error.message}`);
  }
}

function isQuestionShape(question) {
  return question && typeof question.id === "string" && typeof question.content === "string" && Array.isArray(question.options) && question.options.length === 4 && Number.isInteger(question.correctAnswer);
}

async function resetSampleData() {
  if (!confirm("Khôi phục dữ liệu mẫu sẽ thay toàn bộ dữ liệu hiện tại. Bạn nên Xuất JSON trước khi tiếp tục.")) return;
  await loadSampleData();
  persist(true);
  clearFilters();
  render();
}

function clearFilters() {
  ["filterKeyword", "filterGrade", "filterLevel", "filterStatus", "filterQuality"]
    .forEach((id) => setValue(id, ""));
  refreshFilterTopicOptions();
}

function generateQuestionId(question) {
  const topicCode = slugCode(question.topic, 3);
  const lessonCode = slugCode(question.lesson, 4);
  const prefix = `T${question.grade}-KNTT-${topicCode}-${lessonCode}-${question.level}`;
  const numbers = state.questions
    .filter((item) => item.id?.startsWith(prefix))
    .map((item) => Number(item.id.split("-").at(-1)))
    .filter(Number.isFinite);
  return `${prefix}-${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(4, "0")}`;
}

function slugCode(text, maxLength) {
  return normalizeText(text).replace(/\s/g, "").toUpperCase().slice(-maxLength).padStart(maxLength, "0");
}


function loadSyncConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(SYNC_CONFIG_KEY) || "{}");
    state.sync.config = {
      url: String(saved.url || "").trim(),
      token: String(saved.token || "").trim(),
      autoSync: saved.autoSync !== false,
    };
  } catch {
    state.sync.config = { url: "", token: "", autoSync: true };
  }
}

function saveSyncConfig() {
  const url = valueOf("gasWebAppUrl").replace(/\/+$/, "");
  const token = valueOf("gasAccessToken");
  const autoSync = document.querySelector("#autoSyncEnabled")?.checked !== false;
  if ((url && !token) || (!url && token)) {
    showSyncTest("Cần nhập cả URL Web App và mã truy cập.", false);
    return;
  }
  if (url && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/i.test(url)) {
    showSyncTest("URL chưa đúng dạng Web App và phải kết thúc bằng /exec.", false);
    return;
  }
  state.sync.config = { url, token, autoSync };
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(state.sync.config));
  updateSyncStatus();
  els.syncSettingsDialog.close();
}

function openSyncSettings() {
  setValue("gasWebAppUrl", state.sync.config.url);
  setValue("gasAccessToken", state.sync.config.token);
  const checkbox = document.querySelector("#autoSyncEnabled");
  if (checkbox) checkbox.checked = state.sync.config.autoSync !== false;
  els.syncTestResult.hidden = true;
  els.syncSettingsDialog.showModal();
}

function openSyncChoice() {
  if (!isCloudConfigured()) {
    openSyncSettings();
    showSyncTest("Hãy cấu hình Google Apps Script trước khi đồng bộ.", false);
    return;
  }
  els.syncChoiceDialog.showModal();
}

function isCloudConfigured(config = state.sync.config) {
  return Boolean(config.url && config.token);
}

function disconnectCloud() {
  if (!confirm("Ngắt kết nối Google Sheets? Dữ liệu trên thiết bị và trên Sheets vẫn được giữ nguyên.")) return;
  state.sync.config = { url: "", token: "", autoSync: true };
  localStorage.removeItem(SYNC_CONFIG_KEY);
  els.syncSettingsDialog.close();
  updateSyncStatus();
}

function showSyncTest(message, ok) {
  els.syncTestResult.textContent = message;
  els.syncTestResult.className = `sync-test-result ${ok ? "ok" : "error"}`;
  els.syncTestResult.hidden = false;
}

async function testCloudFromForm() {
  const temp = {
    url: valueOf("gasWebAppUrl").replace(/\/+$/, ""),
    token: valueOf("gasAccessToken"),
  };
  if (!isCloudConfigured(temp)) return showSyncTest("Hãy nhập URL và mã truy cập.", false);
  try {
    const result = await cloudRequest("health", {}, temp);
    showSyncTest(`Kết nối thành công. Google Sheets hiện có ${result.count ?? 0} câu hỏi.`, true);
  } catch (error) {
    showSyncTest(`Kết nối thất bại: ${error.message}`, false);
  }
}

async function initialCloudSync() {
  try {
    setSyncState("syncing", "Đang kiểm tra Sheets...");
    const result = await cloudRequest("load");
    const remote = Array.isArray(result.questions) ? result.questions.map(normalizeStoredQuestion) : [];
    if (remote.length > 0) {
      state.questions = remote;
      persist(false);
      render();
    } else if (state.questions.length > 0) {
      await pushToCloud(false);
      return;
    }
    state.sync.lastSyncedAt = new Date();
    setSyncState("synced", `Đã đồng bộ · ${remote.length} câu`);
  } catch (error) {
    setSyncState("error", "Lỗi kết nối Sheets", error.message);
  }
}

function scheduleCloudSave() {
  clearTimeout(state.sync.timer);
  setSyncState("syncing", "Chờ đồng bộ...");
  state.sync.timer = setTimeout(() => pushToCloud(false), 1200);
}

async function pullFromCloud(confirmReplace = false) {
  if (!isCloudConfigured()) return openSyncSettings();
  if (confirmReplace && !confirm("Tải dữ liệu từ Google Sheets sẽ thay ngân hàng đang có trên thiết bị. Tiếp tục?")) return;
  try {
    setSyncState("syncing", "Đang tải từ Sheets...");
    const result = await cloudRequest("load");
    state.questions = (result.questions || []).map(normalizeStoredQuestion);
    persist(false);
    render();
    state.sync.lastSyncedAt = new Date();
    setSyncState("synced", `Đã tải · ${state.questions.length} câu`);
    if (confirmReplace) alert(`Đã tải ${state.questions.length} câu hỏi từ Google Sheets.`);
  } catch (error) {
    setSyncState("error", "Tải dữ liệu thất bại", error.message);
    if (confirmReplace) alert(`Không thể tải dữ liệu: ${error.message}`);
  }
}

async function pushToCloud(confirmReplace = false) {
  if (!isCloudConfigured()) return;
  if (state.sync.syncing) return;
  if (confirmReplace && !confirm("Ghi lên Google Sheets sẽ thay toàn bộ dữ liệu câu hỏi đang có trên Sheets. Tiếp tục?")) return;
  try {
    state.sync.syncing = true;
    setSyncState("syncing", "Đang ghi lên Sheets...");
    const result = await cloudRequest("saveAll", { questions: state.questions });
    state.sync.lastSyncedAt = new Date();
    setSyncState("synced", `Đã lưu · ${result.count ?? state.questions.length} câu`);
    if (confirmReplace) alert(`Đã ghi ${result.count ?? state.questions.length} câu hỏi lên Google Sheets.`);
  } catch (error) {
    setSyncState("error", "Ghi dữ liệu thất bại", error.message);
    if (confirmReplace) alert(`Không thể ghi dữ liệu: ${error.message}`);
  } finally {
    state.sync.syncing = false;
  }
}

async function cloudRequest(action, payload = {}, config = state.sync.config) {
  if (!isCloudConfigured(config)) throw new Error("Chưa cấu hình Google Sheets.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, token: config.token, ...payload }),
      redirect: "follow",
      signal: controller.signal,
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error("Máy chủ không trả về JSON hợp lệ. Kiểm tra URL triển khai /exec."); }
    if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Hết thời gian chờ phản hồi từ Google Apps Script.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function updateSyncStatus() {
  if (!isCloudConfigured()) return setSyncState("local", "Chỉ lưu trên máy");
  if (state.sync.lastSyncedAt) return setSyncState("synced", "Đã kết nối Sheets");
  setSyncState("local", "Đã cấu hình Sheets");
}

function setSyncState(kind, text, title = "") {
  if (!els.syncStatus) return;
  els.syncStatus.className = `sync-status ${kind}`;
  els.syncStatus.textContent = text;
  els.syncStatus.title = title || text;
}

function valueOf(id) {
  return document.querySelector(`#${id}`)?.value.trim() || "";
}

function setValue(id, value) {
  const element = document.querySelector(`#${id}`);
  if (element) element.value = value ?? "";
}

function showErrors(errors) {
  els.formErrors.innerHTML = `<ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
  els.formErrors.hidden = false;
}

function hideErrors() {
  els.formErrors.hidden = true;
  els.formErrors.innerHTML = "";
}

function answerLetter(index) {
  return index >= 0 && index <= 3 ? String.fromCharCode(65 + index) : "?";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
