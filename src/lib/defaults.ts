import type { IDocumentData, IWorkbookData } from "@univerjs/presets";

/**
 * 空白內容的初始快照。
 * Univer 會把 Partial 快照與內建預設值合併（worksheet 有
 * `mergeWorksheetSnapshotWithDefault`），所以這裡只給必要欄位。
 */
export const EMPTY_WORKBOOK: Partial<IWorkbookData> = {
  id: "univer-office-sheet",
  name: "未命名試算表",
  sheetOrder: ["sheet-1"],
  sheets: {
    "sheet-1": {
      id: "sheet-1",
      name: "工作表1",
      rowCount: 200,
      columnCount: 26
    }
  }
};

export const EMPTY_DOCUMENT: Partial<IDocumentData> = {
  id: "univer-office-doc",
  title: "未命名文檔",
  body: {
    dataStream: "開始輸入內容…\r\n"
  }
};
