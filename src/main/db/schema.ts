import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Library metadata (spec decision 14): SQLite holds names/groups/search;
 * lanes and blobs stay as external files referenced by recording id.
 */

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAtWall: integer('created_at_wall').notNull(),
})

export const recordings = sqliteTable('recordings', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  groupId: text('group_id'),
  targetUrl: text('target_url').notNull(),
  framework: text('framework'),
  bundlerVariant: text('bundler_variant'),
  createdAtWall: integer('created_at_wall').notNull(),
  durationMs: integer('duration_ms').notNull(),
  endReason: text('end_reason').notNull(),
  totalBytes: integer('total_bytes').notNull(),
  /** JSON: Partial<Record<Lane, number>> */
  eventCountsJson: text('event_counts_json').notNull(),
  /** First screencast frame's blob hash (1e card thumbnail); null = no frame captured. */
  thumbnailBlobHash: text('thumbnail_blob_hash'),
  /** JSON HudTally for 1e card chips; NULL marks pre-P2 rows awaiting lazy backfill. */
  tallyJson: text('tally_json'),
})
