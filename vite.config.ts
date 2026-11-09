import { readFileSync } from 'node:fs'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

// https://vite.dev/config/
export default defineConfig({
  // 相對路徑：放在 GitHub Pages 子目錄（/TestPaper/）或任何靜態主機都能用
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  // 用 80 port，開發時直接打 http://localhost 就好，不用記埠號。
  // 80 被其他程式（例如 Docker 的 nginx）佔用時，會自動改用下一個可用的 port。
  server: {
    port: 80,
  },
  build: {
    rolldownOptions: {
      output: {
        // 套件拆成獨立檔案：發新版時只有 app 本身的檔案會變，
        // 老師的瀏覽器可以繼續用快取裡的 React、Konva、動畫套件
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 3 },
            { name: 'vendor-konva', test: /node_modules[\\/](konva|react-konva|react-reconciler|its-fine)[\\/]/, priority: 2 },
            { name: 'vendor-motion', test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
})
