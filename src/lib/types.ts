export type Mode = "sheets" | "docs";

export const MODES: Mode[] = ["sheets", "docs"];

export const MODE_LABEL: Record<Mode, string> = {
  sheets: "試算表",
  docs: "文檔"
};

/** iframe 內（編輯器）→ 外層（宿主頁面） */
export type IframeMessage =
  | { source: "univer-office"; type: "ready"; mode: Mode }
  | { source: "univer-office"; type: "changed"; mode: Mode }
  | { source: "univer-office"; type: "data"; mode: Mode; requestId?: string; data: unknown }
  | { source: "univer-office"; type: "saved"; mode: Mode; data: unknown }
  | { source: "univer-office"; type: "mode"; mode: Mode }
  | { source: "univer-office"; type: "error"; message: string };

/** 外層（宿主頁面）→ iframe（編輯器） */
export type HostMessage =
  | { type: "getData"; mode?: Mode; requestId?: string }
  | { type: "setData"; mode?: Mode; data: unknown }
  | { type: "setMode"; mode: Mode }
  | { type: "ping" };

export const MESSAGE_SOURCE = "univer-office";

export function isHostMessage(value: unknown): value is HostMessage {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return type === "getData" || type === "setData" || type === "setMode" || type === "ping";
}

export function isMode(value: unknown): value is Mode {
  return value === "sheets" || value === "docs";
}
