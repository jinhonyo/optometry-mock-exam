/**
 * 模組名稱：dataLoader.js
 * 模組職責：負責透過 fetch 非同步載入靜態 JSON 題庫與場次資料，並實作記憶體快取機制避免重複下載。
 */

import { DATA_PATHS } from "./config.js";

/**
 * 快取已載入之 metadata.json 物件的內部變數。
 * @type {Object|null}
 */
let metadataCache = null;

/**
 * 快取各類別題庫陣列的對照物件（鍵為類別代碼，值為題目物件陣列）。
 * @type {Record<string, Array<Object>>}
 */
const questionBankCache = {};

/**
 * 透過 fetch 取得指定路徑的 JSON 資料。
 *
 * @param {string} url - 目標 JSON 檔案的相對路徑。
 * @returns {Promise<any>} 解析完成之 JSON 物件或陣列。
 */
async function fetchJson(url) {
  // 發送非同步 HTTP 請求取得靜態資源
  const response = await fetch(url);
  // 檢查 HTTP 回應狀態碼是否成功
  if (!response.ok) {
    throw new Error(`無法載入資料檔：${url}（HTTP ${response.status}）`);
  }
  // 解析回應主體為 JSON 資料
  const jsonData = await response.json();
  return jsonData;
}

/**
 * 載入並快取系統場次總覽與詮釋資料（metadata.json）。
 *
 * @returns {Promise<Object>} 場次總覽與類別統計資料物件。
 */
export async function loadMetadata() {
  // 若快取已存在則直接回傳
  if (metadataCache) {
    return metadataCache;
  }
  // 首次載入並存入記憶體快取
  metadataCache = await fetchJson(DATA_PATHS.metadata);
  return metadataCache;
}

/**
 * 依類別代碼按需載入並快取對應之歷屆試題題庫。
 *
 * @param {string} categoryKey - 類別代碼（"optometrist" 或 "assistant"）。
 * @returns {Promise<Array<Object>>} 該類別所有標準化題目物件陣列。
 */
export async function loadQuestionBank(categoryKey) {
  // 若該類別已快取則直接回傳
  if (questionBankCache[categoryKey]) {
    return questionBankCache[categoryKey];
  }
  // 查表取得該類別對應 JSON 路徑
  const filePath = DATA_PATHS.banks[categoryKey];
  if (!filePath) {
    throw new Error(`未知的題庫類別代碼：${categoryKey}`);
  }
  // 非同步載入題庫並快取
  const questions = await fetchJson(filePath);
  questionBankCache[categoryKey] = questions;
  return questions;
}

/**
 * 同時載入所有類別（驗光師與驗光生）題庫並合併為單一陣列，供跨類別搜尋與錯題複習使用。
 *
 * @returns {Promise<Array<Object>>} 全體 7,000 題合併後之題目陣列。
 */
export async function loadAllQuestionBanks() {
  // 取得所有設定的類別代碼陣列
  const categoryKeys = Object.keys(DATA_PATHS.banks);
  // 並行非同步載入所有類別題庫
  const banksArray = await Promise.all(categoryKeys.map((key) => loadQuestionBank(key)));
  // 將二維陣列展平為單一題目陣列回傳
  const mergedQuestions = banksArray.flat();
  return mergedQuestions;
}
