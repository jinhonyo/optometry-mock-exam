/**
 * 模組名稱：storageService.js
 * 模組職責：封裝瀏覽器 localStorage 存取，管理錯題本、歷史測驗紀錄，並提供 JSON 備份匯出與匯入驗證功能。
 */

import { EXAM_CONFIG, STORAGE_KEYS } from "./config.js";

/**
 * 安全讀取並解析 localStorage 中的 JSON 資料。
 *
 * @param {string} key - localStorage 鍵名。
 * @param {any} fallbackValue - 讀取失敗或資料不存在時的預設回傳值。
 * @returns {any} 解析後的資料或預設值。
 */
function readStorage(key, fallbackValue) {
  try {
    // 讀取原始字串
    const rawText = window.localStorage.getItem(key);
    if (!rawText) {
      return fallbackValue;
    }
    // 解析為 JavaScript 物件或陣列
    return JSON.parse(rawText);
  } catch (error) {
    console.warn(`讀取本機儲存鍵 ${key} 失敗，改用預設值。`, error);
    return fallbackValue;
  }
}

/**
 * 安全將資料序列化並寫入 localStorage。
 *
 * @param {string} key - localStorage 鍵名。
 * @param {any} value - 欲寫入之物件或陣列。
 * @returns {boolean} 寫入成功回傳 true，失敗回傳 false。
 */
function writeStorage(key, value) {
  try {
    // 序列化為 JSON 字串並寫入本機儲存空間
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`寫入本機儲存鍵 ${key} 失敗。`, error);
    return false;
  }
}

/**
 * 取得目前錯題本所有錯題紀錄物件（以題目 ID 為鍵）。
 *
 * @returns {Record<string, { questionId: string, categoryKey: string, wrongCount: number, lastWrongAt: string }>} 錯題本字典物件。
 */
export function getWrongBook() {
  // 讀取錯題本物件，預設為空物件
  const wrongBook = readStorage(STORAGE_KEYS.WRONG_BOOK, {});
  return wrongBook;
}

/**
 * 取得錯題本總題數。
 *
 * @returns {number} 錯題本內目前收錄的題數。
 */
export function getWrongBookCount() {
  // 計算錯題字典鍵值數量
  const count = Object.keys(getWrongBook()).length;
  return count;
}

/**
 * 批次將答錯的題目加入或更新至錯題本。
 *
 * @param {Array<Object>} wrongQuestions - 答錯之題目物件陣列。
 * @returns {void}
 */
export function addWrongQuestions(wrongQuestions) {
  // 讀取現有錯題本
  const wrongBook = getWrongBook();
  // 取得目前 ISO 時間字串
  const nowIso = new Date().toISOString();

  for (const question of wrongQuestions) {
    const existingEntry = wrongBook[question.id];
    // 若已存在則累加答錯次數，否則建立新紀錄
    wrongBook[question.id] = {
      questionId: question.id,
      categoryKey: question.categoryKey,
      wrongCount: existingEntry ? existingEntry.wrongCount + 1 : 1,
      lastWrongAt: nowIso,
    };
  }

  writeStorage(STORAGE_KEYS.WRONG_BOOK, wrongBook);
}

/**
 * 從錯題本中移出指定題目。
 *
 * @param {string} questionId - 欲移除之題目唯一識別碼。
 * @returns {void}
 */
export function removeWrongQuestion(questionId) {
  // 讀取現有錯題本並刪除指定鍵值
  const wrongBook = getWrongBook();
  if (wrongBook[questionId]) {
    delete wrongBook[questionId];
    writeStorage(STORAGE_KEYS.WRONG_BOOK, wrongBook);
  }
}

/**
 * 清空整個錯題本。
 *
 * @returns {void}
 */
export function clearWrongBook() {
  writeStorage(STORAGE_KEYS.WRONG_BOOK, {});
}

/**
 * 取得歷史測驗成績紀錄陣列（依時間由新到舊排序）。
 *
 * @returns {Array<Object>} 歷史成績摘要陣列。
 */
export function getExamHistory() {
  // 讀取歷史成績陣列，預設為空陣列
  const historyList = readStorage(STORAGE_KEYS.HISTORY, []);
  return Array.isArray(historyList) ? historyList : [];
}

/**
 * 新增一筆測驗成績紀錄至歷史清單最前方，並維持最大保留筆數上限。
 *
 * @param {Object} record - 測驗成績摘要物件。
 * @returns {void}
 */
export function saveExamRecord(record) {
  // 取得既有紀錄清單
  const historyList = getExamHistory();
  // 插入新紀錄於最前方
  historyList.unshift(record);
  // 裁切至設定之最大保留筆數
  const trimmedList = historyList.slice(0, EXAM_CONFIG.maxHistoryRecords);
  writeStorage(STORAGE_KEYS.HISTORY, trimmedList);
}

/**
 * 清空所有歷史測驗紀錄。
 *
 * @returns {void}
 */
export function clearExamHistory() {
  writeStorage(STORAGE_KEYS.HISTORY, []);
}

/**
 * 將錯題本與歷史測驗紀錄打包為標準化 JSON 備份物件字串。
 *
 * @returns {string} 格式化後之 JSON 備份字串。
 */
export function exportBackupJson() {
  // 組裝包含版本號與匯出時間的備份物件
  const backupPayload = {
    app: "optometry-mock-exam",
    schemaVersion: STORAGE_KEYS.BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    wrongBook: getWrongBook(),
    history: getExamHistory(),
  };
  return JSON.stringify(backupPayload, null, 2);
}

/**
 * 驗證並匯入 JSON 備份檔案內容，可選擇合併或覆蓋現有本機紀錄。
 *
 * @param {string} jsonText - 使用者上傳之 JSON 檔案純文字內容。
 * @param {boolean} mergeMode - 是否採合併模式（true 為合併，false 為完整覆蓋）。
 * @returns {{ wrongCount: number, historyCount: number }} 匯入完成後的統計結果。
 */
export function importBackupJson(jsonText, mergeMode = true) {
  // 解析輸入文字為 JSON 物件
  const parsed = JSON.parse(jsonText);

  // 基本格式驗證，確保為本系統產出之備份檔
  if (!parsed || typeof parsed !== "object" || parsed.app !== "optometry-mock-exam") {
    throw new Error("備份檔格式不正確：非驗光國考模擬測驗系統匯出檔案。");
  }

  // 取得匯入檔中的錯題本與歷史紀錄
  const incomingWrongBook = parsed.wrongBook && typeof parsed.wrongBook === "object" ? parsed.wrongBook : {};
  const incomingHistory = Array.isArray(parsed.history) ? parsed.history : [];

  if (mergeMode) {
    // 合併錯題本：同一題取較高答錯次數與較新時間
    const currentWrongBook = getWrongBook();
    for (const [qId, item] of Object.entries(incomingWrongBook)) {
      if (!currentWrongBook[qId]) {
        currentWrongBook[qId] = item;
      } else {
        currentWrongBook[qId] = {
          ...currentWrongBook[qId],
          wrongCount: Math.max(currentWrongBook[qId].wrongCount || 1, item.wrongCount || 1),
          lastWrongAt:
            (item.lastWrongAt || "") > (currentWrongBook[qId].lastWrongAt || "")
              ? item.lastWrongAt
              : currentWrongBook[qId].lastWrongAt,
        };
      }
    }
    writeStorage(STORAGE_KEYS.WRONG_BOOK, currentWrongBook);

    // 合併歷史紀錄：依紀錄 ID 去重並按時間由新到舊排序
    const currentHistory = getExamHistory();
    const recordMap = new Map();
    for (const rec of [...currentHistory, ...incomingHistory]) {
      if (rec && rec.id) {
        recordMap.set(rec.id, rec);
      }
    }
    const mergedHistory = Array.from(recordMap.values())
      .sort((a, b) => (b.finishedAt || "").localeCompare(a.finishedAt || ""))
      .slice(0, EXAM_CONFIG.maxHistoryRecords);
    writeStorage(STORAGE_KEYS.HISTORY, mergedHistory);

    return {
      wrongCount: Object.keys(currentWrongBook).length,
      historyCount: mergedHistory.length,
    };
  } else {
    // 覆蓋模式：直接取代本機錯題本與歷史紀錄
    writeStorage(STORAGE_KEYS.WRONG_BOOK, incomingWrongBook);
    const trimmedHistory = incomingHistory.slice(0, EXAM_CONFIG.maxHistoryRecords);
    writeStorage(STORAGE_KEYS.HISTORY, trimmedHistory);

    return {
      wrongCount: Object.keys(incomingWrongBook).length,
      historyCount: trimmedHistory.length,
    };
  }
}
