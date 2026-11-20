/**
 * 模組名稱：timer.js
 * 模組職責：提供測驗倒數計時與經過時間計算器，支援暫停、繼續與時間歸零自動回呼。
 */

/**
 * 將秒數格式化為 MM:SS 或 HH:MM:SS 顯示字串。
 *
 * @param {number} totalSeconds - 總秒數。
 * @returns {string} 格式化時間字串。
 */
export function formatSeconds(totalSeconds) {
  // 確保秒數不小於 0
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const pad = (num) => String(num).padStart(2, "0");
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * 測驗計時器類別，支援「倒數模式（模擬考）」與「正數計時模式（刷題練習）」。
 */
export class ExamTimer {
  /**
   * 建立計時器實例。
   *
   * @param {Object} options - 計時器設定物件。
   * @param {boolean} options.isCountdown - 是否為倒數計時模式。
   * @param {number} options.durationSeconds - 倒數模式總秒數。
   * @param {Function} options.onTick - 每秒觸發之回呼函式，參數為 { remainingSeconds, elapsedSeconds }。
   * @param {Function} options.onTimeout - 倒數歸零時觸發之回呼函式。
   */
  constructor({ isCountdown = true, durationSeconds = 3600, onTick = () => {}, onTimeout = () => {} }) {
    // 是否採倒數模式
    this.isCountdown = isCountdown;
    // 初始總秒數
    this.durationSeconds = durationSeconds;
    // 目前剩餘秒數
    this.remainingSeconds = durationSeconds;
    // 已耗用秒數
    this.elapsedSeconds = 0;
    // 每秒更新介面回呼
    this.onTick = onTick;
    // 時間到自動交卷回呼
    this.onTimeout = onTimeout;
    // setInterval 控制代碼
    this.intervalId = null;
    // 是否處於暫停狀態
    this.isPaused = false;
  }

  /**
   * 啟動計時器並每秒推進時間。
   *
   * @returns {void}
   */
  start() {
    this.stop();
    this.isPaused = false;
    this.onTick({
      remainingSeconds: this.remainingSeconds,
      elapsedSeconds: this.elapsedSeconds,
    });

    this.intervalId = window.setInterval(() => {
      if (this.isPaused) {
        return;
      }
      this.elapsedSeconds += 1;

      if (this.isCountdown) {
        this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
      }

      this.onTick({
        remainingSeconds: this.remainingSeconds,
        elapsedSeconds: this.elapsedSeconds,
      });

      if (this.isCountdown && this.remainingSeconds <= 0) {
        this.stop();
        this.onTimeout();
      }
    }, 1000);
  }

  /**
   * 切換暫停與繼續狀態。
   *
   * @returns {boolean} 切換後是否為暫停狀態。
   */
  togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  /**
   * 停止並清除內部計時排程。
   *
   * @returns {void}
   */
  stop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
