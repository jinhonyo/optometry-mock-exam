/**
 * 模組名稱：examView.js
 * 模組職責：渲染作答主介面、互動選項、含圖題 PDF 原卷按鈕、刷題模式即時解析與右側題號導覽格，
 *          並支援鍵盤快捷鍵（1–4 選答、左右鍵換題、F 標記）。
 */

import { EXAM_CONFIG, EXAM_MODES, OPTION_KEYS } from "../config.js";
import { evaluateSingleQuestion, formatCorrectAnswer } from "../scorer.js";
import { escapeHtml } from "../searchEngine.js";
import { formatSeconds } from "../timer.js";

/**
 * 存放目前綁定的鍵盤事件處理函式參考，以便離開作答頁時正確移除監聽器。
 * @type {Function|null}
 */
let activeKeydownHandler = null;

/**
 * 移除作答頁全域鍵盤快捷鍵監聽器，避免影響其他頁面輸入。
 *
 * @returns {void}
 */
export function cleanupExamShortcuts() {
  if (activeKeydownHandler) {
    window.removeEventListener("keydown", activeKeydownHandler);
    activeKeydownHandler = null;
  }
}

/**
 * 渲染完整作答頁面並綁定操作事件。
 *
 * @param {HTMLElement} container - 視圖容器元素。
 * @param {Object} session - ExamSession 測驗狀態實例。
 * @param {Object} timerState - 目前計時狀態 { remainingSeconds, elapsedSeconds, isPaused }。
 * @param {Object} callbacks - 與主控模組溝通之回呼函式物件。
 * @returns {void}
 */
export function renderExamView(container, session, timerState, callbacks) {
  // 取得目前題目與作答狀態
  const question = session.getCurrentQuestion();
  if (!question) {
    return;
  }

  const total = session.questions.length;
  const currentNum = session.currentIndex + 1;
  const userChoice = session.userAnswers[question.id] || null;
  const isFlagged = session.flaggedIds.has(question.id);
  const isPractice = session.examMode === EXAM_MODES.PRACTICE;
  const showImmediateFeedback = isPractice && Boolean(userChoice);
  const evalResult = showImmediateFeedback ? evaluateSingleQuestion(question, userChoice) : null;

  // 計算時間顯示文字與緊急警示樣式
  const timeText = isPractice
    ? `已用時間 ${formatSeconds(timerState.elapsedSeconds)}`
    : `剩餘時間 ${formatSeconds(timerState.remainingSeconds)}`;
  const isUrgent = !isPractice && timerState.remainingSeconds <= EXAM_CONFIG.urgentThresholdSeconds;

  // 產生 A–D 選項按鈕 HTML
  const optionsHtml = OPTION_KEYS.map((key, idx) => {
    const rawOpt = question.options[key];
    const displayText = rawOpt ? escapeHtml(rawOpt) : "（此選項為圖片或原卷空白，請點擊上方原卷 PDF 對照）";
    const classes = ["option-btn"];

    if (showImmediateFeedback) {
      const isRightOption = question.answers.includes("ALL") || question.answers.includes(key);
      if (isRightOption) {
        classes.push("correct");
      } else if (userChoice === key) {
        classes.push("wrong");
      }
    } else if (userChoice === key) {
      classes.push("selected");
    }

    return `
      <button class="${classes.join(" ")}" data-option="${key}">
        <span class="option-key">${key}</span>
        <span>${displayText}</span>
        <span style="margin-left: auto; font-size: 0.75rem; color: var(--color-text-muted);">[${idx + 1}]</span>
      </button>
    `;
  }).join("");

  // 產生右側題號導覽格 HTML
  const navCellsHtml = session.questions
    .map((q, idx) => {
      const cellClasses = ["nav-cell"];
      const ans = session.userAnswers[q.id];
      if (idx === session.currentIndex) {
        cellClasses.push("current");
      }
      if (session.flaggedIds.has(q.id)) {
        cellClasses.push("flagged");
      }
      if (ans) {
        if (isPractice) {
          const check = evaluateSingleQuestion(q, ans);
          cellClasses.push(check.isCorrect ? "correct" : "wrong");
        } else {
          cellClasses.push("answered");
        }
      }
      return `<button class="${cellClasses.join(" ")}" data-goto="${idx}" title="第 ${idx + 1} 題">${idx + 1}</button>`;
    })
    .join("");

  // 刷題練習模式即時回饋區塊
  let feedbackHtml = "";
  if (showImmediateFeedback && evalResult) {
    const correctDisplay = formatCorrectAnswer(question);
    feedbackHtml = `
      <div class="feedback-box ${evalResult.isCorrect ? "correct" : "wrong"}">
        <div>
          <strong>${evalResult.isCorrect ? "答對了！" : "答錯了"}</strong>
          ${evalResult.isGiveAll ? "（本題考選部公告一律給分）" : `｜標準答案：<strong>${escapeHtml(correctDisplay)}</strong>`}
        </div>
        ${question.note ? `<div style="margin-top: 0.35rem;">考選部備註：${escapeHtml(question.note)}</div>` : ""}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="exam-toolbar">
      <div>
        <strong>${escapeHtml(session.title)}</strong>
        <span class="badge badge-primary" style="margin-left: 0.4rem;">
          ${isPractice ? "刷題練習模式" : "模擬考模式"}
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
        <span id="examTimerDisplay" class="timer-display ${isUrgent ? "urgent" : ""}">${timeText}</span>
        <button id="pauseTimerBtn" class="btn btn-sm">${timerState.isPaused ? "繼續計時" : "暫停"}</button>
        <button id="submitExamBtn" class="btn btn-primary btn-sm">交卷並查看成績</button>
        <button id="quitExamBtn" class="btn btn-sm">離開測驗</button>
      </div>
    </div>

    <div class="exam-layout">
      <div class="card">
        <div class="question-meta">
          <span class="badge badge-primary">第 ${currentNum} / ${total} 題</span>
          <span>${escapeHtml(question.categoryLabel)}・民國 ${question.year} 年・${escapeHtml(question.subject)}・原卷第 ${question.number} 題</span>
          ${question.hasImage ? `<span class="badge badge-warning">含圖題</span>` : ""}
          ${question.pdfUrl ? `<a href="${escapeHtml(question.pdfUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="margin-left: auto;">查看原卷 PDF</a>` : ""}
        </div>

        <p class="question-stem">${escapeHtml(question.question)}</p>

        <div class="option-list">${optionsHtml}</div>

        ${feedbackHtml}

        <div class="exam-actions">
          <div style="display: flex; gap: 0.5rem;">
            <button id="prevQuestionBtn" class="btn" ${session.currentIndex === 0 ? "disabled" : ""}>← 上一題</button>
            <button id="nextQuestionBtn" class="btn" ${session.currentIndex === total - 1 ? "disabled" : ""}>下一題 →</button>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button id="flagQuestionBtn" class="btn ${isFlagged ? "btn-warning" : ""}">
              ${isFlagged ? "★ 已標記待確認" : "☆ 標記此題 [F]"}
            </button>
          </div>
        </div>
      </div>

      <aside class="card">
        <h3 class="card-title">
          <span>題號導覽</span>
          <span style="font-size: 0.82rem; color: var(--color-text-muted);">${session.getAnsweredCount()} / ${total} 已作答</span>
        </h3>
        <div class="nav-grid">${navCellsHtml}</div>
        <div style="margin-top: 0.9rem; font-size: 0.78rem; color: var(--color-text-muted);">
          快捷鍵：數字 1–4 選答｜← / → 換題｜F 標記
        </div>
      </aside>
    </div>
  `;

  // 綁定選項點擊事件
  container.querySelectorAll(".option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      callbacks.onSelectOption(question.id, btn.dataset.option);
    });
  });

  // 綁定題號導覽點擊事件
  container.querySelectorAll(".nav-cell").forEach((btn) => {
    btn.addEventListener("click", () => {
      callbacks.onGoTo(Number(btn.dataset.goto));
    });
  });

  // 綁定上下題、標記、暫停、交卷與離開按鈕
  container.querySelector("#prevQuestionBtn").addEventListener("click", () => {
    callbacks.onGoTo(session.currentIndex - 1);
  });
  container.querySelector("#nextQuestionBtn").addEventListener("click", () => {
    callbacks.onGoTo(session.currentIndex + 1);
  });
  container.querySelector("#flagQuestionBtn").addEventListener("click", () => {
    callbacks.onToggleFlag(question.id);
  });
  container.querySelector("#pauseTimerBtn").addEventListener("click", () => {
    callbacks.onTogglePause();
  });
  container.querySelector("#submitExamBtn").addEventListener("click", () => {
    callbacks.onRequestSubmit();
  });
  container.querySelector("#quitExamBtn").addEventListener("click", () => {
    callbacks.onQuitExam();
  });

  // 綁定鍵盤快捷鍵監聽
  cleanupExamShortcuts();
  activeKeydownHandler = (event) => {
    // 若焦點在輸入框則不攔截
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
      return;
    }
    if (["1", "2", "3", "4"].includes(event.key)) {
      const optKey = OPTION_KEYS[Number(event.key) - 1];
      callbacks.onSelectOption(question.id, optKey);
    } else if (event.key === "ArrowLeft") {
      callbacks.onGoTo(session.currentIndex - 1);
    } else if (event.key === "ArrowRight") {
      callbacks.onGoTo(session.currentIndex + 1);
    } else if (event.key.toLowerCase() === "f") {
      callbacks.onToggleFlag(question.id);
    }
  };
  window.addEventListener("keydown", activeKeydownHandler);
}

/**
 * 僅局部更新作答頁頂部計時器顯示文字，避免每秒重繪整個畫面影響點擊操作。
 *
 * @param {string} examMode - 當前作答模式。
 * @param {number} remainingSeconds - 剩餘秒數。
 * @param {number} elapsedSeconds - 已用秒數。
 * @returns {void}
 */
export function updateTimerDisplay(examMode, remainingSeconds, elapsedSeconds) {
  const timerEl = document.getElementById("examTimerDisplay");
  if (!timerEl) {
    return;
  }
  const isPractice = examMode === EXAM_MODES.PRACTICE;
  timerEl.textContent = isPractice
    ? `已用時間 ${formatSeconds(elapsedSeconds)}`
    : `剩餘時間 ${formatSeconds(remainingSeconds)}`;
  timerEl.classList.toggle("urgent", !isPractice && remainingSeconds <= EXAM_CONFIG.urgentThresholdSeconds);
}
