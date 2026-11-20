/**
 * 模組名稱：searchView.js
 * 模組職責：渲染題庫關鍵字搜尋介面，支援多詞彙全文檢索、年度與科目篩選、分頁顯示與「以搜尋結果直接練習」。
 */

import { OPTION_KEYS } from "../config.js";
import { formatCorrectAnswer } from "../scorer.js";
import { escapeHtml, highlightText, searchQuestions } from "../searchEngine.js";

/**
 * 每頁預設顯示搜尋筆數常數。
 * @type {number}
 */
const PAGE_SIZE = 30;

/**
 * 搜尋表單狀態物件（跨次重繪保留使用者輸入條件）。
 * @type {{ keyword: string, categoryKey: string, year: string, subject: string, onlyWithNote: boolean, page: number }}
 */
const searchState = {
  keyword: "",
  categoryKey: "all",
  year: "all",
  subject: "all",
  onlyWithNote: false,
  page: 1,
};

/**
 * 渲染題庫關鍵字搜尋頁面並綁定即時檢索與練習啟動事件。
 *
 * @param {HTMLElement} container - 視圖容器元素。
 * @param {Object} metadata - 系統詮釋資料。
 * @param {Array<Object>} allQuestions - 已載入之全體題庫陣列。
 * @param {Object} callbacks - 回呼函式物件 { onPracticeResults }。
 * @returns {void}
 */
export function renderSearchView(container, metadata, allQuestions, callbacks) {
  // 彙整所有可用年度與科目清單
  const allYears = Array.from(
    new Set([
      ...metadata.categories.optometrist.years,
      ...metadata.categories.assistant.years,
    ])
  ).sort((a, b) => b - a);

  const allSubjects = Array.from(
    new Set([
      ...metadata.categories.optometrist.subjects,
      ...metadata.categories.assistant.subjects,
    ])
  ).sort();

  // 執行關鍵字搜尋並取得符合陣列
  const matchedList = searchQuestions(allQuestions, searchState);
  const totalPages = Math.max(1, Math.ceil(matchedList.length / PAGE_SIZE));
  if (searchState.page > totalPages) {
    searchState.page = 1;
  }
  const startIdx = (searchState.page - 1) * PAGE_SIZE;
  const pageItems = matchedList.slice(startIdx, startIdx + PAGE_SIZE);

  // 產生搜尋結果列表 HTML
  const resultsHtml = pageItems.length
    ? pageItems
        .map((q) => {
          const correctText = formatCorrectAnswer(q);
          const optionsHtml = OPTION_KEYS.map((key) => {
            const text = q.options[key]
              ? highlightText(q.options[key], searchState.keyword)
              : "（圖形選項，請參閱原卷 PDF）";
            return `<div style="margin: 0.2rem 0;">(${key}) ${text}</div>`;
          }).join("");

          return `
            <article class="review-item">
              <div class="question-meta">
                <span class="badge badge-primary">${escapeHtml(q.categoryLabel)}</span>
                <span>民國 ${q.year} 年・${escapeHtml(q.subject)}・第 ${q.number} 題</span>
                ${q.hasImage ? `<span class="badge badge-warning">含圖題</span>` : ""}
                ${q.pdfUrl ? `<a href="${escapeHtml(q.pdfUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="margin-left: auto;">原卷 PDF</a>` : ""}
              </div>
              <p style="font-weight: 600; margin: 0.45rem 0;">${highlightText(q.question, searchState.keyword)}</p>
              <div style="font-size: 0.9rem; margin-bottom: 0.6rem;">${optionsHtml}</div>
              <details>
                <summary style="cursor: pointer; font-weight: 700; color: var(--color-primary);">顯示標準答案與備註</summary>
                <div style="margin-top: 0.45rem; font-size: 0.9rem;">
                  <div>標準答案：<strong>${escapeHtml(correctText)}</strong></div>
                  ${q.note ? `<div style="color: var(--color-warning); margin-top: 0.25rem;">備註：${highlightText(q.note, searchState.keyword)}</div>` : ""}
                </div>
              </details>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">找不到符合條件的題目，請調整關鍵字或篩選條件。</div>`;

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">題庫關鍵字搜尋（共 ${allQuestions.length.toLocaleString()} 題）</h2>
      <div class="grid-4">
        <div class="form-group">
          <label class="form-label" for="searchKeywordInput">關鍵字（空白分隔多詞）</label>
          <input id="searchKeywordInput" class="form-control" type="text" placeholder="例如：小樑網 散光 稜鏡" value="${escapeHtml(searchState.keyword)}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="searchCategorySelect">類別</label>
          <select id="searchCategorySelect" class="form-select">
            <option value="all" ${searchState.categoryKey === "all" ? "selected" : ""}>全部類別</option>
            <option value="optometrist" ${searchState.categoryKey === "optometrist" ? "selected" : ""}>驗光師</option>
            <option value="assistant" ${searchState.categoryKey === "assistant" ? "selected" : ""}>驗光生</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="searchYearSelect">年度</label>
          <select id="searchYearSelect" class="form-select">
            <option value="all">全部年度</option>
            ${allYears.map((yr) => `<option value="${yr}" ${String(searchState.year) === String(yr) ? "selected" : ""}>民國 ${yr} 年</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="searchSubjectSelect">科目</label>
          <select id="searchSubjectSelect" class="form-select">
            <option value="all">全部科目</option>
            ${allSubjects.map((s) => `<option value="${escapeHtml(s)}" ${searchState.subject === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}
          </select>
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
        <label class="chip-check">
          <input type="checkbox" id="searchOnlyNoteCheck" ${searchState.onlyWithNote ? "checked" : ""} />
          <span>僅顯示含圖或有更正備註之題目</span>
        </label>
        <div style="display: flex; gap: 0.5rem;">
          <button id="runSearchBtn" class="btn btn-primary">搜尋</button>
          <button id="resetSearchBtn" class="btn">重設條件</button>
          ${matchedList.length > 0 ? `<button id="practiceSearchBtn" class="btn">以目前結果練習（最多 50 題）</button>` : ""}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>搜尋結果：共 ${matchedList.length.toLocaleString()} 題（第 ${searchState.page} / ${totalPages} 頁）</span>
        <div style="display: flex; gap: 0.45rem;">
          <button id="searchPrevPage" class="btn btn-sm" ${searchState.page <= 1 ? "disabled" : ""}>上一頁</button>
          <button id="searchNextPage" class="btn btn-sm" ${searchState.page >= totalPages ? "disabled" : ""}>下一頁</button>
        </div>
      </div>
      <div>${resultsHtml}</div>
    </div>
  `;

  /**
   * 讀取表單欄位值並重新執行檢索渲染。
   * @returns {void}
   */
  const applySearch = () => {
    searchState.keyword = container.querySelector("#searchKeywordInput").value;
    searchState.categoryKey = container.querySelector("#searchCategorySelect").value;
    searchState.year = container.querySelector("#searchYearSelect").value;
    searchState.subject = container.querySelector("#searchSubjectSelect").value;
    searchState.onlyWithNote = container.querySelector("#searchOnlyNoteCheck").checked;
    searchState.page = 1;
    renderSearchView(container, metadata, allQuestions, callbacks);
  };

  container.querySelector("#runSearchBtn").addEventListener("click", applySearch);
  container.querySelector("#searchKeywordInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      applySearch();
    }
  });
  container.querySelector("#searchCategorySelect").addEventListener("change", applySearch);
  container.querySelector("#searchYearSelect").addEventListener("change", applySearch);
  container.querySelector("#searchSubjectSelect").addEventListener("change", applySearch);
  container.querySelector("#searchOnlyNoteCheck").addEventListener("change", applySearch);

  container.querySelector("#resetSearchBtn").addEventListener("click", () => {
    searchState.keyword = "";
    searchState.categoryKey = "all";
    searchState.year = "all";
    searchState.subject = "all";
    searchState.onlyWithNote = false;
    searchState.page = 1;
    renderSearchView(container, metadata, allQuestions, callbacks);
  });

  container.querySelector("#searchPrevPage").addEventListener("click", () => {
    if (searchState.page > 1) {
      searchState.page -= 1;
      renderSearchView(container, metadata, allQuestions, callbacks);
    }
  });

  container.querySelector("#searchNextPage").addEventListener("click", () => {
    if (searchState.page < totalPages) {
      searchState.page += 1;
      renderSearchView(container, metadata, allQuestions, callbacks);
    }
  });

  const practiceBtn = container.querySelector("#practiceSearchBtn");
  if (practiceBtn) {
    practiceBtn.addEventListener("click", () => {
      callbacks.onPracticeResults(matchedList.slice(0, 50), searchState.keyword || "篩選題庫");
    });
  }
}
