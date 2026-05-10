/**
 * chatApi.js — Docognix backend API client
 * ─────────────────────────────────────────
 * All endpoints under /api/v1.
 *
 * SSE event types (in order per response):
 *   meta    → { type, conversation_id, user_message_id }
 *   sources → { type, sources: SourceReference[] }
 *   token   → { type, content: string }
 *   done    → { type, message_id, conversation_id, confidence,
 *               prompt_tokens, completion_tokens, latency_ms }
 *   title   → { type, conversation_id, title }  — first message only
 *   error   → { type, message: string }
 */
import { getAnonymousId } from '../utils/identity.js'
import { registerUploadedFile, reRegisterWithServerId } from '../utils/pdfRegistry.js'
import { uploadWithProgress } from '../utils/uploadManager.js'

const BASE = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
const V1   = `${BASE}/api/v1`

if (!BASE) {
  console.error('[Docognix] VITE_API_BASE_URL is not set. Set it in your .env file.')
}

// ── Type guard ────────────────────────────────────────────────────
function assertId(value, label = 'id') {
  if (value && typeof value !== 'string') {
    throw new Error(
      `[chatApi] ${label} must be a string but got ${Object.prototype.toString.call(value)}. ` +
      `Did you forget to await a function that returns the ID?`
    )
  }
}

// ── Fetch wrapper ─────────────────────────────────────────────────
async function req(path, options = {}, timeoutMs = 15_000) {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${V1}${path}`, {
      headers: {
        'Content-Type':   'application/json',
        'X-Anonymous-Id': getAnonymousId(),
        ...options.headers,
      },
      signal: ctrl.signal,
      ...options,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail ?? 'Request failed')
    }
    if (res.status === 204) return null
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

// In-flight deduplication
const _fly = new Map()
function dedupe(key, fn) {
  if (_fly.has(key)) return _fly.get(key)
  const p = fn().finally(() => _fly.delete(key))
  _fly.set(key, p)
  return p
}

// ── Conversations ─────────────────────────────────────────────────

export async function apiGetConversations(anonymousId) {
  const id = anonymousId || getAnonymousId()
  return dedupe(`conversations:${id}`, () =>
    req(`/conversations?anonymous_id=${encodeURIComponent(id)}`)
  )
}

export async function apiDeleteConversation(id) {
  assertId(id, 'conversationId')
  return req(`/conversations/${id}`, { method: 'DELETE' })
}

export async function apiRenameConversation(id, title) {
  assertId(id, 'conversationId')
  return req(`/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

// ── Documents ─────────────────────────────────────────────────────

/**
 * FIRST upload — creates conversation + document atomically.
 * anonymous_id = "" for first-time users (backend generates UUID).
 * Returns: { conversation_id, document_id, anonymous_id, filename, status }
 */
export async function apiUploadFirst(file, anonymousId = '', onProgress, signal) {
  const tempId = `temp-${Date.now()}`
  await registerUploadedFile(tempId, file)

  const data = await uploadWithProgress(
    `${V1}/documents/upload`,
    file,
    {
      onProgress,
      signal,
      extraFields: { anonymous_id: anonymousId ?? '' },
    }
  )

  await reRegisterWithServerId(tempId, data.document_id)
  await registerUploadedFile(data.document_id, file)
  return data
}

/**
 * ADDITIONAL upload — adds a document to an existing conversation.
 * Returns: { document_id, conversation_id, filename, status }
 */
export async function apiUploadDocument(conversationId, file, onProgress, signal) {
  assertId(conversationId, 'conversationId')
  if (!conversationId) {
    throw new Error('[chatApi] apiUploadDocument called without a valid conversationId.')
  }

  const tempId = `temp-${Date.now()}`
  await registerUploadedFile(tempId, file)

  const data = await uploadWithProgress(
    `${V1}/conversations/${conversationId}/documents`,
    file,
    { onProgress, signal }
  )

  await reRegisterWithServerId(tempId, data.document_id)
  await registerUploadedFile(data.document_id, file)
  return data
}

export async function apiGetDocuments(conversationId) {
  assertId(conversationId, 'conversationId')
  return dedupe(`docs:${conversationId}`, () =>
    req(`/conversations/${conversationId}/documents`)
  )
}

export async function apiGetDocumentStatus(conversationId, documentId) {
  assertId(conversationId, 'conversationId')
  return req(`/conversations/${conversationId}/documents/${documentId}/status`)
}

// ── Messages ──────────────────────────────────────────────────────

export async function apiGetMessages(conversationId) {
  assertId(conversationId, 'conversationId')
  return dedupe(`msgs:${conversationId}`, () =>
    req(`/chat/${conversationId}/messages`)
  )
}

// ── Streaming chat ────────────────────────────────────────────────

export async function apiStreamChat(
  conversationId,
  message,
  { onToken, onSources, onMeta, onDone, onTitle, onError } = {},
  signal
) {
  assertId(conversationId, 'conversationId')

  try {
    const res = await fetch(`${V1}/chat/${conversationId}`, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'X-Anonymous-Id': getAnonymousId(),
      },
      body: JSON.stringify({
        message,
        anonymous_id: getAnonymousId(),
        stream: true,
      }),
      signal,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail ?? `Chat failed: ${res.status}`)
    }

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buf       = ''
    let lastEvent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          lastEvent = line.slice(7).trim()
          continue
        }
        if (!line.startsWith('data: ')) continue

        const raw = line.slice(6).trim()
        if (!raw || raw === '[DONE]') { onDone?.(); return }

        try {
          const payload = JSON.parse(raw)
          switch (lastEvent || payload.type) {
            case 'meta':    onMeta?.(payload);                                break
            case 'sources': onSources?.(payload.sources ?? []);               break
            case 'token':   onToken?.(payload.content ?? '');                 break
            case 'done':    onDone?.(payload);                                break
            case 'title':   onTitle?.(payload.title, payload.conversation_id); break
            case 'error':   onError?.(new Error(payload.message ?? 'Stream error')); return
            default:        break
          }
          lastEvent = ''
        } catch { /* malformed line — skip */ }
      }
    }
    onDone?.()
  } catch (err) {
    if (err.name !== 'AbortError') onError?.(err)
  }
}
