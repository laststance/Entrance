// Flight-blob completeness analyzer: which row ids does a blob define vs
// reference, and in what property context do unresolved references appear?
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const [blobsDir, hashPrefix] = process.argv.slice(2)
const name = readdirSync(blobsDir).find((n) => n.startsWith(hashPrefix))
const body = readFileSync(join(blobsDir, name), 'utf8')
const lines = body.split('\n').filter(Boolean)

const defined = new Set(lines.map((l) => l.match(/^([0-9a-f]+):/)?.[1]).filter(Boolean))
const refPattern = /"\$(L|@|E|F|T|W|B|K|S|I|Y|P|N|D|Q|Z)?([0-9a-f]+)(?::[^"]*)?"/g
const refs = new Map() // id -> Set(tag)
for (const match of body.matchAll(refPattern)) {
  const tag = match[1] ?? ''
  if (tag === 'S' || tag === 'D' || tag === 'N' || tag === 'P') continue // $S=symbol etc, not row refs
  const id = match[2]
  if (!refs.has(id)) refs.set(id, new Set())
  refs.get(id).add(tag || '(bare)')
}
const missing = [...refs.keys()].filter((id) => !defined.has(id))
console.log(name.slice(0, 10), 'lines:', lines.length, 'defined:', defined.size, 'referenced:', refs.size, 'missing:', missing.length)
for (const id of missing) {
  const tags = [...refs.get(id)].join(',')
  // context: find first occurrence with property name before it
  const ctxMatch = body.match(new RegExp('.{0,60}"\\$(?:L|@|E|F|T|W|B|K|Y|Q|Z)?' + id + '(?::[^"]*)?".{0,10}'))
  console.log('  $' + id, '[' + tags + ']', JSON.stringify((ctxMatch?.[0] ?? '').slice(0, 110)))
}
