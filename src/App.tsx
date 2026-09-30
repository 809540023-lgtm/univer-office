import { useCallback, useEffect, useRef, useState } from "react";
import { loadLocal, saveLocal, clearLocal } from "./lib/storage";
import { onHostMessage, postToHost } from "./lib/bridge";
import { MODES, MODE_LABEL, isMode, type Mode } from "./lib/types";
import { createSheetsInstance, type SheetsInstance } from "./univer/sheets";
import { createDocsInstance, type DocsInstance } from "./univer/docs";
import "./app.css";

type Instance = SheetsInstance | DocsInstance;

const params = new URLSearchParams(window.location.search);
const EMBED = params.get("embed") === "1" || params.get("embed") === "true";

/** 讀取網址帶入的初始資料（`?data=<base64 JSON>`）。 */
function readUrlData(): { mode?: Mode; data?: unknown } | null {
  const raw = params.get("data");
  if (!raw) return null;
  try {
    const json = decodeURIComponent(escape(window.atob(raw)));
    return {
      mode: isMode(params.get("mode")) ? (params.get("mode") as Mode) : undefined,
      data: JSON.parse(json)
    };
  } catch (error) {
    console.warn("[univer-office] 無法解析 ?data= 內容", error);
    return null;
  }
}

// 網址參數在頁面生命週期內不變，於模組層解析一次即可（避免在 render 期間讀 ref）
const URL_DATA = readUrlData();
const INITIAL_MODE: Mode = URL_DATA?.mode ?? (isMode(params.get("mode")) ? (params.get("mode") as Mode) : "sheets");

export default function App() {
  const [mode, setMode] = useState<Mode>(INITIAL_MODE);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("準備中…");
  const [readyModes, setReadyModes] = useState<Mode[]>([]);

  const sheetsHost = useRef<HTMLDivElement | null>(null);
  const docsHost = useRef<HTMLDivElement | null>(null);
  const instances = useRef<Partial<Record<Mode, Instance>>>({});
  const fileInput = useRef<HTMLInputElement | null>(null);

  const getInstance = useCallback((target: Mode): Instance | null => instances.current[target] ?? null, []);

  /** 要載入的內容：網址參數 > 本機自動存檔 > 空白（Univer 預設值）。 */
  const initialFor = useCallback((target: Mode): unknown => {
    const urlPayload = URL_DATA?.data;
    if (urlPayload && typeof urlPayload === "object") {
      const typed = urlPayload as Record<string, unknown>;
      if (target in typed) return typed[target];
      if (URL_DATA?.mode === target) return urlPayload;
    }
    return loadLocal(target)?.data;
  }, []);

  // 建立編輯器（第一次切到該模式時才建立，避免在隱藏容器內初始化）
  useEffect(() => {
    if (instances.current[mode]) return;
    const host = mode === "sheets" ? sheetsHost.current : docsHost.current;
    if (!host) return;

    const initial = initialFor(mode);
    try {
      const instance =
        mode === "sheets"
          ? createSheetsInstance(host, initial as never)
          : createDocsInstance(host, initial as never);
      instances.current[mode] = instance;
      // 這裡的 setState 是為了與外部系統（Univer 實例）同步：實例建立完成後
      // 才能啟用工具列按鈕並顯示狀態，屬 effect 的正当用途。
      // oxlint-disable-next-line react/set-state-in-effect
      setReadyModes((prev) => (prev.includes(mode) ? prev : [...prev, mode]));
      // oxlint-disable-next-line react/set-state-in-effect
      setStatus(initial ? "已載入上次的內容" : "已建立空白內容");

      return instance.onChanged(() => {
        setDirty(true);
        const at = saveLocal(mode, instance.getData());
        setStatus(`已自動存檔（本機）${new Date(at).toLocaleTimeString()}`);
        postToHost({ source: "univer-office", type: "changed", mode });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[univer-office] 建立編輯器失敗", error);
      setStatus(`建立失敗：${message}`);
      postToHost({ source: "univer-office", type: "error", message });
    }
  }, [mode, initialFor]);

  useEffect(() => {
    return onHostMessage((message) => {
      if (message.type === "ping") return;

      if (message.type === "setMode") {
        setMode(message.mode);
        return;
      }

      const target: Mode = message.mode ?? mode;
      const instance = getInstance(target);
      if (!instance) {
        postToHost({ source: "univer-office", type: "error", message: `編輯器尚未載入（${target}）` });
        return;
      }

      if (message.type === "setData") {
        instance.setData(message.data as never);
        setDirty(true);
        saveLocal(target, instance.getData());
        setStatus("已由外層載入內容");
        return;
      }
      if (message.type === "getData") {
        postToHost({
          source: "univer-office",
          type: "data",
          mode: target,
          requestId: message.requestId,
          data: instance.getData()
        });
      }
    });
  }, [mode, getInstance]);

  // 通知外層已就緒
  useEffect(() => {
    if (readyModes.includes(mode)) postToHost({ source: "univer-office", type: "ready", mode });
  }, [readyModes, mode]);

  const isReady = readyModes.includes(mode);

  const handleSave = useCallback(() => {
    const instance = getInstance(mode);
    if (!instance) return;
    const data = instance.getData();
    const at = saveLocal(mode, data);
    setDirty(false);
    setStatus(`已儲存（本機）${new Date(at).toLocaleTimeString()}`);
    postToHost({ source: "univer-office", type: "saved", mode, data });
  }, [getInstance, mode]);

  const handleDownload = useCallback(() => {
    const instance = getInstance(mode);
    if (!instance) return;
    const blob = new Blob([JSON.stringify(instance.getData(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${mode === "sheets" ? "sheet" : "document"}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setDirty(false);
    setStatus("已下載 JSON");
  }, [getInstance, mode]);

  const handleCopy = useCallback(async () => {
    const instance = getInstance(mode);
    if (!instance) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(instance.getData()));
      setStatus("已複製 JSON 到剪貼簿");
    } catch {
      setStatus("複製失敗（瀏覽器未授權剪貼簿）");
    }
  }, [getInstance, mode]);

  const handleUpload = useCallback(
    async (file: File) => {
      const instance = getInstance(mode);
      if (!instance) return;
      try {
        instance.setData(JSON.parse(await file.text()) as never);
        saveLocal(mode, instance.getData());
        setDirty(true);
        setStatus(`已載入 ${file.name}`);
      } catch (error) {
        setStatus(`載入失敗：${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [getInstance, mode]
  );

  const handleClear = useCallback(() => {
    clearLocal(mode);
    setStatus("已清除本機自動存檔（目前畫面內容不變）");
  }, [mode]);

  // Ctrl/Cmd + S 儲存
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  // 有未下載的變更時提醒
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return (
    <div className={`app${EMBED ? " embed" : ""}`}>
      <header className="bar">
        {!EMBED && <span className="brand">Univer Office</span>}

        <div className="tabs">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={m === mode ? "tab on" : "tab"}
              onClick={() => setMode(m)}
              title={`切換到${MODE_LABEL[m]}`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="actions">
          <button type="button" className="btn primary" onClick={handleSave} disabled={!isReady}>
            儲存{dirty ? " •" : ""}
          </button>
          <button type="button" className="btn" onClick={handleDownload} disabled={!isReady}>
            下載 JSON
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()} disabled={!isReady}>
            載入 JSON
          </button>
          {!EMBED && (
            <>
              <button type="button" className="btn" onClick={handleCopy} disabled={!isReady}>
                複製 JSON
              </button>
              <button type="button" className="btn" onClick={handleClear}>
                清除本機存檔
              </button>
            </>
          )}
        </div>

        <span className="status" role="status">
          {status}
        </span>
      </header>

      <main className="editors">
        <div ref={sheetsHost} className={`host${mode === "sheets" ? " on" : ""}`} />
        <div ref={docsHost} className={`host${mode === "docs" ? " on" : ""}`} />
      </main>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleUpload(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
