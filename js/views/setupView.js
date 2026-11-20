/**
 * 模組名稱：setupView.js
 * 模組職責：渲染首頁測驗設定面板，提供「歷屆原卷模擬」、「自訂隨機刷題」與「錯題本複習」三種組卷介面，
 *          並支援切換「模擬考模式（計時）」與「刷題練習模式（即時對答案）」。
 */

import { EXAM_CONFIG, EXAM_MODES } from "../config.js";
import { escapeHtml } from "../searchEngine.js";
import { getExamHistory, getWrongBookCount } from "../storageService.js";

/**
 * 記錄目前首頁選中之組卷分頁狀態變數（past / random / wrong）。
 * @type {string}
 */
let activeTab = "past";

/**
 * 記錄目前選中之類別代碼變數（optometrist / assistant）。
 * @type {string}
 */
let selectedCategory = "optometrist";

/**
 * 記錄目前選中之作答模式變數（mock / practice）。
 * @type {string}
 */
let selectedExamMode = EXAM_MODES.MOCK;

/**
 * 依類別與年度篩選對應的場次與科目清單。
 *
 * @param {Object} metadata - 系統場次詮釋資料物件。
 * @param {string} categoryKey - 類別代碼。
 * @param {number} year - 民國年度。
 * @returns {Array<Object>} 符合條件之場次科目物件陣列。
 */
function getSessionsByCategoryAndYear(metadata, categoryKey, year) {
  // 過濾符合類別與年度之場次紀錄
  const matched = metadata.sessions.filter(
    (s) => s.categoryKey === categoryKey && Number(s.year) === Number(year)
  );
  return matched;
}

/**
 * 渲染首頁測驗設定視圖並綁定所有互動事件。
 *
 * @param {HTMLElement} container - 視圖容器元素。
 * @param {Object} metadata - 系統詮釋資料物件。
 * @param {Object} callbacks - 與主控模組溝通之回呼函式物件。
 * @param {Function} callbacks.onStartPastPaper - 開始歷屆原卷測驗回呼。
 * @param {Function} callbacks.onStartRandomPaper - 開始自訂隨機測驗回呼。
 * @param {Function} callbacks.onStartWrongReview - 開始錯題本複習回呼。
 * @returns {void}
 */
export function renderSetupView(container, metadata, callbacks) {
  // 讀取本機錯題數與歷史測驗紀錄統計
  const wrongCount = getWrongBookCount();
  const historyList = getExamHistory();
  const catMeta = metadata.categories[selectedCategory];
  const latestYear = catMeta.years[0];

  container.innerHTML = `
    <div class="grid-4" style="margin-bottom: 1.25rem;">
      <div class="stat-box">
        <div class="stat-label">題庫總題數</div>
        <div class="stat-value">${metadata.totalQuestions.toLocaleString()}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">驗光師 / 驗光生</div>
        <div class="stat-value">${metadata.categories.optometrist.totalQuestions} / ${metadata.categories.assistant.totalQuestions}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">待複習錯題數</div>
        <div class="stat-value">${wrongCount}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">已完成測驗次數</div>
        <div class="stat-value">${historyList.length}</div>
      </div>
    </div>

    <div class="card">
      <div class="grid-2" style="margin-bottom: 1rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="setupCategorySelect">報考類別</label>
          <select id="setupCategorySelect" class="form-select">
            <option value="optometrist" ${selectedCategory === "optometrist" ? "selected" : ""}>驗光師（專技高考 / 特考，5 科）</option>
            <option value="assistant" ${selectedCategory === "assistant" ? "selected" : ""}>驗光生（專技普考 / 特考，4 科）</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="setupExamModeSelect">作答模式</label>
          <select id="setupExamModeSelect" class="form-select">
            <option value="${EXAM_MODES.MOCK}" ${selectedExamMode === EXAM_MODES.MOCK ? "selected" : ""}>模擬考模式（60 分鐘倒數，交卷統一算分）</option>
            <option value="${EXAM_MODES.PRACTICE}" ${selectedExamMode === EXAM_MODES.PRACTICE ? "selected" : ""}>刷題練習模式（無時限，選答立即顯示正解與備註）</option>
          </select>
        </div>
      </div>

      <div class="tab-bar" role="tablist">
        <button class="tab-btn ${activeTab === "past" ? "active" : ""}" data-tab="past">歷屆原卷模擬</button>
        <button class="tab-btn ${activeTab === "random" ? "active" : ""}" data-tab="random">自訂隨機刷題</button>
        <button class="tab-btn ${activeTab === "wrong" ? "active" : ""}" data-tab="wrong">錯題本複習（${wrongCount}）</button>
      </div>

      <div id="setupTabContent"></div>
    </div>
  `;

  // 綁定類別切換事件
  container.querySelector("#setupCategorySelect").addEventListener("change", (event) => {
    selectedCategory = event.target.value;
    renderSetupView(container, metadata, callbacks);
  });

  // 綁定作答模式切換事件
  container.querySelector("#setupExamModeSelect").addEventListener("change", (event) => {
    selectedExamMode = event.target.value;
  });

  // 綁定分頁籤切換事件
  container.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      renderSetupView(container, metadata, callbacks);
    });
  });

  // 依目前分頁渲染對應設定表單
  const tabContainer = container.querySelector("#setupTabContent");
  if (activeTab === "past") {
    renderPastPaperTab(tabContainer, metadata, catMeta, latestYear, callbacks);
  } else if (activeTab === "random") {
    renderRandomPaperTab(tabContainer, catMeta, callbacks);
  } else {
    renderWrongReviewTab(tabContainer, wrongCount, callbacks);
  }
}

/**
 * 渲染「歷屆原卷模擬」分頁表單與場次科目清單。
 *
 * @param {HTMLElement} tabContainer - 分頁內容容器。
 * @param {Object} metadata - 系統詮釋資料。
 * @param {Object} catMeta - 當前類別詮釋資料。
 * @param {number} defaultYear - 預設選取年度。
 * @param {Object} callbacks - 回呼函式集合。
 * @returns {void}
 */
function renderPastPaperTab(tabContainer, metadata, catMeta, defaultYear, callbacks) {
  // 產生年度下拉選項 HTML
  const yearOptionsHtml = catMeta.years
    .map((yr) => `<option value="${yr}">民國 ${yr} 年</option>`)
    .join("");

  tabContainer.innerHTML = `
    <div class="grid-2">
      <div class="form-group">
        <label class="form-label" for="pastYearSelect">選擇年度（民國）</label>
        <select id="pastYearSelect" class="form-select">${yearOptionsHtml}</select>
      </div>
      <div class="form-group">
        <label class="form-label" for="pastSessionSelect">選擇考試場次與科目</label>
        <select id="pastSessionSelect" class="form-select"></select>
      </div>
    </div>
    <div id="pastPaperMetaInfo" style="margin-bottom: 1rem;"></div>
    <button id="startPastPaperBtn" class="btn btn-primary">開始本卷測驗</button>
  `;

  const yearSelect = tabContainer.querySelector("#pastYearSelect");
  const sessionSelect = tabContainer.querySelector("#pastSessionSelect");
  const metaInfoBox = tabContainer.querySelector("#pastPaperMetaInfo");

  /**
   * 依所選年度更新場次科目下拉選單。
   * @returns {void}
   */
  const updateSessionOptions = () => {
    const sessions = getSessionsByCategoryAndYear(metadata, selectedCategory, yearSelect.value);
    sessionSelect.innerHTML = sessions
      .map((s, idx) => {
        const shortName = s.examGroup ? `[${s.examGroup}] ` : "";
        return `<option value="${idx}">${escapeHtml(shortName + s.subject)}（${s.questionCount} 題${s.imageCount > 0 ? `・含圖 ${s.imageCount}` : ""}）</option>`;
      })
      .join("");
    updatePaperMeta(sessions);
  };

  /**
   * 顯示所選試卷的含圖數量、更正答案備註與原卷 PDF 連結。
   * @param {Array<Object>} sessions - 該年度場次陣列。
   * @returns {void}
   */
  const updatePaperMeta = (sessions) => {
    const selected = sessions[Number(sessionSelect.value)];
    if (!selected) {
      metaInfoBox.innerHTML = "";
      return;
    }
    metaInfoBox.innerHTML = `
      <div class="stat-box" style="font-size: 0.88rem;">
        <div><strong>考試場次：</strong>${escapeHtml(selected.sessionName)}</div>
        <div style="margin-top: 0.35rem; display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center;">
          <span class="badge badge-primary">${selected.questionCount} 題</span>
          ${selected.imageCount > 0 ? `<span class="badge badge-warning">含圖題 ${selected.imageCount} 題</span>` : ""}
          ${selected.hasCorrection ? `<span class="badge badge-danger">考選部有更正答案</span>` : `<span class="badge badge-success">無更正答案</span>`}
          <a href="${escapeHtml(selected.questionPdf)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm">查看原卷 PDF</a>
        </div>
        ${selected.correctionNote ? `<div style="margin-top: 0.4rem; color: var(--color-danger);">更正說明：${escapeHtml(selected.correctionNote)}</div>` : ""}
      </div>
    `;
  };

  yearSelect.value = String(defaultYear);
  updateSessionOptions();

  yearSelect.addEventListener("change", updateSessionOptions);
  sessionSelect.addEventListener("change", () => {
    const sessions = getSessionsByCategoryAndYear(metadata, selectedCategory, yearSelect.value);
    updatePaperMeta(sessions);
  });

  tabContainer.querySelector("#startPastPaperBtn").addEventListener("click", () => {
    const sessions = getSessionsByCategoryAndYear(metadata, selectedCategory, yearSelect.value);
    const chosen = sessions[Number(sessionSelect.value)];
    if (!chosen) {
      return;
    }
    callbacks.onStartPastPaper({
      categoryKey: selectedCategory,
      sessionInfo: chosen,
      examMode: selectedExamMode,
    });
  });
}

/**
 * 渲染「自訂隨機刷題」分頁表單。
 *
 * @param {HTMLElement} tabContainer - 分頁內容容器。
 * @param {Object} catMeta - 當前類別詮釋資料。
 * @param {Object} callbacks - 回呼函式集合。
 * @returns {void}
 */
function renderRandomPaperTab(tabContainer, catMeta, callbacks) {
  const minYear = catMeta.years[catMeta.years.length - 1];
  const maxYear = catMeta.years[0];

  const yearOptions = catMeta.years
    .map((yr) => `<option value="${yr}">民國 ${yr} 年</option>`)
    .join("");

  const subjectChips = catMeta.subjects
    .map(
      (subj) => `
      <label class="chip-check">
        <input type="checkbox" name="randomSubject" value="${escapeHtml(subj)}" checked />
        <span>${escapeHtml(subj)}</span>
      </label>
    `
    )
    .join("");

  tabContainer.innerHTML = `
    <div class="grid-3">
      <div class="form-group">
        <label class="form-label" for="randomYearFrom">起始年度</label>
        <select id="randomYearFrom" class="form-select">${yearOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label" for="randomYearTo">結束年度</label>
        <select id="randomYearTo" class="form-select">${yearOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label" for="randomCountInput">抽題數量</label>
        <select id="randomCountInput" class="form-select">
          <option value="10">10 題（快速練習）</option>
          <option value="25">25 題（半卷練習）</option>
          <option value="50" selected>50 題（標準國考題數）</option>
          <option value="100">100 題（高強度刷題）</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">勾選科目（可複選）</label>
      <div class="checkbox-grid">${subjectChips}</div>
    </div>

    <div class="form-group">
      <label class="chip-check">
        <input type="checkbox" id="excludeImageCheckbox" />
        <span>排除「含圖題」（僅抽取純文字可完整作答題目）</span>
      </label>
    </div>

    <button id="startRandomPaperBtn" class="btn btn-primary">產生隨機考卷並開始</button>
  `;

  tabContainer.querySelector("#randomYearFrom").value = String(minYear);
  tabContainer.querySelector("#randomYearTo").value = String(maxYear);

  tabContainer.querySelector("#startRandomPaperBtn").addEventListener("click", () => {
    const checkedSubjects = Array.from(
      tabContainer.querySelectorAll('input[name="randomSubject"]:checked')
    ).map((input) => input.value);

    const count = Number(tabContainer.querySelector("#randomCountInput").value) || EXAM_CONFIG.defaultRandomCount;
    const yearFrom = Number(tabContainer.querySelector("#randomYearFrom").value);
    const yearTo = Number(tabContainer.querySelector("#randomYearTo").value);
    const excludeImage = tabContainer.querySelector("#excludeImageCheckbox").checked;

    callbacks.onStartRandomPaper({
      categoryKey: selectedCategory,
      yearFrom,
      yearTo,
      subjects: checkedSubjects,
      excludeImage,
      count,
      examMode: selectedExamMode,
    });
  });
}

/**
 * 渲染「錯題本複習」分頁表單。
 *
 * @param {HTMLElement} tabContainer - 分頁內容容器。
 * @param {number} wrongCount - 目前錯題本題數。
 * @param {Object} callbacks - 回呼函式集合。
 * @returns {void}
 */
function renderWrongReviewTab(tabContainer, wrongCount, callbacks) {
  if (wrongCount === 0) {
    tabContainer.innerHTML = `
      <div class="empty-state">
        <p>目前錯題本沒有任何題目。</p>
        <p style="font-size: 0.88rem;">完成歷屆原卷或隨機刷題後，答錯的題目會自動收錄至此供集中複習。</p>
      </div>
    `;
    return;
  }

  tabContainer.innerHTML = `
    <p style="margin-top: 0;">目前錯題本共收錄 <strong>${wrongCount}</strong> 題（包含驗光師與驗光生）。</p>
    <div class="form-group" style="max-width: 300px;">
      <label class="form-label" for="wrongCountSelect">本次複習題數</label>
      <select id="wrongCountSelect" class="form-select">
        <option value="0">全部錯題（${wrongCount} 題）</option>
        <option value="20">隨機抽 20 題</option>
        <option value="50">隨機抽 50 題</option>
      </select>
    </div>
    <button id="startWrongReviewBtn" class="btn btn-primary">開始錯題複習</button>
  `;

  tabContainer.querySelector("#startWrongReviewBtn").addEventListener("click", () => {
    const maxCount = Number(tabContainer.querySelector("#wrongCountSelect").value) || 0;
    callbacks.onStartWrongReview({
      maxCount,
      examMode: selectedExamMode,
    });
  });
}
