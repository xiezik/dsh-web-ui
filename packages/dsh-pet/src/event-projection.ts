/**
 * Official session event projection — pure. Maps the durable DSH session
 * vocabulary onto the pet's visual phases and carries an optional completed-
 * turn reward for the ledger. Holds no state of its own; callers keep a
 * {@link ProjectionRuntime} per session and feed events in arrival order.
 * @module @linxin666/dsh-pet/event-projection
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ActivityPhase, PetStateInput } from './state.ts'

/** Runtime shape of the optional legacy activity event. */
export interface ActivityStatusEventLike {
  phase?: string
  line?: string
  phrase?: string
}

/** Per-session facts needed to project the official event stream. */
export interface ProjectionRuntime {
  activeTools: Set<string>
  officialEventsSeen: boolean
  stepHadFailure: boolean
}

/** One official event projection, optionally carrying a completed turn reward. */
export interface PetActivityTransition {
  input: PetStateInput
  completedTurn?: number
}

/** Fresh projection runtime for a newly seen session. */
export function emptyProjectionRuntime(): ProjectionRuntime {
  return { activeTools: new Set(), officialEventsSeen: false, stepHadFailure: false }
}

/** Keep tool names readable inside the compact status bubble. */
function displayToolName(name: string): string {
  const compact = name.replace(/\s+/g, ' ').trim() || '工具'
  return compact.length <= 24 ? compact : `${compact.slice(0, 21)}...`
}

/** Max length of the tool-argument summary shown in the pet bubble. */
export const ARG_SUMMARY_MAX = 24

/**
 * Fork: map a tool name onto a pet phase. Tools with a dedicated bust track
 * get their own phase; everything else falls back to the generic `tool`
 * phase (running-right animation).
 */
export function toolPhase(name: string): ActivityPhase {
  switch (name) {
    case 'webfetch':
    case 'fetch':
    case 'http':
      return 'fetching'
    case 'websearch':
    case 'search':
      return 'searching'
    case 'edit':
    case 'write':
    case 'apply_patch':
    case 'patch':
    case 'bash':
      return 'building'
    case 'agent':
    case 'task':
    case 'plan':
      return 'analyzing'
    case 'chat':
    case 'ask':
      return 'chatting'
    default:
      return 'tool'
  }
}

/**
 * Fork: build a safe, short human summary from a tool call's raw arguments
 * JSON. Only the FIRST scalar-ish field (command / filePath / search terms)
 * is surfaced, truncated to ARG_SUMMARY_MAX chars; full arguments never leave
 * the host. Mirrors the pet-bridge safety boundary.
 */
export function summarizeArguments(rawArguments: string, toolName: string): string | undefined {
  if (toolName === 'bash') {
    // bash: {"command": "..."} → the command itself
    try {
      const parsed = JSON.parse(rawArguments) as Record<string, unknown>
      const cmd = typeof parsed.command === 'string' ? parsed.command : undefined
      if (cmd !== undefined && cmd.trim() !== '') return cmd.trim()
    } catch { /* fall through */ }
    return undefined
  }
  try {
    const parsed = JSON.parse(rawArguments) as Record<string, unknown>
    // Prefer common summary fields, else the first string value.
    const preferred = ['filePath', 'path', 'file', 'query', 'search', 'url', 'prompt', 'text']
    for (const key of preferred) {
      const value = parsed[key]
      if (typeof value === 'string' && value.trim() !== '') return value.trim()
    }
    for (const value of Object.values(parsed)) {
      if (typeof value === 'string' && value.trim() !== '') return value.trim()
      if (Array.isArray(value)) {
        const first = value.find((v): v is string => typeof v === 'string' && v.trim() !== '')
        if (first !== undefined) return first.trim()
      }
    }
  } catch { /* not JSON → fall through */ }
  return undefined
}

/** Truncate a summary to ARG_SUMMARY_MAX chars, appending an ellipsis. */
export function clipSummary(summary: string): string {
  if (summary.length <= ARG_SUMMARY_MAX) return summary
  return summary.slice(0, ARG_SUMMARY_MAX - 1) + '…'
}

/** Whether a legacy phase is part of the pet's supported vocabulary. */
export function isActivityPhase(phase: string): phase is PetStateInput['phase'] {
  return ['idle', 'waiting', 'thinking', 'tool', 'review', 'done', 'failed'].includes(phase)
}

/**
 * Project the durable DSH session vocabulary into the pet's visual phases.
 * Unknown and log-only events do not disturb the last meaningful activity.
 */
export function projectOfficialEvent(
  event: SessionEvent,
  runtime: ProjectionRuntime,
): PetActivityTransition | undefined {
  switch (event.type) {
    case 'turn/start':
      runtime.activeTools.clear()
      runtime.stepHadFailure = false
      return { input: { phase: 'waiting', line: '准备开始' } }
    case 'step/start':
      runtime.activeTools.clear()
      runtime.stepHadFailure = false
      return { input: { phase: 'waiting', line: '等待模型响应' } }
    case 'assistant/chunk': {
      const { chunk } = event.data
      if (chunk.type === 'reasoning-delta' && chunk.text.length > 0) {
        return { input: { phase: 'thinking', line: '正在思考' } }
      }
      if (chunk.type === 'text-delta' && chunk.text.length > 0) {
        return { input: { phase: 'review', line: '整理回复中' } }
      }
      return undefined
    }
    case 'assistant/message':
      return { input: { phase: 'review', line: '整理回复中' } }
    case 'tool/call': {
      runtime.activeTools.add(String(event.data.callId))
      const name = event.data.name
      // Fork: tool-specific phase (fetching/searching/analyzing/building/
      // chatting) so skins with dedicated rows play the right track; skins
      // without them resolve these to the generic running animation.
      const phase = toolPhase(name)
      // Safe argument summary (≤ ARG_SUMMARY_MAX chars; full args never
      // leave the host).
      const summary = summarizeArguments(event.data.arguments, name)
      const line = summary !== undefined
        ? name + ' · ' + clipSummary(summary)
        : 'tool: ' + name
      return { input: { phase, line } }
    }
    case 'tool/result': {
      const block = event.data.message.content[0]
      runtime.activeTools.delete(String(event.data.message.source.callId))
      runtime.stepHadFailure ||= event.data.error !== undefined || block.isError === true
      if (runtime.activeTools.size > 0) {
        return {
          input: {
            phase: 'tool',
            line: `还有 ${runtime.activeTools.size} 个工具运行中`,
          },
        }
      }
      return runtime.stepHadFailure
        ? { input: { phase: 'failed', line: '工具执行失败' } }
        : { input: { phase: 'thinking', line: '处理工具结果' } }
    }
    case 'turn/end': {
      runtime.activeTools.clear()
      switch (event.data.reason.kind) {
        case 'completed':
          return {
            input: { phase: 'done', line: '完成啦' },
            completedTurn: event.data.turn,
          }
        case 'error':
          return { input: { phase: 'failed', line: '执行失败' } }
        case 'max-tokens':
          return { input: { phase: 'failed', line: '达到输出上限' } }
        case 'interrupted':
          return { input: { phase: 'failed', line: '执行意外中断' } }
        case 'blocked':
          return { input: { phase: 'waiting', line: '等待继续' } }
        case 'aborted':
          return { input: { phase: 'idle', line: '已停止' } }
        default:
          // TurnEndReasonMap is merge-extensible; a newer ending must not
          // leave the pet showing stale in-progress work.
          return { input: { phase: 'idle' } }
      }
    }
    default:
      return undefined
  }
}
