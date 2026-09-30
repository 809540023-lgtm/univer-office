import { createRoot } from "react-dom/client";
import App from "./App";

// 不使用 StrictMode：Univer 的編輯器是重量級有狀態實例，
// StrictMode 在開發模式下會重複掛載 effect 而建立兩份實例。
createRoot(document.getElementById("root")!).render(<App />);
