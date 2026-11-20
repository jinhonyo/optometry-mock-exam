# 驗光人員國考模擬測驗系統

收錄民國 106–115 年考選部驗光人員國家考試歷屆試題（驗光師 4,000 題、驗光生 3,000 題，共 7,000 題），採純靜態模組化前端架構，可直接部署於 GitHub Pages。

## 主要功能

- **三種組卷方式**：歷屆原卷模擬、自訂隨機刷題（可排除含圖題）、錯題本集中複習
- **雙作答模式**：模擬考模式（60 分鐘倒數計時）與刷題練習模式（即時對答案與備註）
- **考選部規則相容**：支援「一律給分」、複數給分（如 `A/D`、`A/B/C`）、含圖題標記與原卷 PDF 連結
- **題庫關鍵字搜尋**：多詞彙全文檢索、關鍵字高亮、直接以搜尋結果練習
- **本機紀錄與備份**：自動紀錄錯題本與歷史成績，支援 JSON 備份匯出與合併／覆蓋匯入

## 部署至 GitHub Pages

1. 在 GitHub 建立新的 Repository（例如 `optometry-mock-exam`）。
2. 將本專案解壓縮後的所有檔案推送至 `main` 分支：
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Optometry mock exam system"
   git branch -M main
   git remote add origin https://github.com/<你的帳號>/optometry-mock-exam.git
   git push -u origin main
   ```
3. 前往 GitHub Repository 的 **Settings → Pages**，將 **Source** 設為 `Deploy from a branch`，分支選擇 `main`、目錄選擇 `/ (root)`，點擊 **Save**。
4. 等待約 1–2 分鐘後即可透過 `https://<你的帳號>.github.io/optometry-mock-exam/` 存取網站。

## 本機開發預覽

因採用 ES Modules 與 `fetch` 載入 JSON，本機測試請啟動簡易 HTTP 伺服器：

```bash
python3 -m http.server 8000
```

接著於瀏覽器開啟 `http://localhost:8000`。

詳細架構與資料格式請參閱 `SPEC.md`。
