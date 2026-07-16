import { z } from 'zod'

/**
 * Page-agent binding contract (spec decisions 23/29/32). The agent runs inside
 * the recorded page — hostile territory — so main Zod-parses every message
 * before it can touch a recording; the page could call the binding directly.
 */

/** window binding the agent calls; main receives it as Runtime.bindingCalled. */
export const AGENT_BINDING_NAME = '__entranceEmit'

/** Max serialized agent message accepted by main (rrweb full snapshots are large but bounded). */
export const AGENT_MESSAGE_MAX_BYTES = 8 * 1024 * 1024

const clickPayloadSchema = z.object({
  kind: z.literal('click'),
  x: z.number(),
  y: z.number(),
  button: z.number(),
  selector: z.string().max(1024),
})

const keyModifiersSchema = z.object({
  ctrl: z.boolean(),
  meta: z.boolean(),
  alt: z.boolean(),
  shift: z.boolean(),
})

const keyPayloadSchema = z.object({
  kind: z.literal('key'),
  code: z.string().max(64),
  /** character keys are masked in the readable lane (decision 32d); control keys are not secrets. */
  keyClass: z.enum(['character', 'control']),
  key: z.string().max(32).optional(),
  masked: z.boolean().optional(),
  modifiers: keyModifiersSchema.optional(),
  /** Real keystroke — main moves this to the enclave and strips it from the lane. */
  secret: z.object({ key: z.string().max(32) }).optional(),
})

const scrollPayloadSchema = z.object({
  kind: z.literal('scroll'),
  x: z.number(),
  y: z.number(),
})

export const inputPayloadSchema = z.discriminatedUnion('kind', [
  clickPayloadSchema,
  keyPayloadSchema,
  scrollPayloadSchema,
])
export type InputPayload = z.infer<typeof inputPayloadSchema>

/** Every agent → main message: input is strictly validated; rrweb stays opaque (sanitized at render, decision 21). */
export const agentMessageSchema = z.union([
  z.object({ lane: z.literal('input'), payload: inputPayloadSchema }),
  z.object({ lane: z.literal('rrweb'), payload: z.unknown() }),
  // Control message: a new document's agent is installed — main restarts rrweb if recording.
  z.object({ lane: z.literal('agent'), payload: z.object({ kind: z.literal('ready') }) }),
])
export type AgentMessage = z.infer<typeof agentMessageSchema>

/** Expressions main evaluates in the page to drive the agent's rrweb recorder. */
export const AGENT_REC_START_EXPRESSION = 'window.__entranceRecStart?.()'
export const AGENT_REC_STOP_EXPRESSION = 'window.__entranceRecStop?.()'
