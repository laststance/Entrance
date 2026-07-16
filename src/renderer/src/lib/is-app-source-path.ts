/**
 * Whether a resolved sourcemap source is the user's app code (worth showing in
 * the code panel) vs framework/vendor internals — used by the source resolver
 * to pick the first app frame from a CDP stack.
 * @param sourcePath - raw source id from the sourcemap (e.g. "file:///…/app/page.tsx")
 * @returns
 * - true: app code
 * - false: node_modules / Next.js pre-bundled internals (webpack://next,
 *   /dist/compiled/) / Turbopack virtual roots ([next], [turbopack]) / synthetic sources
 * @example isAppSourcePath('file:///w/app/page.tsx') // => true
 * @example isAppSourcePath('webpack://next/./dist/compiled/scheduler/index.js') // => false
 */
export function isAppSourcePath(sourcePath: string): boolean {
  if (!sourcePath) return false
  const decoded = safeDecode(sourcePath)
  return (
    !decoded.includes('node_modules') &&
    !decoded.includes('__nextjs-internal') &&
    !decoded.includes('<anonymous>') &&
    !decoded.includes('/dist/compiled/') &&
    !decoded.startsWith('webpack://next/') &&
    !/^turbopack:\/\/\/\[/.test(decoded)
  )
}

/** decodeURIComponent that tolerates stray "%" in generated source names. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
