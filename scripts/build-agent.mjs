import { build } from 'esbuild'

// Page-agent bundle (spec decision 23): a single IIFE injected into the recorded
// page via CDP (addScriptToEvaluateOnNewDocument + Runtime.evaluate). Built
// outside electron-vite because it targets the browser page, not main/renderer.
await build({
  entryPoints: ['src/agent/index.ts'],
  outfile: 'out/agent/page-agent.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
})
