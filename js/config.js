/**
 * 模組名稱：config.js
 * 模組職責：集中管理系統全域常數、資料檔案路徑、考試時間設定與瀏覽器本機儲存鍵名。
 */

/**
 * 靜態資料檔案相對路徑設定物件（相容 GitHub Pages 子路徑部署）。
 * @type {{ metadata: string, banks: Record<string, string> }}
 */
export const DATA_PATHS = {
  // 場次總覽與系統詮釋資料路徑
  metadata: "data/metadata.json",
  // 各類別題庫對應 JSON 路徑
  banks: {
    optometrist: "data/optometrist.json",
    assistant: "data/assistant.json",
  },
};

/**
 * 國考測驗與時間相關預設常數。
 * @type {{ defaultDurationSeconds: number, urgentThresholdSeconds: number, defaultRandomCount: number, maxHistoryRecords: number }}
 */
export const EXAM_CONFIG = {
  // 歷屆原卷模擬考標準作答時間（60 分鐘 = 3600 秒）
  defaultDurationSeconds: 60 * 60,
  // 剩餘時間低於此秒數（5 分鐘）時以紅色警示
  urgentThresholdSeconds: 5 * 60,
  // 自訂隨機刷題預設題數
  defaultRandomCount: 50,
  // 歷史測驗紀錄最多保留筆數
  maxHistoryRecords: 100,
};

/**
 * 測驗作答模式常數列舉。
 * @type {{ MOCK: string, PRACTICE: string }}
 */
export const EXAM_MODES = {
  // 模擬考模式：計時且於交卷後統一計算成績與顯示正解
  MOCK: "mock",
  // 刷題練習模式：選答後立即比對正解並顯示考選部備註
  PRACTICE: "practice",
};

/**
 * localStorage 儲存鍵名與備份結構版本常數。
 * @type {{ WRONG_BOOK: string, HISTORY: string, BACKUP_SCHEMA_VERSION: string }}
 */
export const STORAGE_KEYS = {
  // 錯題本儲存鍵名
  WRONG_BOOK: "optometry_exam_wrong_book_v1",
  // 歷史測驗成績紀錄儲存鍵名
  HISTORY: "optometry_exam_history_v1",
  // 匯出與匯入備份檔之格式版本號
  BACKUP_SCHEMA_VERSION: "1.0.0",
};

/**
 * 單選題選項代碼順序陣列。
 * @type {string[]}
 */
export const OPTION_KEYS = ["A", "B", "C", "D"];
