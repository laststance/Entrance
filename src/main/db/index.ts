import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'

import type { RecordingSummary } from '@shared/ipc'
import type { RecordingManifest } from '@shared/envelope'

import { databasePath } from '../paths'
import { recordings } from './schema'

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
      event_counts_json TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS recordings_fts USING fts5(
      recording_id UNINDEXED,
      name,
      target_url
    );
  `)
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
export function insertRecording(manifest: RecordingManifest, framework?: string): void {
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

/** Newest-first library listing. */
export function listRecordings(): RecordingSummary[] {
  const rows = requireDb().select().from(recordings).all()
  return rows
    .sort((a, b) => b.createdAtWall - a.createdAtWall)
    .map((row) => ({
      id: row.id,
      name: row.name,
      groupId: row.groupId,
      targetUrl: row.targetUrl,
      createdAtWall: row.createdAtWall,
      durationMs: row.durationMs,
      endReason: row.endReason as RecordingSummary['endReason'],
      totalBytes: row.totalBytes,
    }))
}
