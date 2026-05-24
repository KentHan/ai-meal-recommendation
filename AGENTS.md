# AGENTS.md

## 專案概述

家庭早餐 / 洗澡選擇器。純靜態網站，部署到 GitHub Pages，由 Tailwind CDN + 原生 ES modules 組成，沒有 build step、沒有 test framework。

## 開發

- **不能用 `file://` 開啟**：ES modules 需要 http(s) 載入。本機開發請起 server：`python3 -m http.server 8000`，然後開 `http://localhost:8000/`。
- **驗證**：用 `/verify-frontend` skill 跑 Playwright 走查（記得把 navigate 目標改成 `http://localhost:8000/`，因為 skill 預設是 file://）。
- **不要引入測試框架** — 這個專案規模不需要，驗證走 `/verify-frontend` + 手動瀏覽。
- **Commit 訊息用英文。**

## 架構

- `index.html`：精簡進入頁，只放 toggle 容器、`#app` 容器、`<script type="module" src="app.js">`，加上各 feature 的 `<link>` stylesheet。
- `app.js`：載入 feature 清單、根據清單 render user toggle、頁面載入時把每個 feature mount 一次、用 `body[data-user]` 切換可見性。
- `shared/`：跨 feature 的東西。
  - `data.js` — `MEALS`、`USERS`、`SHOWER_PEOPLE`。
  - `audio.js` — `getAudioCtx()` 回傳 lazy 初始化、自動 resume 的共用 `AudioContext`。
  - `style.css` — body 樣式、字型 import、`.user-toggle` 樣式、跨 feature 可見性規則。
- `features/<id>/`：每個 feature 自包含。
  - `index.js` — default-export `{ id, label, emoji, mount(rootEl) }`。
  - `style.css` — feature 專屬 CSS，需要時用 `body[data-user="<id>"]` scope。

## Feature 介面契約

每個 feature 模組 default-export：

```js
export default {
    id: 'chris',          // 字串，等於 body[data-user] 的值
    label: 'Chris',       // toggle 按鈕文字
    emoji: '🧊',          // toggle 按鈕 emoji 前綴
    mount(rootEl) { ... } // 頁面載入時呼叫一次
};
```

`mount(rootEl)` 必須：
1. 把 feature 的 HTML 注入 `rootEl`（用 template string + `rootEl.innerHTML = TEMPLATE;`）。
2. 用 `rootEl.querySelector` 查內部元素 — **不要**用 `document.getElementById` 污染 global。
3. 用 `addEventListener` 綁事件 — template 裡**不要**寫 inline `onclick=`。
4. 初始化 feature state、跑必要的初次 render / draw。

`unmount()` 不需要 — 可見性是 CSS 切的，inactive feature 仍保留在 DOM 與記憶體中（這是刻意的設計，讓使用者切換時保留進度）。

## 加一個新 feature

1. 建 `features/<id>/`，內含 `index.js` 與 `style.css`（標準範例：`features/chris/`）。
2. 在 `app.js` 加 `import x from './features/<id>/index.js';`，並 push `x` 進 `features` 陣列。
3. 在 `index.html` 加 `<link rel="stylesheet" href="features/<id>/style.css">`。

只動這三處。不要把新 feature 的程式碼塞回 `index.html` inline 或散落在別處。

## 資產

- 頭像圖片（`chris.PNG`、`emma.JPG`、`lana.JPG`、`kent.jpeg`）與音效（`cat-meow.mp3`）都放 repo 根目錄，路徑相對 `index.html`。
