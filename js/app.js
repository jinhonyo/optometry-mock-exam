/**
 * 模組名稱：app.js
 * 模組職責：應用程式主控制入口，負責初始化資料載入、協調各視圖切換、管理進行中測驗生命週期與全域通知。
 */

import { EXAM_CONFIG, EXAM_MODES } from "./config.js";
import { loadAllQuestionBanks, loadMetadata, loadQuestionBank } from "./dataLoader.js";
import {
  buildPastPaper,
  buildRandomPaper,
  buildWrongReviewPaper,
  ExamSession,
} from "./examEngine.js";
import { scoreExam } from "./scorer.js";
import { addWrongQuestions, getWrongBook, saveExamRecord } from "./storageService.js";
import { ExamTimer } from "./timer.js";
import { cleanupExamShortcuts, renderExamView, updateTimerDisplay } from "./views/examView.js";
import { renderHistoryView } from "./views/historyView.js";
import { renderResultView } from "./views/resultView.js";
import { renderSearchView } from "./views/searchView.js";
import { renderSetupView } from "./views/setupView.js";

/**
 * 應用程式全域執行狀態物件。
 * @type {{ metadata: Object|null, activeView: string, session: ExamSession|null, timer: ExamTimer|null }}
 */
const appState = {
  // 系統場次與類別詮釋資料
  metadata: null,
  // 目前顯示中之視圖代碼
  activeView: "setup",
  // 目前進行中之測驗實例
  session: null,
  // 目前進行中之計時器實例
  timer: null,
};

/**
 * 顯示或隱藏全域載入中遮罩。
 *
 * @param {boolean} isVisible - 是否顯示遮罩。
 * @param {string} message - 顯示之提示訊息。
 * @returns {void}
 */
function setLoading(isVisible, message = "載入題庫資料中，請稍候…") {
  const overlay = document.getElementById("loadingOverlay");
  const msgEl = document.getElementById("loadingMessage");
  msgEl.textContent = message;
  overlay.classList.toggle("hidden", !isVisible);
}

/**
 * 於右下角顯示短暫通知訊息條（Toast）。
 *
 * @param {string} message - 通知文字內容。
 * @returns {void}
 */
function showToast(message) {
  const container = document.getElementById("toastContainer");
  const toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.textContent = message;
  container.appendChild(toastEl);
  window.setTimeout(() => {
    toastEl.remove();
  }, 3000);
}

/**
 * 切換主要顯示視圖並同步更新頂部導覽列作用中狀態。
 *
 * @param {string} viewName - 目標視圖名稱（setup / exam / result / search / history）。
 * @returns {void}
 */
function switchView(viewName) {
  // 離開作答頁時清除快捷鍵監聽
  if (appState.activeView === "exam" && viewName !== "exam") {
    cleanupExamShortcuts();
  }
  appState.activeView = viewName;

  document.querySelectorAll(".view-section").forEach((section) => {
    section.classList.toggle("active", section.id === `view-${viewName}`);
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * 停止並釋放目前進行中的計時器。
 *
 * @returns {void}
 */
function stopActiveTimer() {
  if (appState.timer) {
    appState.timer.stop();
    appState.timer = null;
  }
}

/**
 * 開啟並重新渲染首頁測驗設定視圖。
 *
 * @returns {void}
 */
function openSetupView() {
  stopActiveTimer();
  appState.session = null;
  switchView("setup");
  const container = document.getElementById("view-setup");
  renderSetupView(container, appState.metadata, {
    onStartPastPaper: handleStartPastPaper,
    onStartRandomPaper: handleStartRandomPaper,
    onStartWrongReview: handleStartWrongReview,
  });
}

/**
 * 啟動一場新測驗（建立 ExamSession、啟動計時器並切換至作答視圖）。
 *
 * @param {Object} sessionConfig - ExamSession 建構設定物件。
 * @returns {void}
 */
function launchExam(sessionConfig) {
  if (!sessionConfig.questions || sessionConfig.questions.length === 0) {
    showToast("查無符合條件的題目，無法建立考卷。");
    return;
  }

  stopActiveTimer();
  appState.session = new ExamSession(sessionConfig);

  const isCountdown = sessionConfig.examMode === EXAM_MODES.MOCK;
  appState.timer = new ExamTimer({
    isCountdown,
    durationSeconds: sessionConfig.durationSeconds || EXAM_CONFIG.defaultDurationSeconds,
    onTick: ({ remainingSeconds, elapsedSeconds }) => {
      updateTimerDisplay(appState.session.examMode, remainingSeconds, elapsedSeconds);
    },
    onTimeout: () => {
      showToast("考試時間已到，系統自動交卷。");
      finalizeAndScoreExam();
    },
  });

  switchView("exam");
  appState.timer.start();
  rerenderExamView();
}

/**
 * 重新繪製目前作答視圖。
 *
 * @returns {void}
 */
function rerenderExamView() {
  if (!appState.session || !appState.timer) {
    return;
  }
  const container = document.getElementById("view-exam");
  renderExamView(
    container,
    appState.session,
    {
      remainingSeconds: appState.timer.remainingSeconds,
      elapsedSeconds: appState.timer.elapsedSeconds,
      isPaused: appState.timer.isPaused,
    },
    {
      onSelectOption: (questionId, optionKey) => {
        appState.session.setAnswer(questionId, optionKey);
        rerenderExamView();
      },
      onGoTo: (index) => {
        appState.session.goTo(index);
        rerenderExamView();
      },
      onToggleFlag: (questionId) => {
        appState.session.toggleFlag(questionId);
        rerenderExamView();
      },
      onTogglePause: () => {
        appState.timer.togglePause();
        rerenderExamView();
      },
      onRequestSubmit: () => {
        const unanswered = appState.session.questions.length - appState.session.getAnsweredCount();
        const confirmMsg =
          unanswered > 0
            ? `尚有 ${unanswered} 題未作答，確定要交卷嗎？`
            : "確定要交卷並查看成績嗎？";
        if (window.confirm(confirmMsg)) {
          finalizeAndScoreExam();
        }
      },
      onQuitExam: () => {
        if (window.confirm("確定要離開目前測驗？作答進度將不會保存。")) {
          openSetupView();
        }
      },
    }
  );
}

/**
 * 結束目前測驗、執行評分引擎、更新錯題本與歷史成績，並切換至成績檢討頁面。
 *
 * @returns {void}
 */
function finalizeAndScoreExam() {
  if (!appState.session || appState.session.isSubmitted) {
    return;
  }
  appState.session.isSubmitted = true;
  const elapsedSeconds = appState.timer ? appState.timer.elapsedSeconds : 0;
  stopActiveTimer();

  // 計算成績與分科統計
  const report = scoreExam(
    appState.session.questions,
    appState.session.userAnswers,
    appState.session.flaggedIds
  );

  // 自動收錄答錯題目至錯題本
  if (report.wrongQuestions.length > 0) {
    addWrongQuestions(report.wrongQuestions);
  }

  // 寫入本機歷史測驗紀錄
  saveExamRecord({
    id: `rec_${Date.now()}`,
    title: appState.session.title,
    examMode: appState.session.examMode,
    sourceType: appState.session.sourceType,
    totalCount: report.totalCount,
    correctCount: report.correctCount,
    score: report.score,
    elapsedSeconds,
    finishedAt: new Date().toISOString(),
  });

  switchView("result");
  const container = document.getElementById("view-result");
  renderResultView(
    container,
    report,
    {
      title: appState.session.title,
      elapsedSeconds,
    },
    {
      onBackHome: openSetupView,
      onNotify: showToast,
      onRetryWrong: (wrongList) => {
        launchExam({
          title: `錯題重考（${wrongList.length} 題）`,
          examMode: EXAM_MODES.PRACTICE,
          sourceType: "wrong",
          questions: wrongList,
          durationSeconds: EXAM_CONFIG.defaultDurationSeconds,
        });
      },
    }
  );
}

/**
 * 處理「歷屆原卷模擬」啟動流程。
 *
 * @param {Object} params - 歷屆原卷參數物件。
 * @returns {Promise<void>}
 */
async function handleStartPastPaper({ categoryKey, sessionInfo, examMode }) {
  try {
    setLoading(true, `載入${sessionInfo.categoryLabel}題庫中…`);
    const bank = await loadQuestionBank(categoryKey);
    const questions = buildPastPaper(bank, sessionInfo.sessionCode, sessionInfo.subject);
    launchExam({
      title: `民國 ${sessionInfo.year} 年 ${sessionInfo.categoryLabel}｜${sessionInfo.subject}`,
      examMode,
      sourceType: "past",
      questions,
      durationSeconds: EXAM_CONFIG.defaultDurationSeconds,
    });
  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(false);
  }
}

/**
 * 處理「自訂隨機刷題」啟動流程。
 *
 * @param {Object} params - 隨機組卷篩選參數。
 * @returns {Promise<void>}
 */
async function handleStartRandomPaper({ categoryKey, yearFrom, yearTo, subjects, excludeImage, count, examMode }) {
  if (subjects.length === 0) {
    showToast("請至少勾選一個科目。");
    return;
  }
  try {
    const label = appState.metadata.categories[categoryKey].label;
    setLoading(true, `載入${label}題庫中…`);
    const bank = await loadQuestionBank(categoryKey);
    const questions = buildRandomPaper(bank, { yearFrom, yearTo, subjects, excludeImage, count });
    launchExam({
      title: `${label}自訂隨機刷題（${questions.length} 題）`,
      examMode,
      sourceType: "random",
      questions,
      durationSeconds: EXAM_CONFIG.defaultDurationSeconds,
    });
  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(false);
  }
}

/**
 * 處理「錯題本複習」啟動流程。
 *
 * @param {Object} params - 錯題複習參數。
 * @returns {Promise<void>}
 */
async function handleStartWrongReview({ maxCount, examMode }) {
  try {
    setLoading(true, "載入題庫以組合錯題卷…");
    const allQuestions = await loadAllQuestionBanks();
    const wrongBook = getWrongBook();
    const questions = buildWrongReviewPaper(allQuestions, wrongBook, maxCount);
    launchExam({
      title: `錯題本集中複習（${questions.length} 題）`,
      examMode,
      sourceType: "wrong",
      questions,
      durationSeconds: EXAM_CONFIG.defaultDurationSeconds,
    });
  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(false);
  }
}

/**
 * 開啟「題庫關鍵字搜尋」頁面（首次開啟時載入全體題庫）。
 *
 * @returns {Promise<void>}
 */
async function openSearchView() {
  try {
    setLoading(true, "載入完整歷屆題庫（7,000 題）供全文搜尋…");
    const allQuestions = await loadAllQuestionBanks();
    switchView("search");
    const container = document.getElementById("view-search");
    renderSearchView(container, appState.metadata, allQuestions, {
      onPracticeResults: (selectedQuestions, keywordLabel) => {
        launchExam({
          title: `搜尋練習：${keywordLabel}（${selectedQuestions.length} 題）`,
          examMode: EXAM_MODES.PRACTICE,
          sourceType: "search",
          questions: selectedQuestions,
          durationSeconds: EXAM_CONFIG.defaultDurationSeconds,
        });
      },
    });
  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(false);
  }
}

/**
 * 開啟「錯題與紀錄」管理頁面。
 *
 * @returns {Promise<void>}
 */
async function openHistoryView() {
  try {
    setLoading(true, "載入題庫與本機紀錄中…");
    const allQuestions = await loadAllQuestionBanks();
    switchView("history");
    const container = document.getElementById("view-history");
    renderHistoryView(container, allQuestions, {
      onStartWrongReview: handleStartWrongReview,
      onNotify: showToast,
    });
  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(false);
  }
}

/**
 * 應用程式啟動進入點：載入 metadata.json 並綁定主導覽列切換事件。
 *
 * @returns {Promise<void>}
 */
async function bootstrap() {
  try {
    setLoading(true, "初始化驗光國考題庫系統…");
    appState.metadata = await loadMetadata();

    // 綁定頂部導覽按鈕
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.view;
        if (appState.activeView === "exam" && appState.session && !appState.session.isSubmitted) {
          if (!window.confirm("目前正在測驗中，切換頁面將放棄作答進度，確定要離開嗎？")) {
            return;
          }
          stopActiveTimer();
        }
        if (target === "setup") {
          openSetupView();
        } else if (target === "search") {
          openSearchView();
        } else if (target === "history") {
          openHistoryView();
        }
      });
    });

    // 點擊品牌標誌返回首頁
    document.getElementById("brandHomeBtn").addEventListener("click", () => {
      if (appState.activeView === "exam" && appState.session && !appState.session.isSubmitted) {
        if (!window.confirm("目前正在測驗中，確定要返回首頁嗎？")) {
          return;
        }
        stopActiveTimer();
      }
      openSetupView();
    });

    openSetupView();
  } catch (error) {
    console.error(error);
    showToast(`系統初始化失敗：${error.message}`);
  } finally {
    setLoading(false);
  }
}

// 頁面 DOM 載入完成後啟動系統
window.addEventListener("DOMContentLoaded", bootstrap);
