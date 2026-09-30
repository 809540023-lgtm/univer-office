import type { Mode } from "./types";

const PREFIX = "univer-office:";

export interface StoredPayload {
  version: 1;
  mode: Mode;
  updatedAt: string;
  data: unknown;
}

function keyFor(mode: Mode) {
  return `${PREFIX}${mode}`;
}

export function saveLocal(mode: Mode, data: unknown): string {
  const payload: StoredPayload = { version: 1, mode, updatedAt: new Date().toISOString(), data };
  try {
    localStorage.setItem(keyFor(mode), JSON.stringify(payload));
  } catch (error) {
    console.warn("[univer-office] 本機自動存檔失敗（可能超出容量）", error);
  }
  return payload.updatedAt;
}

export function loadLocal(mode: Mode): StoredPayload | null {
  try {
    const raw = localStorage.getItem(keyFor(mode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload;
    if (!parsed || parsed.version !== 1 || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocal(mode?: Mode) {
  try {
    if (mode) localStorage.removeItem(keyFor(mode));
    else for (const m of ["sheets", "docs"] as Mode[]) localStorage.removeItem(keyFor(m));
  } catch (error) {
    console.warn("[univer-office] 清除本機存檔失敗", error);
  }
}
