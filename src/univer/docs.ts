import { createUniver, LocaleType, mergeLocales, type IDocumentData } from "@univerjs/presets";
import { UniverDocsCorePreset } from "@univerjs/preset-docs-core";
import UniverPresetDocsCoreZhTW from "@univerjs/preset-docs-core/locales/zh-TW";
import "@univerjs/design/lib/index.css";
import "@univerjs/preset-docs-core/lib/index.css";
import { EMPTY_DOCUMENT } from "../lib/defaults";

export interface DocsInstance {
  /** 目前的文檔快照（可直接存成 JSON） */
  getData(): IDocumentData | null;
  /** 以快照取代目前內容（會先卸載舊文檔） */
  setData(data: Partial<IDocumentData>): void;
  onChanged(callback: () => void): () => void;
  dispose(): void;
}

export function createDocsInstance(container: HTMLElement, initial?: Partial<IDocumentData>): DocsInstance {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.ZH_TW,
    locales: { [LocaleType.ZH_TW]: mergeLocales(UniverPresetDocsCoreZhTW) },
    presets: [UniverDocsCorePreset({ container })]
  });

  const start = initial ?? EMPTY_DOCUMENT;
  let currentId = start.id ?? EMPTY_DOCUMENT.id!;
  univerAPI.createDocument({ ...start, id: currentId });

  function getData(): IDocumentData | null {
    const doc = univerAPI.getActiveDocument();
    if (!doc) return null;
    return doc.getDocumentDataModel().getSnapshot();
  }

  function setData(data: Partial<IDocumentData>) {
    const next = { ...data };
    try {
      univerAPI.disposeUnit(currentId);
    } catch (error) {
      console.warn("[univer-office] 卸載原有文檔失敗，改用新 id 建立", error);
      next.id = `${currentId}-${Date.now()}`;
    }
    currentId = next.id ?? `${EMPTY_DOCUMENT.id}-${Date.now()}`;
    univerAPI.createDocument({ ...next, id: currentId });
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

function safeSignature(getData: () => IDocumentData | null): string {
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
