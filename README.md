# univer-office

內部網站用的**試算表／文檔編輯器**，以 [Univer](https://github.com/dream-num/univer) Office SDK（Apache-2.0）為引擎。
可獨立開啟，也可用 **iframe 嵌入**任何現有內部網站，透過 `postMessage` 收送內容。

- 兩種編輯器：**試算表**（公式、格式、多工作表）與**文檔**（富文字、段落樣式）
- 介面與內建工具列都是**繁體中文**
- 內容會**自動存檔到瀏覽器 localStorage**（重整不會不見），並可下載／載入 JSON
- 外層網站可即時取得或寫入內容（`getData` / `setData` / `setMode`）

## 快速開始

```bash
npm install
npm run dev        # http://localhost:5178
```

建置與部署（純靜態，`dist/` 丟到任何靜態空間即可）：

```bash
npm run build
npm run preview    # 用 dist 起本機伺服器驗證
```

## 用法一：獨立開啟

直接開 `https://<你的網址>/`，左上角切換「試算表／文檔」，工具列可儲存、下載 JSON、載入 JSON。

### 網址參數

| 參數 | 說明 | 範例 |
|---|---|---|
| `mode` | 一開始要開哪個編輯器：`sheets`（預設）或 `docs` | `?mode=docs` |
| `embed` | `1` 時隱藏外層標題與次要按鈕，只留編輯器與必要操作（嵌入用） | `?embed=1` |
| `parentOrigin` | 指定只把訊息發給這個來源（預設 `*`） | `?parentOrigin=https://intranet.example` |
| `data` | 以 base64 帶入初始內容（僅適合小資料，大資料請用 `setData`） | `?data=JTdCJTdE` |

## 用法二：嵌入既有內部網站（iframe）

```html
<iframe
  id="office"
  src="https://univer-office.example/?embed=1&mode=sheets&parentOrigin=https%3A%2F%2Fintranet.example"
  style="width:100%;height:640px;border:0"
></iframe>

<script>
  const iframe = document.getElementById('office');

  // 1) 要求編輯器把目前內容送回來
  function getData(mode) {
    const requestId = crypto.randomUUID();
    iframe.contentWindow.postMessage({ type: 'getData', mode, requestId }, '*');
  }

  // 2) 把後端存的內容寫進編輯器
  function setData(mode, snapshot) {
    iframe.contentWindow.postMessage({ type: 'setData', mode, data: snapshot }, '*');
  }

  // 3) 接收編輯器送來的訊息
  window.addEventListener('message', (event) => {
    if (event.source !== iframe.contentWindow) return;
    const msg = event.data;
    if (!msg || msg.source !== 'univer-office') return;

    switch (msg.type) {
      case 'ready':   /* 編輯器就緒 */ break;
      case 'changed': /* 內容有變動，可提示「記得儲存」 */ break;
      case 'data':    /* msg.data 就是快照，可 POST 到後端 */ break;
      case 'saved':   /* 使用者按下儲存，msg.data 是快照 */ break;
      case 'error':   console.warn(msg.message); break;
    }
  });
</script>
```

完整可操作的範例：`examples/embed.html`（開兩個終端機，一個 `npm run dev`、一個開這個檔並用 `?src=` 指向你的網址）。

### 訊息格式

**外層 → 編輯器**

| 訊息 | 說明 |
|---|---|
| `{ type: 'getData', mode?, requestId? }` | 要求快照，回來時會帶同一個 `requestId` |
| `{ type: 'setData', mode?, data }` | 用快照取代目前內容（取代前請自行確認使用者沒有未存的變更） |
| `{ type: 'setMode', mode }` | 切換試算表／文檔 |
| `{ type: 'ping' }` | 連線測試 |

`mode` 省略時，以編輯器目前顯示的模式為準。

**編輯器 → 外層**（都帶 `source: 'univer-office'` 供辨識）

| 訊息 | 說明 |
|---|---|
| `{ type: 'ready', mode }` | 該模式的編輯器已載入完成 |
| `{ type: 'changed', mode }` | 內容有變動（已自動存到 localStorage） |
| `{ type: 'data', mode, data, requestId? }` | 回覆 `getData` |
| `{ type: 'saved', mode, data }` | 使用者按下「儲存」 |
| `{ type: 'error', message }` | 例如要求尚未載入模式的資料 |

### 資料格式

`data` 就是 Univer 的快照（snapshot）JSON：

- 試算表：`FWorkbook.save()` 的結果 —— `{ id, name, sheetOrder, sheets: { ... }, styles, ... }`
- 文檔：`FDocument.getDocumentDataModel().getSnapshot()` 的結果 —— `{ id, title, body: { dataStream }, documentStyle, ... }`

要長期保存請把這個 JSON 存到你的資料庫（本工具**不含後端**，見下方限制）。

## 專案結構

```
src/
  App.tsx              外殼：模式切換、工具列、postMessage 橋接、自動存檔
  app.css              外殼樣式（編輯器本身的樣式由 Univer 提供）
  lib/
    types.ts           iframe ↔ 外層的訊息型別與判斷
    bridge.ts          postMessage 收送（含 parentOrigin 收緊）
    storage.ts         localStorage 自動存檔
    defaults.ts        空白試算表／文檔快照
  univer/
    sheets.ts          建立試算表實例（zh-TW、worker、載入／儲存）
    docs.ts            建立文檔實例（zh-TW、載入／儲存）
scripts/smoke.mjs      真實瀏覽器煙霧測試
examples/embed.html    嵌入與 postMessage 範例
```

## 開發指令

| 指令 | 說明 |
|---|---|
| `npm run dev` | 開發伺服器（5178） |
| `npm run build` | 型別檢查 + 建置到 `dist/` |
| `npm run preview` | 用 `dist/` 起本機伺服器 |
| `npm run lint` | oxlint |
| `npm run smoke` | 煙霧測試（需先 `npm run preview`） |

煙霧測試會用真實瀏覽器確認：兩個編輯器畫布真的渲染、輸入後會自動存檔、`embed=1` 正常、**主控台沒有錯誤**。
這不是多餘的 —— 開發時就踩過一次：worker 用 Vite 的 `?url` 匯入會拿到含 `import` 的 ESM 檔，
而 Univer 內部是 `new Worker(url)`（傳統 worker），建置照樣成功，但公式引擎在瀏覽器裡直接壞掉
（`Cannot use import statement outside a module`）。正確寫法是 `?worker&url`（見 `src/univer/sheets.ts`）。

## 已知限制

- **沒有後端儲存**：內容只存在瀏覽器的 localStorage（同一台電腦、同一個瀏覽器）。要多人共用或永久保存，
  請用 `getData` 取快照存進你的資料庫，並用 `setData` 載入。
- **沒有協作／權限**：單人編輯，沒有登入、沒有同時編輯、沒有版本歷史。放在內部網站時請自行加權限控管。
- **localStorage 容量**：一般瀏覽器上限約 5 MB，過大的表格會存不進去（主控台會警告）。
- **建置體積**：未做程式碼分割時主 chunk 約 6.5 MB（gzip 約 1.7 MB），因為一次載入兩種編輯器；
  在意載入速度可改成依模式動態 `import()`。
- **`?data=` 只適合小資料**：內容放在網址上有長度限制與外洩風險（會留在瀏覽器歷史、proxy log）。
- Univer 套件為 **Apache-2.0**，可商用；本專案自身授權由使用者決定（目前未附 LICENSE）。
