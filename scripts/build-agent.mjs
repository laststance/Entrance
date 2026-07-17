import { build } from 'esbuild'

// Injected-code bundles (spec decision 23): everything that runs inside a
// target page is built here, outside electron-vite, because it targets the
// browser page, not main/renderer. Two artifacts:
//  - page-agent.js     record-mode agent (rrweb + input lane + ready binding)
//  - redebug-shims.js  Mode B determinism shims (clock/random pin, storage seed)
const shared = {
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
}

await build({
  ...shared,
  entryPoints: ['src/agent/index.ts'],
  outfile: 'out/agent/page-agent.js',
})

await build({
  ...shared,
  entryPoints: ['src/agent/redebug-shims.ts'],
  outfile: 'out/agent/redebug-shims.js',
})
