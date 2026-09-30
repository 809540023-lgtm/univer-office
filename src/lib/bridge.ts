import { isHostMessage, type HostMessage, type IframeMessage } from "./types";

/**
 * 與宿主頁面（parent window）通訊。
 *
 * 安全取捨：postMessage 的 targetOrigin 應由宿主指定，但宿主網址是嵌入方决定的，
 * 因此預設用 `*`，並在接收端檢查訊息是否來自 parent。
 * 想在宿主端收緊，可在 iframe URL 帶 `?parentOrigin=https://your-site`。
 */
const params = new URLSearchParams(window.location.search);
export const PARENT_ORIGIN = params.get("parentOrigin") || "*";

export function postToHost(message: IframeMessage) {
  if (window.parent === window) return;
  try {
    window.parent.postMessage(message, PARENT_ORIGIN);
  } catch (error) {
    console.warn("[univer-office] postMessage 失敗", error);
  }
}

export function onHostMessage(handler: (message: HostMessage) => void): () => void {
  const listener = (event: MessageEvent) => {
    if (window.parent !== window && event.source !== window.parent) return;
    if (!isHostMessage(event.data)) return;
    handler(event.data);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
