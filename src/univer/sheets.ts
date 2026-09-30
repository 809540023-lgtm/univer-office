import { createUniver, LocaleType, mergeLocales, type IWorkbookData } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreZhTW from "@univerjs/preset-sheets-core/locales/zh-TW";
// 注意：必須用 `?worker&url`（讓 Vite 打包成傳統 worker），
// 直接用 `?url` 會拿到含 import 的 ESM 檔，而 Univer 內部是
// `new Worker(workerURL)`（傳統 worker）→ 會出現
// "Cannot use import statement outside a module"，公式引擎失效。
import sheetsWorkerURL from "@univerjs/preset-sheets-core/worker?worker&url";
import "@univerjs/design/lib/index.css";
import "@univerjs/preset-sheets-core/lib/index.css";
import { EMPTY_WORKBOOK } from "../lib/defaults";

export interface SheetsInstance {
  /** 目前的試算表快照（可直接存成 JSON） */
  getData(): IWorkbookData | null;
  /** 以快照取代目前內容（會先卸載舊的 workbook） */
  setData(data: Partial<IWorkbookData>): void;
  /** 內容被改動時回呼（以快照比對判斷，非每個指令都算） */
  onChanged(callback: () => void): () => void;
  dispose(): void;
}

export function createSheetsInstance(container: HTMLElement, initial?: Partial<IWorkbookData>): SheetsInstance {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.ZH_TW,
    locales: { [LocaleType.ZH_TW]: mergeLocales(UniverPresetSheetsCoreZhTW) },
    presets: [UniverSheetsCorePreset({ container, workerURL: sheetsWorkerURL })]
  });

  const start = initial ?? EMPTY_WORKBOOK;
  let currentId = start.id ?? EMPTY_WORKBOOK.id!;
  univerAPI.createWorkbook({ ...start, id: currentId });

  function getData(): IWorkbookData | null {
    return univerAPI.getActiveWorkbook()?.save() ?? null;
  }

  function setData(data: Partial<IWorkbookData>) {
    const next = { ...data };
    // 先卸載目前的 workbook，再以新快照建立（Univer 沒有單一 workbook 的 load API）
    try {
      univerAPI.disposeUnit(currentId);
    } catch (error) {
      console.warn("[univer-office] 卸載原有 workbook 失敗，改用新 id 建立", error);
      next.id = `${currentId}-${Date.now()}`;
    }
    currentId = next.id ?? `${EMPTY_WORKBOOK.id}-${Date.now()}`;
    univerAPI.createWorkbook({ ...next, id: currentId });
  }

  function onChanged(callback: () => void): () => void {
    let signature = safeSignature(getData);
    let timer: number | undefined;
    const disposable = univerAPI.addEvent(univerAPI.Event.CommandExecuted, () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const next = safeSignature(getData);
        if (next !== signature) {
          signature = next;
          callback();
        }
      }, 500);
    });
    return () => {
      window.clearTimeout(timer);
      disposable.dispose();
    };
  }

  return {
    getData,
    setData,
    onChanged,
    dispose: () => univer.dispose()
  };
}

/** 取快照指紋（長度 + 簡易雜湊），避免昂貴的字串比對。 */
function safeSignature(getData: () => IWorkbookData | null): string {
  try {
    const json = JSON.stringify(getData() ?? {});
    let hash = 0;
    for (let i = 0; i < json.length; i += 1) {
      hash = (hash * 31 + json.charCodeAt(i)) | 0;
    }
    return `${json.length}:${hash}`;
  } catch {
    return "unknown";
  }
}
