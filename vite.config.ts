import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 這份設定同時服務兩種用法：
// 1. 獨立開啟（正式建置後可放任何靜態空間）
// 2. 用 iframe 嵌入其他內部網站
// 因此 base 用相對路徑 './'，並在 dev 時允許外部網域連入（嵌入測試用）。
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5178,
    host: true
  },
  preview: {
    port: 5178,
    host: true
  },
  build: {
    // Univer 的 worker 與各 plugin 會產生較大的 chunk，這裡只調高警告門檻
    chunkSizeWarningLimit: 4000
  }
});

