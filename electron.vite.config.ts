import { resolve } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

/**
 * electron-vite 5 config: three build targets sharing src/shared.
 * Why: single-package layout (spec decision 16) — main/preload/renderer resolved
 * by electron-vite convention; called by `pnpm dev|build|start`.
 */
export default defineConfig({
  main: {
    resolve: {
      alias: { '@shared': resolve(__dirname, 'src/shared') },
    },
  },
  preload: {
    resolve: {
      alias: { '@shared': resolve(__dirname, 'src/shared') },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  },
})
