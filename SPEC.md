# 驗光人員國考模擬測驗系統 — 程式規格書（SPEC）

- **專案名稱**：`optometry-mock-exam`
- **版本**：`1.0.0`
- **架構方案**：方案 A — 純靜態前端網站（GitHub Pages 部署，非同步 `fetch` 載入 JSON）
- **資料範圍**：考選部民國 106–115 年驗光人員國家考試歷屆試題（驗光師 4,000 題／5 科、驗光生 3,000 題／4 科，共 7,000 題、140 個場次科目）

---

## 1. 系統目標與技術堆疊

| 層級 | 技術選型 | 選型理由 |
| --- | --- | --- |
| 資料前處理 | Python 3（標準函式庫 `csv`、`json`、`re`） | 零第三方相依，可重複執行將最新年度 CSV 轉為標準化 JSON |
| 介面與樣式 | HTML5 + CSS3（CSS Variables、Grid/Flexbox） | 輕量、支援桌機／手機響應式排版與列印成績單樣式 |
| 前端邏輯 | 原生 ES6 Modules（Vanilla JavaScript） | 免打包編譯、直接推送至 GitHub Pages 即可上線，模組職責清晰 |
| 本機持久化 | Browser `localStorage` + JSON 匯出／匯入 | 無須後端資料庫即可保存錯題本與歷史成績，並支援跨裝置手動備份 |

---

## 2. 專案目錄與模組職責劃分

```text
optometry-mock-exam/
├── .nojekyll                   # 停用 GitHub Pages Jekyll 處理，確保靜態檔直出
├── README.md                   # 部署與使用說明文件
├── SPEC.md                     # 本文件：系統架構與資料規格書
├── index.html                  # 單頁應用（SPA）HTML 骨架與五組視圖容器
├── css/
│   └── styles.css              # 全域設計系統、題卡、導覽格、響應式與列印樣式
├── scripts/
│   └── build_dataset.py        # 離線資料建置腳本（CSV → JSON）
├── data/
│   ├── metadata.json           # 系統場次總覽、年度／科目索引與 PDF 連結
│   ├── optometrist.json        # 驗光師題庫（4,000 題）
│   └── assistant.json          # 驗光生題庫（3,000 題）
└── js/
    ├── config.js               # 全域常數（檔案路徑、考試時間、模式列舉、儲存鍵名）
    ├── dataLoader.js           # 非同步 fetch 與記憶體快取管理（按類別按需載入）
    ├── storageService.js       # localStorage 封裝、錯題本、歷史紀錄與 JSON 備份驗證
    ├── scorer.js               # 國考評分引擎（單選、複數正解、一律給分與分科統計）
    ├── timer.js                # 倒數／正數計時器類別（暫停、歸零自動交卷回呼）
    ├── examEngine.js           # 組卷演算法（原卷／隨機／錯題）與 ExamSession 狀態管理
    ├── searchEngine.js         # 全文多詞彙檢索、條件過濾與 HTML 安全高亮
    ├── app.js                  # 主控入口（生命週期協調、視圖切換與事件串接）
    └── views/
        ├── setupView.js        # 首頁測驗設定（類別、作答模式、三種組卷分頁）
        ├── examView.js         # 作答主介面、即時解析、原卷 PDF 與鍵盤快捷鍵
        ├── resultView.js       # 交卷成績單、分科正確率與逐題篩選檢討
        ├── searchView.js       # 題庫關鍵字搜尋、分頁瀏覽與搜尋結果練習
        └── historyView.js      # 歷史成績、錯題本管理與 JSON 備份匯出／匯入介面
```

---

## 3. 資料結構規格（Data Schema）

### 3.1 題目物件結構（`data/optometrist.json`、`data/assistant.json`）

兩份題庫檔皆為 JSON 陣列，每筆元素結構如下：

```json
{
  "id": "optometrist_115100_眼球解剖生理學與倫理法規_01_1",
  "categoryKey": "optometrist",
  "categoryLabel": "驗光師",
  "year": 115,
  "sessionCode": "115100",
  "sessionName": "115年第二次專門職業及技術人員高等考試...",
  "subject": "眼球解剖生理學與倫理法規",
  "number": 1,
  "question": "小樑網（trabecular meshwork）是由下列何種胚胎層發育而來？...",
  "options": {
    "A": "僅①",
    "B": "僅①②",
    "C": "僅①②③",
    "D": "①②③④"
  },
  "answers": ["C"],
  "rawAnswer": "C",
  "note": "",
  "hasImage": false,
  "pdfUrl": "https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=Q&code=115100&c=109&s=0901&q=1"
}
```

- **`answers` 正規化規則**：
  - 單選正解：`["A"]`、`["B"]`、`["C"]` 或 `["D"]`
  - 考選部複數給分（如 `B/D`、`A/B/C`）：`["B", "D"]`、`["A", "B", "C"]`
  - 考選部一律給分：`["ALL"]`
- **`hasImage` 判定規則**：原始 `備註` 含「含圖」字樣，或任一選項（A–D）文字為空字串時標記為 `true`。

### 3.2 詮釋資料結構（`data/metadata.json`）

```json
{
  "schemaVersion": "1.0.0",
  "source": "考選部考畢試題查詢平臺（民國 106–115 年驗光人員歷屆試題）",
  "totalQuestions": 7000,
  "categories": {
    "optometrist": {
      "key": "optometrist",
      "label": "驗光師",
      "dataFile": "data/optometrist.json",
      "totalQuestions": 4000,
      "years": [115, 114, 113, 112, 111, 110, 109, 108, 107, 106],
      "subjects": ["低視力學", "眼球解剖生理學與倫理法規", "視光學", "視覺光學", "隱形眼鏡學與配鏡學"]
    },
    "assistant": {
      "key": "assistant",
      "label": "驗光生",
      "dataFile": "data/assistant.json",
      "totalQuestions": 3000,
      "years": [115, 114, 113, 112, 111, 110, 109, 108, 107, 106],
      "subjects": ["眼球構造與倫理法規概要", "眼鏡光學概要", "隱形眼鏡學概要", "驗光學概要"]
    }
  },
  "sessions": [ /* 140 筆場次科目紀錄 */ ]
}
```

### 3.3 本機儲存與 JSON 備份結構

- **`localStorage` 鍵名**：
  - `optometry_exam_wrong_book_v1`：以題目 `id` 為鍵的錯題紀錄字典 `{ questionId, categoryKey, wrongCount, lastWrongAt }`。
  - `optometry_exam_history_v1`：歷史測驗成績陣列（最多保留 100 筆）。
- **JSON 備份檔案格式**：

```json
{
  "app": "optometry-mock-exam",
  "schemaVersion": "1.0.0",
  "exportedAt": "2026-11-20T02:00:00.000Z",
  "wrongBook": {},
  "history": []
}
```

---

## 4. 核心功能與業務邏輯規格

### 4.1 雙軌作答模式
1. **模擬考模式（`mock`）**：
   - 啟動 60 分鐘（3,600 秒）倒數計時器；剩餘 ≤ 5 分鐘轉紅字警示；歸零時自動交卷。
   - 作答過程不顯示對錯與答案，交卷後統一送交 `scorer.js` 評分並產出成績報告。
2. **刷題練習模式（`practice`）**：
   - 改採正數經過時間計時，無自動交卷限制。
   - 選擇選項後立即於題目下方顯示對錯狀態、標準答案與考選部更正備註；右側題號導覽格同步以綠／紅色標示。

### 4.2 國考特殊評分判定（`scorer.js`）
- 若 `question.answers` 包含 `"ALL"`：無論使用者是否作答皆判定 `isCorrect = true`。
- 一般單選與複數正解題：使用者選項命中 `question.answers` 任一元素即判定 `isCorrect = true`。
- 總分計算：`(答對題數 / 總題數) × 100`，四捨五入至小數點後一位。

### 4.3 含圖題與原卷 PDF 支援
- 若題目 `hasImage === true`，介面自動顯示「含圖題」醒目標籤。
- 所有題目均於題頭提供「查看原卷 PDF」按鈕，開新分頁直連考選部原卷 PDF。
- 若選項文字為空（原卷為圖片選項），改顯示提示文字引導開啟原卷 PDF 對照。

### 4.4 題庫關鍵字搜尋（`searchEngine.js` / `searchView.js`）
- 支援以空白分隔多個關鍵字（採 AND 交集邏輯），搜尋範圍涵蓋題幹、A–D 選項、科目與考選部備註。
- 支援類別、年度、科目與「僅顯示含圖或更正備註」複合篩選。
- 支援關鍵字安全轉義高亮顯示（防 XSS），並可一鍵將搜尋結果（最多 50 題）直接轉為刷題練習卷。

### 4.5 鍵盤快捷鍵（作答頁專用）
- `1` / `2` / `3` / `4`：分別對應選擇 A / B / C / D 選項。
- `←` / `→`：切換上一題／下一題。
- `F`：切換本題待確認標記狀態。

---

## 5. 維護與未來年度題庫擴充流程

1. 將考選部最新年度彙整後之 3 份 CSV（場次總覽、驗光師題庫、驗光生題庫）置於專案根目錄。
2. 執行指令重新建置靜態題庫：
   ```bash
   python3 scripts/build_dataset.py
   ```
3. 確認 `data/metadata.json`、`data/optometrist.json`、`data/assistant.json` 更新無誤後，提交（commit）並推送至 GitHub 即可完成網站題庫更新。
