import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import { ulid } from 'ulid'

import type { GroupSummary, HudTally, RecordingSummary } from '@shared/ipc'
import { MANIFEST_FILENAME, type RecordingManifest } from '@shared/envelope'

import { databasePath, recordingDir } from '../paths'
import { computeDerivedMeta, type DerivedRecordingMeta } from '../recorder/derived-meta'
import { buildFtsMatchExpression } from '../utils/fts-match-expression'
import { groups, recordings } from './schema'

/**
 * Library DB (spec decision 14): better-sqlite3 in WAL mode + drizzle; FTS5
 * index over names/URLs kept in sync manually (never indexes header/body
 * values — spec decision 32e). Opened once from main/index.ts.
 */

let db: BetterSQLite3Database | null = null
let sqlite: Database.Database | null = null

export function openDatabase(): void {
  sqlite = new Database(databasePath())
  sqlite.pragma('journal_mode = WAL')
  // DDL-at-startup keeps v1 free of a migration toolchain; schemaVersion lives in the manifest.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at_wall INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      group_id TEXT,
      target_url TEXT NOT NULL,
      framework TEXT,
      bundler_variant TEXT,
      created_at_wall INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      end_reason TEXT NOT NULL,
      total_bytes INTEGER NOT NULL,
      event_counts_json TEXT NOT NULL,
      thumbnail_blob_hash TEXT,
      tally_json TEXT
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS recordings_fts USING fts5(
      recording_id UNINDEXED,
      name,
      target_url
    );
  `)
  // Additive columns for databases created before P2 (no migration toolchain in v1).
  for (const columnDdl of ['thumbnail_blob_hash TEXT', 'tally_json TEXT']) {
    try {
      sqlite.exec(`ALTER TABLE recordings ADD COLUMN ${columnDdl}`)
    } catch {
      // Column already exists — the CREATE TABLE path or a previous launch added it.
    }
  }
  db = drizzle(sqlite)
}

function requireDb(): BetterSQLite3Database {
  if (!db) throw new Error('database not opened')
  return db
}

function requireSqlite(): Database.Database {
  if (!sqlite) throw new Error('database not opened')
  return sqlite
}

/** Insert the library row + FTS entry for a finalized recording. */
export function insertRecording(
  manifest: RecordingManifest,
  framework?: string,
  derived?: DerivedRecordingMeta,
): void {
  requireDb()
    .insert(recordings)
    .values({
      id: manifest.recordingId,
      name: manifest.name,
      groupId: null,
      targetUrl: manifest.targetUrl,
      framework: framework ?? manifest.framework ?? null,
      bundlerVariant: manifest.bundlerVariant ?? null,
      createdAtWall: manifest.t0Wall,
      durationMs: manifest.durationMs,
      endReason: manifest.endReason,
      totalBytes: manifest.totalBytes,
      eventCountsJson: JSON.stringify(manifest.eventCounts),
      thumbnailBlobHash: derived?.thumbnailBlobHash ?? null,
      tallyJson: derived ? JSON.stringify(derived.tally) : null,
    })
    .run()
  requireSqlite()
    .prepare('INSERT INTO recordings_fts (recording_id, name, target_url) VALUES (?, ?, ?)')
    .run(manifest.recordingId, manifest.name, manifest.targetUrl)
}

/** Rename / regroup a recording (screen 1e actions; save dialog uses rename). */
export function updateRecordingMeta(recordingId: string, name?: string, groupId?: string | null): void {
  const database = requireDb()
  if (name !== undefined) {
    database.update(recordings).set({ name }).where(eq(recordings.id, recordingId)).run()
    requireSqlite()
      .prepare('UPDATE recordings_fts SET name = ? WHERE recording_id = ?')
      .run(name, recordingId)
  }
  if (groupId !== undefined) {
    database.update(recordings).set({ groupId }).where(eq(recordings.id, recordingId)).run()
  }
}

/** Remove a recording's library row + FTS entry (the bundle dir is removed by the IPC layer). */
export function deleteRecordingRow(recordingId: string): void {
  requireDb().delete(recordings).where(eq(recordings.id, recordingId)).run()
  requireSqlite().prepare('DELETE FROM recordings_fts WHERE recording_id = ?').run(recordingId)
}

/** Newest-first library listing; lazily backfills thumbnail/tally for pre-P2 rows. */
export function listRecordings(): RecordingSummary[] {
  const rows = requireDb().select().from(recordings).all()
  return rows
    .sort((a, b) => b.createdAtWall - a.createdAtWall)
    .map((row) => {
      let thumbnailBlobHash = row.thumbnailBlobHash
      let tally = parseTallyJson(row.tallyJson)
      if (tally === null) {
        // Pre-P2 or crash-recovered row — derive once from lanes, then persist.
        const derived = backfillDerivedMeta(row.id)
        thumbnailBlobHash = derived.thumbnailBlobHash
        tally = derived.tally
      }
      return {
        id: row.id,
        name: row.name,
        groupId: row.groupId,
        targetUrl: row.targetUrl,
        createdAtWall: row.createdAtWall,
        durationMs: row.durationMs,
        endReason: row.endReason as RecordingSummary['endReason'],
        totalBytes: row.totalBytes,
        counts: tally,
        thumbnailUrl: thumbnailBlobHash
          ? `entrance://recording/${row.id}/blobs/${thumbnailBlobHash}`
          : null,
      }
    })
}

/** FTS5 lookup over names/URLs; returns matching recording ids (empty query → empty result). */
export function searchRecordingIds(query: string): string[] {
  const matchExpression = buildFtsMatchExpression(query)
  if (matchExpression === null) return []
  const rows = requireSqlite()
    .prepare('SELECT recording_id FROM recordings_fts WHERE recordings_fts MATCH ?')
    .all(matchExpression)
  return rows.flatMap((row) =>
    typeof row === 'object' && row !== null && 'recording_id' in row && typeof row.recording_id === 'string'
      ? [row.recording_id]
      : [],
  )
}

/** Sidebar group rows with live recording counts (screen 1e). */
export function listGroups(): GroupSummary[] {
  const rows = requireSqlite()
    .prepare(
      `SELECT g.id AS id, g.name AS name, COUNT(r.id) AS recording_count
       FROM groups g LEFT JOIN recordings r ON r.group_id = g.id
       GROUP BY g.id ORDER BY g.created_at_wall ASC`,
    )
    .all()
  return rows.flatMap((row) => {
    if (typeof row !== 'object' || row === null) return []
    if (!('id' in row) || !('name' in row) || !('recording_count' in row)) return []
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.recording_count !== 'number') {
      return []
    }
    return [{ id: row.id, name: row.name, recordingCount: row.recording_count }]
  })
}

/** Create a 1e sidebar group and return its id. */
export function createGroup(name: string): string {
  const groupId = ulid()
  requireDb().insert(groups).values({ id: groupId, name, createdAtWall: Date.now() }).run()
  return groupId
}

/** Count of library recordings (storage meter "N 録画"). */
export function countRecordings(): number {
  const row = requireSqlite().prepare('SELECT COUNT(*) AS count FROM recordings').get()
  return typeof row === 'object' && row !== null && 'count' in row && typeof row.count === 'number'
    ? row.count
    : 0
}

/** Parses a stored tally, returning null for NULL/garbled values (triggers backfill). */
function parseTallyJson(tallyJson: string | null): HudTally | null {
  if (tallyJson === null) return null
  try {
    const parsed: unknown = JSON.parse(tallyJson)
    if (typeof parsed !== 'object' || parsed === null) return null
    const record: Partial<Record<keyof HudTally, unknown>> = parsed
    const { click, fetch, console: consoleCount, error } = record
    if (
      typeof click === 'number' &&
      typeof fetch === 'number' &&
      typeof consoleCount === 'number' &&
      typeof error === 'number'
    ) {
      return { click, fetch, console: consoleCount, error }
    }
    return null
  } catch {
    return null
  }
}

/** Scans lanes for a row missing derived meta and persists the result (one-time per row). */
function backfillDerivedMeta(recordingId: string): DerivedRecordingMeta {
  const bundleDir = recordingDir(recordingId)
  let t0Mono = 0
  const manifestPath = join(bundleDir, MANIFEST_FILENAME)
  if (existsSync(manifestPath)) {
    try {
      const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))
      if (typeof manifest === 'object' && manifest !== null && 't0Mono' in manifest) {
        if (typeof manifest.t0Mono === 'number') t0Mono = manifest.t0Mono
      }
    } catch {
      // Unreadable manifest — count every lane event rather than none.
    }
  }
  const derived = computeDerivedMeta(bundleDir, t0Mono)
  requireDb()
    .update(recordings)
    .set({ thumbnailBlobHash: derived.thumbnailBlobHash, tallyJson: JSON.stringify(derived.tally) })
    .where(eq(recordings.id, recordingId))
    .run()
  return derived
}
