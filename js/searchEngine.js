/**
 * 模組名稱：searchEngine.js
 * 模組職責：提供題庫全文關鍵字搜尋、多條件篩選與安全 HTML 關鍵字高亮功能。
 */

/**
 * 轉義 HTML 特殊字元，防止 XSS 注入並確保文字正確顯示。
 *
 * @param {string} text - 原始文字。
 * @returns {string} 轉義後之安全 HTML 字串。
 */
export function escapeHtml(text) {
  // 確保輸入為字串
  const safeText = String(text ?? "");
  return safeText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 轉義正規表示式特殊保留字元。
 *
 * @param {string} keyword - 使用者輸入之搜尋關鍵字。
 * @returns {string} 轉義後可用於 RegExp 的字面字串。
 */
function escapeRegExp(keyword) {
  return keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 針對題庫陣列執行多條件與多關鍵字（以空白分隔，採 AND 邏輯）全文檢索。
 *
 * @param {Array<Object>} questions - 題庫陣列。
 * @param {Object} criteria - 搜尋條件物件。
 * @param {string} criteria.keyword - 關鍵字字串（可輸入多個空白分隔詞彙）。
 * @param {string} criteria.categoryKey - 類別代碼（"all" / "optometrist" / "assistant"）。
 * @param {string} criteria.year - 年度篩選（"all" 或民國年度字串）。
 * @param {string} criteria.subject - 科目篩選（"all" 或科目名稱）。
 * @param {boolean} criteria.onlyWithNote - 是否僅顯示有考選部更正或含圖備註之題目。
 * @returns {Array<Object>} 符合條件之題目陣列。
 */
export function searchQuestions(questions, { keyword = "", categoryKey = "all", year = "all", subject = "all", onlyWithNote = false }) {
  // 將關鍵字依空白切分為小寫詞彙陣列
  const tokens = keyword
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  // 執行複合條件過濾
  const matchedList = questions.filter((q) => {
    if (categoryKey !== "all" && q.categoryKey !== categoryKey) {
      return false;
    }
    if (year !== "all" && String(q.year) !== String(year)) {
      return false;
    }
    if (subject !== "all" && q.subject !== subject) {
      return false;
    }
    if (onlyWithNote && !q.note) {
      return false;
    }
    if (tokens.length === 0) {
      return true;
    }

    // 組合題幹、四個選項與備註作為檢索目標文字
    const searchableText = [
      q.question,
      q.options.A,
      q.options.B,
      q.options.C,
      q.options.D,
      q.note,
      q.subject,
    ]
      .join(" ")
      .toLowerCase();

    // 所有輸入詞彙皆須命中（AND 條件）
    return tokens.every((token) => searchableText.includes(token));
  });

  return matchedList;
}

/**
 * 將符合搜尋關鍵字的片段包裹 <mark class="hl"> 標籤以高亮顯示。
 *
 * @param {string} text - 原始顯示文字。
 * @param {string} keyword - 搜尋關鍵字字串。
 * @returns {string} 含安全轉義與高亮標記的 HTML 字串。
 */
export function highlightText(text, keyword) {
  // 先進行 HTML 轉義
  const escaped = escapeHtml(text);
  const tokens = keyword
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return escaped;
  }

  // 建立不分大小寫的全域匹配正規表示式
  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  return escaped.replace(pattern, '<mark class="hl">$1</mark>');
}
