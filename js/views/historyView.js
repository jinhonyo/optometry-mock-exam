/**
 * 模組名稱：historyView.js
 * 模組職責：渲染歷史測驗成績紀錄、錯題本管理清單，並提供 JSON 備份檔案下載匯出與上傳匯入功能。
 */

import { formatCorrectAnswer } from "../scorer.js";
import { escapeHtml } from "../searchEngine.js";
import {
  clearExamHistory,
  clearWrongBook,
  exportBackupJson,
  getExamHistory,
  getWrongBook,
  importBackupJson,
  removeWrongQuestion,
} from "../storageService.js";
import { formatSeconds } from "../timer.js";

/**
 * 將 ISO 日期字串格式化為台灣習慣之年月日時分格式。
 *
 * @param {string} isoString - ISO 8601 時間字串。
 * @returns {string} 格式化時間文字。
 */
function formatDateTime(isoString) {
  if (!isoString) {
    return "-";
  }
  const dateObj = new Date(isoString);
  return dateObj.toLocaleString("zh-TW", { hour12: false });
}

/**
 * 觸發瀏覽器下載 JSON 備份檔案。
 *
 * @param {string} jsonContent - JSON 純文字內容。
 * @returns {void}
 */
function triggerDownloadJson(jsonContent) {
  // 建立 Blob 物件與暫時下載連結
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `optometry-exam-backup-${dateStamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

/**
 * 渲染錯題本、歷史成績與 JSON 備份管理頁面。
 *
 * @param {HTMLElement} container - 視圖容器元素。
 * @param {Array<Object>} allQuestions - 全體題庫陣列（用於反查錯題完整題幹）。
 * @param {Object} callbacks - 回呼函式集合 { onStartWrongReview, onNotify }。
 * @returns {void}
 */
export function renderHistoryView(container, allQuestions, callbacks) {
  const wrongBook = getWrongBook();
  const wrongEntries = Object.values(wrongBook);
  const historyList = getExamHistory();

  // 建立題目 ID 快速查找表
  const questionMap = new Map(allQuestions.map((q) => [q.id, q]));

  // 產生歷史測驗表格列 HTML
  const historyRowsHtml = historyList.length
    ? historyList
        .map(
          (rec) => `
        <tr>
          <td>${escapeHtml(formatDateTime(rec.finishedAt))}</td>
          <td>${escapeHtml(rec.title)}</td>
          <td><span class="badge badge-primary">${rec.examMode === "practice" ? "刷題練習" : "模擬考"}</span></td>
          <td><strong style="color: ${rec.score >= 60 ? "var(--color-success)" : "var(--color-danger)"};">${rec.score} 分</strong></td>
          <td>${rec.correctCount} / ${rec.totalCount}</td>
          <td>${formatSeconds(rec.elapsedSeconds || 0)}</td>
        </tr>
      `
        )
        .join("")
    : `<tr><td colspan="6" class="empty-state">尚無歷史測驗紀錄。</td></tr>`;

  // 產生錯題本條列 HTML
  const wrongItemsHtml = wrongEntries.length
    ? wrongEntries
        .sort((a, b) => (b.lastWrongAt || "").localeCompare(a.lastWrongAt || ""))
        .map((entry) => {
          const q = questionMap.get(entry.questionId);
          if (!q) {
            return "";
          }
          return `
            <article class="review-item is-wrong">
              <div class="question-meta">
                <span class="badge badge-danger">答錯 ${entry.wrongCount} 次</span>
                <span>${escapeHtml(q.categoryLabel)}・民國 ${q.year} 年・${escapeHtml(q.subject)}・第 ${q.number} 題</span>
                <button class="btn btn-sm remove-wrong-item" data-qid="${escapeHtml(q.id)}" style="margin-left: auto;">移出錯題本</button>
              </div>
              <p style="font-weight: 600; margin: 0.35rem 0;">${escapeHtml(q.question)}</p>
              <div style="font-size: 0.88rem; color: var(--color-text-muted);">
                標準答案：<strong>${escapeHtml(formatCorrectAnswer(q))}</strong>
                ${q.pdfUrl ? `｜<a href="${escapeHtml(q.pdfUrl)}" target="_blank" rel="noopener noreferrer">查看原卷 PDF</a>` : ""}
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">目前錯題本是空的。</div>`;

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">資料備份與還原（JSON）</h2>
      <p style="margin-top: 0; font-size: 0.9rem; color: var(--color-text-muted);">
        所有錯題本與歷史成績皆儲存於本機瀏覽器。跨裝置同步或清除快取前，可將紀錄匯出為 JSON 備份檔保存。
      </p>
      <div style="display: flex; flex-wrap: wrap; gap: 0.65rem; align-items: center;">
        <button id="exportBackupBtn" class="btn btn-primary">匯出 JSON 備份檔</button>
        <label class="btn" for="importBackupInput">匯入 JSON（合併至現有紀錄）</label>
        <input id="importBackupInput" type="file" accept="application/json,.json" style="display: none;" />
        <label class="btn" for="importOverwriteInput">匯入 JSON（覆蓋現有紀錄）</label>
        <input id="importOverwriteInput" type="file" accept="application/json,.json" style="display: none;" />
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>歷史測驗成績（最近 ${historyList.length} 筆）</span>
        ${historyList.length > 0 ? `<button id="clearHistoryBtn" class="btn btn-sm btn-danger">清空歷史紀錄</button>` : ""}
      </div>
      <div style="overflow-x: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>完成時間</th>
              <th>測驗名稱</th>
              <th>模式</th>
              <th>總分</th>
              <th>答對 / 題數</th>
              <th>耗時</th>
            </tr>
          </thead>
          <tbody>${historyRowsHtml}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>錯題本管理（共 ${wrongEntries.length} 題）</span>
        <div style="display: flex; gap: 0.5rem;">
          ${wrongEntries.length > 0 ? `<button id="reviewAllWrongBtn" class="btn btn-primary btn-sm">開始錯題複習</button>` : ""}
          ${wrongEntries.length > 0 ? `<button id="clearWrongBtn" class="btn btn-danger btn-sm">清空錯題本</button>` : ""}
        </div>
      </div>
      <div>${wrongItemsHtml}</div>
    </div>
  `;

  // 匯出 JSON 備份事件
  container.querySelector("#exportBackupBtn").addEventListener("click", () => {
    const jsonText = exportBackupJson();
    triggerDownloadJson(jsonText);
    callbacks.onNotify("已下載 JSON 備份檔案");
  });

  /**
   * 處理使用者選取 JSON 備份檔後之讀取與匯入流程。
   *
   * @param {Event} event - 檔案輸入元素 change 事件。
   * @param {boolean} mergeMode - 是否為合併模式。
   * @returns {void}
   */
  const handleFileImport = (event, mergeMode) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = importBackupJson(String(reader.result || ""), mergeMode);
        callbacks.onNotify(
          `匯入成功（錯題 ${result.wrongCount} 題、歷史紀錄 ${result.historyCount} 筆）`
        );
        renderHistoryView(container, allQuestions, callbacks);
      } catch (error) {
        callbacks.onNotify(`匯入失敗：${error.message}`);
      }
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  };

  container.querySelector("#importBackupInput").addEventListener("change", (e) => handleFileImport(e, true));
  container.querySelector("#importOverwriteInput").addEventListener("change", (e) => handleFileImport(e, false));

  // 清空歷史紀錄事件
  const clearHistoryBtn = container.querySelector("#clearHistoryBtn");
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      if (window.confirm("確定要清空所有歷史測驗成績紀錄嗎？")) {
        clearExamHistory();
        callbacks.onNotify("已清空歷史紀錄");
        renderHistoryView(container, allQuestions, callbacks);
      }
    });
  }

  // 清空錯題本事件
  const clearWrongBtn = container.querySelector("#clearWrongBtn");
  if (clearWrongBtn) {
    clearWrongBtn.addEventListener("click", () => {
      if (window.confirm("確定要清空整個錯題本嗎？")) {
        clearWrongBook();
        callbacks.onNotify("已清空錯題本");
        renderHistoryView(container, allQuestions, callbacks);
      }
    });
  }

  // 啟動錯題複習事件
  const reviewAllBtn = container.querySelector("#reviewAllWrongBtn");
  if (reviewAllBtn) {
    reviewAllBtn.addEventListener("click", () => {
      callbacks.onStartWrongReview({ maxCount: 0, examMode: "practice" });
    });
  }

  // 單題移出錯題本事件
  container.querySelectorAll(".remove-wrong-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeWrongQuestion(btn.dataset.qid);
      callbacks.onNotify("已移出錯題本");
      renderHistoryView(container, allQuestions, callbacks);
    });
  });
}
