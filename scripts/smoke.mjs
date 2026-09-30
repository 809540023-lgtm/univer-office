#!/usr/bin/env node
// 煙霧測試：用真實瀏覽器確認兩個編輯器真的渲染、輸入會自動存檔、嵌入模式正常。
//
// 為什麼需要：Univer 的編輯器是 canvas + worker 的重型元件，只看 tsc／vite build
// 成功無法保證畫面真的出來（例如 worker 若被當成 ESM 檔載入，而 Univer 內部用
// 傳統 Worker 建立，建置照樣成功，公式引擎卻會在瀏覽器裡壞掉）。
//
// 用法：
//   npm run preview          # 先開一個（另一個終端機）
//   npm run smoke            # 預設打 http://localhost:5178
//   npm run smoke -- http://localhost:5173
//
// 需要 playwright（未安裝時會提示指令，不算失敗）。
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("需要 playwright 才能跑煙霧測試：\n  npm i -D playwright && npx playwright install chromium");
  process.exit(0);
}

const base = (process.argv[2] || process.env.SMOKE_URL || "http://localhost:5178").replace(/\/+$/, "");
const failures = [];
const notes = [];

function check(name, ok, detail) {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? `　${detail}` : ""}`);
  if (!ok) failures.push(name);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 200)}`));

try {
  // ── 1. 試算表 ────────────────────────────────────────────────────────
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.waitForTimeout(9000);

  const canvases = await page.evaluate(() =>
    [...document.querySelectorAll(".host")[0].querySelectorAll("canvas")].map((c) => {
      const r = c.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
    })
  );
  const grid = [...canvases].sort((a, b) => b.w * b.h - a.w * a.h)[0];
  check("試算表渲染出畫布", canvases.length > 0, `${canvases.length} 個 canvas`);
  check("試算表主畫布有尺寸", !!grid && grid.w > 500 && grid.h > 300, grid ? `${grid.w}×${grid.h}` : "找不到");

  if (grid) {
    await page.mouse.click(grid.x + Math.round(grid.w * 0.35), grid.y + Math.round(grid.h * 0.25));
    await page.waitForTimeout(1000);
    await page.keyboard.type("12345");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);
  }
  const sheetSaved = await page.evaluate(() => {
    const raw = localStorage.getItem("univer-office:sheets");
    if (!raw) return false;
    return JSON.stringify(JSON.parse(raw).data?.sheets ?? {}).includes("12345");
  });
  check("試算表輸入後自動存檔到 localStorage", sheetSaved);

  // ── 2. 文檔 ──────────────────────────────────────────────────────────
  await page.click('button.tab:has-text("文檔")');
  await page.waitForTimeout(7000);
  const docsInfo = await page.evaluate(() => {
    const host = document.querySelectorAll(".host")[1];
    return { canvas: host.querySelectorAll("canvas").length, text: host.innerText || "" };
  });
  check("文檔渲染出畫布", docsInfo.canvas > 0, `${docsInfo.canvas} 個 canvas`);
  check("文檔介面為繁體中文", /正文|插入|字數/.test(docsInfo.text), docsInfo.text.replace(/\n/g, " ").slice(0, 50));

  await page.mouse.click(300, 260);
  await page.waitForTimeout(800);
  await page.keyboard.type("內部網站測試");
  await page.waitForTimeout(2500);
  const docSaved = await page.evaluate(() => {
    const raw = localStorage.getItem("univer-office:docs");
    if (!raw) return false;
    return String(JSON.parse(raw).data?.body?.dataStream ?? "").includes("內部網站測試");
  });
  check("文檔輸入後自動存檔到 localStorage", docSaved);

  // ── 3. 嵌入模式 ──────────────────────────────────────────────────────
  await page.goto(`${base}/?embed=1&mode=docs`, { waitUntil: "load" });
  await page.waitForTimeout(7000);
  const embed = await page.evaluate(() => ({
    brand: !!document.querySelector(".brand"),
    buttons: [...document.querySelectorAll(".actions button")].map((b) => b.textContent?.trim()),
    canvas: document.querySelectorAll(".host.on canvas").length
  }));
  check("embed=1 隱藏外層標題", embed.brand === false);
  check("embed=1 直接開在指定模式", embed.canvas > 0);
  notes.push(`embed 模式按鈕：${embed.buttons.join("、")}`);

  // ── 4. 主控台乾淨 ────────────────────────────────────────────────────
  check("瀏覽器主控台沒有錯誤", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" ｜ "));
} finally {
  await browser.close();
}

for (const n of notes) console.log(`ℹ️  ${n}`);
if (failures.length) {
  console.error(`\n❌ 失敗 ${failures.length} 項：${failures.join("、")}`);
  process.exit(1);
}
console.log("\n✅ 煙霧測試全部通過");
