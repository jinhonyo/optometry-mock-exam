/**
 * 模組名稱：resultView.js
 * 模組職責：渲染交卷成績單、各科正確率統計與逐題檢討清單，支援篩選「全部／錯題／標記題」與錯題本移除。
 */

import { OPTION_KEYS } from "../config.js";
import { formatCorrectAnswer } from "../scorer.js";
import { escapeHtml } from "../searchEngine.js";
import { removeWrongQuestion } from "../storageService.js";
import { formatSeconds } from "../timer.js";

/**
 * 目前檢討列表篩選模式變數（all / wrong / flagged）。
 * @type {string}
 */
let reviewFilter = "all";

/**
 * 渲染成績單與逐題檢討介面。
 *
 * @param {HTMLElement} container - 視圖容器元素。
 * @param {Object} report - scoreExam 產出之完整評分報告。
 * @param {Object} sessionMeta - 測驗中繼資訊 { title, elapsedSeconds }。
 * @param {Object} callbacks - 回呼函式集合 { onBackHome, onRetryWrong, onNotify }。
 * @returns {void}
 */
export function renderResultView(container, report, sessionMeta, callbacks) {
  // 依篩選條件過濾欲顯示之逐題檢討項目
  const filteredDetails = report.details.filter((item) => {
    if (reviewFilter === "wrong") {
      return !item.isCorrect;
    }
    if (reviewFilter === "flagged") {
      return item.isFlagged;
    }
    return true;
  });

  // 產生分科正確率統計列 HTML
  const subjectRowsHtml = report.subjectBreakdown
    .map(
      (s) => `
      <tr>
        <td>${escapeHtml(s.subject)}</td>
        <td>${s.correct} / ${s.total}</td>
        <td><strong>${s.accuracy}%</strong></td>
      </tr>
    `
    )
    .join("");

  // 產生逐題檢討卡片 HTML
  const reviewItemsHtml = filteredDetails.length
    ? filteredDetails
        .map((item) => {
          const q = item.question;
          const correctText = formatCorrectAnswer(q);
          const optionsHtml = OPTION_KEYS.map((key) => {
            const isCorrectOpt = q.answers.includes("ALL") || q.answers.includes(key);
            const isUserOpt = item.userAnswer === key;
            let prefix = "";
            if (isCorrectOpt) {
              prefix = "✅ ";
            } else if (isUserOpt) {
              prefix = "❌ ";
            }
            const optText = q.options[key] ? escapeHtml(q.options[key]) : "（圖形選項，請參閱原卷 PDF）";
            return `<div style="margin: 0.25rem 0; ${isCorrectOpt ? "color: var(--color-success); font-weight: 700;" : isUserOpt ? "color: var(--color-danger);" : ""}">${prefix}(${key}) ${optText}</div>`;
          }).join("");

          return `
            <article class="review-item ${item.isCorrect ? "is-correct" : "is-wrong"}">
              <div class="question-meta">
                <span class="badge ${item.isCorrect ? "badge-success" : "badge-danger"}">
                  第 ${item.index} 題・${item.isCorrect ? "答對" : "答錯"}
                </span>
                <span>民國 ${q.year} 年・${escapeHtml(q.subject)}・原卷第 ${q.number} 題</span>
                ${item.isFlagged ? `<span class="badge badge-warning">★ 已標記</span>` : ""}
                ${q.hasImage ? `<span class="badge badge-warning">含圖題</span>` : ""}
                ${q.pdfUrl ? `<a href="${escapeHtml(q.pdfUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="margin-left: auto;">原卷 PDF</a>` : ""}
              </div>
              <p style="font-weight: 600; margin: 0.4rem 0 0.65rem;">${escapeHtml(q.question)}</p>
              <div style="font-size: 0.92rem; margin-bottom: 0.65rem;">${optionsHtml}</div>
              <div style="font-size: 0.86rem; color: var(--color-text-muted); display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;">
                <span>你的作答：<strong>${item.userAnswer || "未作答"}</strong></span>
                <span>標準答案：<strong>${escapeHtml(correctText)}</strong></span>
                ${!item.isCorrect ? `<button class="btn btn-sm remove-wrong-btn" data-qid="${escapeHtml(q.id)}">從錯題本移出</button>` : ""}
              </div>
              ${q.note ? `<div style="margin-top: 0.45rem; font-size: 0.85rem; color: var(--color-warning);">考選部備註：${escapeHtml(q.note)}</div>` : ""}
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">此篩選條件下沒有題目。</div>`;

  container.innerHTML = `
    <div class="card">
      <div class="card-title">
        <span>測驗成績報告：${escapeHtml(sessionMeta.title)}</span>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${report.wrongQuestions.length > 0 ? `<button id="retryWrongBtn" class="btn btn-primary btn-sm">重考本次錯題（${report.wrongQuestions.length}）</button>` : ""}
          <button id="printResultBtn" class="btn btn-sm">列印成績單</button>
          <button id="backHomeBtn" class="btn btn-sm">返回測驗設定</button>
        </div>
      </div>

      <div class="grid-4" style="margin-bottom: 1.15rem;">
        <div class="stat-box">
          <div class="stat-label">總分（百分制）</div>
          <div class="stat-value" style="color: ${report.score >= 60 ? "var(--color-success)" : "var(--color-danger)"};">${report.score} 分</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">答對 / 總題數</div>
          <div class="stat-value">${report.correctCount} / ${report.totalCount}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">答錯（含未作答 ${report.unansweredCount}）</div>
          <div class="stat-value" style="color: var(--color-danger);">${report.wrongCount}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">作答耗時</div>
          <div class="stat-value">${formatSeconds(sessionMeta.elapsedSeconds)}</div>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>科目</th>
            <th>答對 / 題數</th>
            <th>正確率</th>
          </tr>
        </thead>
        <tbody>${subjectRowsHtml}</tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-title">
        <span>逐題檢討</span>
        <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;">
          <button class="btn btn-sm ${reviewFilter === "all" ? "btn-primary" : ""}" data-filter="all">全部（${report.totalCount}）</button>
          <button class="btn btn-sm ${reviewFilter === "wrong" ? "btn-primary" : ""}" data-filter="wrong">只看錯題（${report.wrongCount}）</button>
          <button class="btn btn-sm ${reviewFilter === "flagged" ? "btn-primary" : ""}" data-filter="flagged">只看標記題</button>
        </div>
      </div>
      <div>${reviewItemsHtml}</div>
    </div>
  `;

  // 綁定篩選切換事件
  container.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      reviewFilter = btn.dataset.filter;
      renderResultView(container, report, sessionMeta, callbacks);
    });
  });

  // 綁定從錯題本移出按鈕
  container.querySelectorAll(".remove-wrong-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeWrongQuestion(btn.dataset.qid);
      btn.disabled = true;
      btn.textContent = "已移出錯題本";
      callbacks.onNotify("已將該題從錯題本移出");
    });
  });

  // 綁定操作按鈕
  container.querySelector("#backHomeBtn").addEventListener("click", callbacks.onBackHome);
  container.querySelector("#printResultBtn").addEventListener("click", () => window.print());
  const retryBtn = container.querySelector("#retryWrongBtn");
  if (retryBtn) {
    retryBtn.addEventListener("click", () => callbacks.onRetryWrong(report.wrongQuestions));
  }
}
