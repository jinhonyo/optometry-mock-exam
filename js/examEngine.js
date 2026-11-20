/**
 * 模組名稱：examEngine.js
 * 模組職責：管理測驗組卷演算法（歷屆原卷、自訂隨機、錯題複習、搜尋結果練習）與進行中測驗的作答狀態。
 */

import { EXAM_MODES } from "./config.js";

/**
 * 使用 Fisher-Yates 洗牌演算法隨機打亂陣列並回傳新陣列（不修改原陣列）。
 *
 * @param {Array<any>} sourceArray - 來源陣列。
 * @returns {Array<any>} 洗牌後的新陣列。
 */
export function shuffleArray(sourceArray) {
  // 複製來源陣列避免副作用
  const result = [...sourceArray];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[randomIndex];
    result[randomIndex] = temp;
  }
  return result;
}

/**
 * 依指定場次與科目還原完整歷屆原卷（按題號遞增排序）。
 *
 * @param {Array<Object>} bank - 該類別題庫陣列。
 * @param {string} sessionCode - 場次代碼。
 * @param {string} subject - 科目名稱。
 * @returns {Array<Object>} 依題號排序之原卷題目陣列。
 */
export function buildPastPaper(bank, sessionCode, subject) {
  // 篩選符合場次代碼與科目之題目，並依原卷題號排序
  const paperQuestions = bank
    .filter((q) => q.sessionCode === sessionCode && q.subject === subject)
    .sort((a, b) => a.number - b.number);
  return paperQuestions;
}

/**
 * 依條件篩選並隨機抽取自訂考卷。
 *
 * @param {Array<Object>} bank - 該類別題庫陣列。
 * @param {Object} filters - 篩選條件物件。
 * @param {number} filters.yearFrom - 起始年度（民國）。
 * @param {number} filters.yearTo - 結束年度（民國）。
 * @param {Array<string>} filters.subjects - 勾選之科目陣列。
 * @param {boolean} filters.excludeImage - 是否排除含圖題。
 * @param {number} filters.count - 欲抽取題數。
 * @returns {Array<Object>} 隨機抽取後之題目陣列。
 */
export function buildRandomPaper(bank, { yearFrom, yearTo, subjects, excludeImage, count }) {
  // 確保年度起訖順序正確
  const minYear = Math.min(yearFrom, yearTo);
  const maxYear = Math.max(yearFrom, yearTo);
  const subjectSet = new Set(subjects);

  // 篩選符合年度、科目與含圖條件之候選題池
  const pool = bank.filter((q) => {
    const matchYear = q.year >= minYear && q.year <= maxYear;
    const matchSubject = subjectSet.size === 0 || subjectSet.has(q.subject);
    const matchImage = excludeImage ? !q.hasImage : true;
    return matchYear && matchSubject && matchImage;
  });

  // 洗牌後截取目標題數
  const shuffled = shuffleArray(pool);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * 根據錯題本 ID 清單組出錯題複習考卷。
 *
 * @param {Array<Object>} allQuestions - 全體題庫陣列。
 * @param {Record<string, Object>} wrongBook - 錯題本字典物件。
 * @param {number} maxCount - 最大抽取題數（0 代表全部）。
 * @returns {Array<Object>} 錯題複習考卷陣列。
 */
export function buildWrongReviewPaper(allQuestions, wrongBook, maxCount = 0) {
  // 取得錯題 ID 集合
  const wrongIdSet = new Set(Object.keys(wrongBook));
  // 篩選出錯題對應題目並隨機洗牌
  const matched = shuffleArray(allQuestions.filter((q) => wrongIdSet.has(q.id)));
  if (maxCount > 0) {
    return matched.slice(0, Math.min(maxCount, matched.length));
  }
  return matched;
}

/**
 * 測驗執行狀態管理類別，負責追蹤目前題號、作答紀錄與標記狀態。
 */
export class ExamSession {
  /**
   * 建立一場新的測驗實例。
   *
   * @param {Object} params - 測驗初始化參數。
   * @param {string} params.title - 本次測驗標題。
   * @param {string} params.examMode - 作答模式（mock 或 practice）。
   * @param {string} params.sourceType - 考卷來源類型（past / random / wrong / search）。
   * @param {Array<Object>} params.questions - 考卷題目陣列。
   * @param {number} params.durationSeconds - 模擬考時限（秒）。
   */
  constructor({ title, examMode = EXAM_MODES.MOCK, sourceType = "past", questions = [], durationSeconds = 3600 }) {
    // 測驗名稱
    this.title = title;
    // 作答模式（模擬考或刷題練習）
    this.examMode = examMode;
    // 組卷來源類型
    this.sourceType = sourceType;
    // 題目陣列
    this.questions = questions;
    // 時限秒數
    this.durationSeconds = durationSeconds;
    // 目前所在題目索引（0 起始）
    this.currentIndex = 0;
    // 使用者作答對照表（鍵為題目 ID，值為選項 A-D）
    this.userAnswers = {};
    // 標記待確認之題目 ID 集合
    this.flaggedIds = new Set();
    // 測驗開始時間 ISO 字串
    this.startedAt = new Date().toISOString();
    // 是否已交卷
    this.isSubmitted = false;
  }

  /**
   * 取得目前正在作答的題目物件。
   *
   * @returns {Object|null} 目前題目物件。
   */
  getCurrentQuestion() {
    return this.questions[this.currentIndex] || null;
  }

  /**
   * 記錄使用者於指定題目選擇的選項。
   *
   * @param {string} questionId - 題目唯一識別碼。
   * @param {string} optionKey - 選項代碼（"A"~"D"）。
   * @returns {void}
   */
  setAnswer(questionId, optionKey) {
    if (this.isSubmitted) {
      return;
    }
    this.userAnswers[questionId] = optionKey;
  }

  /**
   * 切換指定題目的待確認標記狀態。
   *
   * @param {string} questionId - 題目唯一識別碼。
   * @returns {boolean} 切換後是否處於標記狀態。
   */
  toggleFlag(questionId) {
    if (this.flaggedIds.has(questionId)) {
      this.flaggedIds.delete(questionId);
      return false;
    }
    this.flaggedIds.add(questionId);
    return true;
  }

  /**
   * 切換至指定題目索引位置。
   *
   * @param {number} index - 目標索引（0 起始）。
   * @returns {void}
   */
  goTo(index) {
    if (index >= 0 && index < this.questions.length) {
      this.currentIndex = index;
    }
  }

  /**
   * 取得已作答題數。
   *
   * @returns {number} 已作答題數。
   */
  getAnsweredCount() {
    return Object.keys(this.userAnswers).length;
  }
}
