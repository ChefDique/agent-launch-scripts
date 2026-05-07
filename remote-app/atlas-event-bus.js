// AtlasEvent contract — ARB-003
// Typed event bus for AgentRemote IPC bridge formalization.

'use strict';

const crypto = require('crypto');

/**
 * @typedef {'agent_selected'|'agent_deselected'|'voice_recording_started'|'voice_recording_stopped'|'voice_transcript_ready'|'message_sent'|'message_failed'|'agent_spawn_requested'|'capability_validated'|'agent_running'|'agent_output_delta'|'approval_needed'|'agent_blocked'|'agent_completed'|'agent_failed'} AtlasEventType
 */

/**
 * @typedef {Object} AtlasEvent
 * @property {string} id - Unique event ID (uuid-like)
 * @property {string} ts - ISO timestamp
 * @property {AtlasEventType} type - Event type
 * @property {string} [agentId] - Associated agent ID
 * @property {Object} [payload] - Event-specific payload (see per-type shapes below)
 * @property {'ui_projection'|'local_runtime'|'governed_workflow'} authority
 * @property {'renderer'|'main'|'acrm'|'swarmy'|'stt'} source
 */

// Per-event payload shapes:
// agent_selected:         { agentId, displayName, multi: boolean, selectedIds: string[] }
// agent_deselected:       { agentId, selectedIds: string[] }
// voice_recording_started:{ deviceId?: string, language?: string }
// voice_recording_stopped:{ durationMs?: number }
// voice_transcript_ready: { text: string, confidence?: number, startedAt: string, endedAt: string, partial: boolean }
// message_sent:           { text: string, targets: string[], coords: string[], sentCount: number }
// message_failed:         { text: string, targets: string[], error: string }
// agent_spawn_requested:  { role: string, taskId?: string, skills?: string[], mode: string }
// capability_validated:   { agentId: string, capabilities: string[], ok: boolean }
// agent_running:          { agentId: string, paneId?: string, tmuxTarget?: string }
// agent_output_delta:     { agentId: string, delta: string, paneId?: string }
// approval_needed:        { agentId: string, taskId?: string, reason: string }
// agent_blocked:          { agentId: string, reason?: string }
// agent_completed:        { agentId: string, taskId?: string }
// agent_failed:           { agentId: string, error?: string }

const MAX_LOG_ENTRIES = 200;

class AtlasEventBus {
  constructor() {
    /** @type {AtlasEvent[]} */
    this._log = [];
    /** @type {Map<string, Function[]>} */
    this._handlers = new Map();
    /** @type {Function|null} renderer send function */
    this._rendererSend = null;
  }

  /** Attach the renderer send function (mainWindow.webContents.send) */
  attach(sendFn) {
    this._rendererSend = sendFn;
  }

  /** Detach renderer (window closed/destroyed) */
  detach() {
    this._rendererSend = null;
  }

  /**
   * Emit a typed AtlasEvent.
   * @param {AtlasEventType} type
   * @param {Object} payload
   * @param {{ agentId?: string, source?: string, authority?: string }} [meta]
   * @returns {AtlasEvent}
   */
  emit(type, payload = {}, meta = {}) {
    /** @type {AtlasEvent} */
    const event = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ts: new Date().toISOString(),
      type,
      agentId: meta.agentId || payload.agentId || undefined,
      payload,
      authority: meta.authority || _defaultAuthority(type),
      source: meta.source || 'main'
    };
    this._log.push(event);
    if (this._log.length > MAX_LOG_ENTRIES) this._log.shift();
    // Notify main-process listeners
    const handlers = this._handlers.get(type) || [];
    handlers.forEach(h => { try { h(event); } catch {} });
    const wildcards = this._handlers.get('*') || [];
    wildcards.forEach(h => { try { h(event); } catch {} });
    // Forward to renderer
    if (this._rendererSend) {
      try { this._rendererSend('atlas-event', event); } catch {}
    }
    return event;
  }

  /**
   * Subscribe to an event type (or '*' for all)
   * @param {AtlasEventType|'*'} type
   * @param {Function} handler
   */
  on(type, handler) {
    if (!this._handlers.has(type)) this._handlers.set(type, []);
    this._handlers.get(type).push(handler);
  }

  /** Get recent event log (up to MAX_LOG_ENTRIES) */
  getLog() {
    return [...this._log];
  }

  /** Flush log (for testing) */
  clearLog() {
    this._log = [];
  }
}

function _defaultAuthority(type) {
  if (['agent_running','agent_output_delta','agent_blocked','agent_completed','agent_failed','agent_spawn_requested','capability_validated'].includes(type)) return 'local_runtime';
  if (['approval_needed'].includes(type)) return 'governed_workflow';
  return 'ui_projection';
}

const bus = new AtlasEventBus();
module.exports = { AtlasEventBus, bus };
