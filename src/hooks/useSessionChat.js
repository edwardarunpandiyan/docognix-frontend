/**
 * useSessionChat — per-conversation messages + documents
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { uid } from '../utils/helpers.js'
import { registerUploadedFile } from '../utils/pdfRegistry.js'
import { setAnonymousId, getAnonymousId } from '../utils/identity.js'
import {
  dbGetMessages, dbPutMessage, dbDeleteMessage, dbBulkPutMessages,
  dbDeleteMessagesByConversation,
  dbGetDocuments, dbPutDocument,
} from '../utils/db.js'
import {
  apiGetMessages, apiGetDocuments,
  apiUploadFirst, apiUploadDocument, apiStreamChat,
} from '../api/chatApi.js'

// ── Normalise backend source → SourceCard shape ───────────────────
// Backend:  document_id, document_name, content, page_number, confidence (string)
// Frontend: documentId, filename, snippet, page, confidence (0-100 number)
function normaliseSource(src) {
  const confidenceMap = { high: 85, medium: 65, low: 40 }
  const confidenceNum = typeof src.confidence === 'string'
    ? (confidenceMap[src.confidence] ?? 50)
    : (src.confidence ?? 50)

  return {
    documentId:      src.document_id      ?? src.documentId,
    filename:        src.document_name    ?? src.filename    ?? 'Document',
    snippet:         src.content          ?? src.snippet     ?? '',
    page:            src.page_number      ?? src.page        ?? 1,
    pageEnd:         src.page_end         ?? null,
    chunkId:         src.chunk_id         ?? src.chunkId,
    chunkIndex:      src.chunk_index      ?? src.chunkIndex  ?? 0,
    confidence:      confidenceNum,
    confidenceLabel: src.confidence,
    similarityScore: src.similarity_score ?? src.similarityScore ?? 0,
    keywordScore:    src.keyword_score    ?? src.keywordScore    ?? 0,
    combinedScore:   src.combined_score   ?? src.combinedScore   ?? 0,
    bbox:            src.bbox ?? null,
  }
}


// Normalise API message (snake_case) → frontend IDB shape (camelCase)
// Backend may return: id, conversation_id, role, content, created_at, metadata
function normaliseApiMessage(m, conversationId) {
  // Backend uses 'message_id' not 'id'
  const id = m.id ?? m.message_id ?? m.messageId ?? null
  if (!id) {
    console.warn('[SessionChat] message missing id, raw:', m)
    return null
  }

  // API returns sources, confidence, latency_ms at the TOP LEVEL
  // of the message — NOT nested inside a metadata object
  const rawSources = Array.isArray(m.sources) ? m.sources : []
  const sources    = rawSources.map(normaliseSource)
  const conf       = m.confidence ?? null

  return {
    id,
    conversationId: conversationId ?? m.conversation_id ?? m.conversationId,
    role:           m.role,
    content:        m.content ?? '',
    createdAt:      m.created_at ?? m.createdAt ?? new Date().toISOString(),
    streaming:      false,
    metadata: (m.role === 'assistant')
      ? {
          sources,
          latencyMs:  m.latency_ms   ?? 0,
          chunksUsed: m.chunks_used  ?? sources.length,
          confidence: conf ?? 'medium',
          state:      confidenceToState(conf ?? 'medium'),
        }
      : null,
  }
}

// Normalise API document (snake_case) → frontend IDB shape (camelCase)
// Backend may return: id, conversation_id, filename, original_name,
//   file_type, file_size, status, chunk_count, total_pages, created_at
function normaliseApiDocument(d, conversationId) {
  // Backend uses 'document_id' not 'id'
  const id = d.id ?? d.document_id ?? d.documentId ?? null
  if (!id) {
    console.warn('[SessionChat] document missing id, raw:', d)
    return null
  }
  return {
    id,
    conversationId:   conversationId ?? d.conversation_id ?? d.conversationId,
    filename:         d.filename       ?? d.original_name  ?? d.originalName  ?? '',
    originalName:     d.original_name  ?? d.originalName   ?? d.filename      ?? '',
    fileType:         d.file_type      ?? d.fileType        ?? '',
    fileSize:         d.file_size      ?? d.fileSize        ?? 0,
    status:           d.status         ?? 'ready',
    chunkCount:       d.chunk_count    ?? d.chunkCount      ?? 0,
    // Backend returns page_count — also try total_pages for compatibility
    totalPages:       d.page_count     ?? d.total_pages     ?? d.totalPages    ?? 0,
    wordCount:        d.word_count     ?? d.wordCount       ?? 0,
    createdAt:        d.created_at     ?? d.createdAt       ?? new Date().toISOString(),
    processingError:  d.processing_error ?? d.processingError ?? null,
    // fileUrl and fileUrlExpiresAt — backend does not return these in the
    // list endpoint. DocContentView falls back to IDB blob → null when
    // blob is also cleared. PDF viewing requires the user to re-upload
    // OR a dedicated signed URL endpoint on the backend.
    // Set null explicitly so getOrRestoreDocUrl gets no serverUrl hint.
    fileUrl:          d.file_url        ?? d.fileUrl         ?? null,
    fileUrlExpiresAt: d.file_url_expires_at ?? d.fileUrlExpiresAt ?? null,
  }
}

function confidenceToState(c) {
  if (c === 'high')   return 'supported'
  if (c === 'medium') return 'partial'
  return 'not_relevant'
}

export function useSessionChat(
  conversationId,
  onDocAdded,
  onConversationTouched,
  onRenameSession,
  onConversationCreated,
) {
  const [messages,       setMessages]       = useState([])
  const [documents,      setDocuments]      = useState([])
  const [isSending,      setIsSending]      = useState(false)
  const [isUploading,    setIsUploading]    = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  // Multi-file queue: files waiting to be uploaded after the current one finishes
  const [uploadQueue,    setUploadQueue]    = useState([])
  // Which file in the batch is currently uploading (1-based for display)
  const [uploadBatchIdx, setUploadBatchIdx] = useState(0)
  const [uploadBatchTotal, setUploadBatchTotal] = useState(0)
  const [isLoadingData,  setIsLoadingData]  = useState(true)
  const [error,          setError]          = useState(null)

  const streamCtrl = useRef(null)
  const uploadCtrl = useRef(null)

  // ── Load conversation data ────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) {
      setMessages([]); setDocuments([]); setIsLoadingData(false); return
    }

    let cancelled = false
    streamCtrl.current?.abort()
    setIsLoadingData(true)
    setMessages([]); setDocuments([]); setError(null)

    async function load() {
      const [msgs, docs] = await Promise.all([
        dbGetMessages(conversationId),
        dbGetDocuments(conversationId),
      ])
      if (cancelled) return
      setMessages(msgs); setDocuments(docs); setIsLoadingData(false)

      // ── Stale-while-revalidate + cold-cache restore ─────────────────
      // Always fetch from API in background. When IDB was cold/cleared
      // this is the restore path. Defensive extraction handles any
      // backend envelope shape: { messages:[] } | { data:[] } | [] directly
      if (!cancelled) {
        try {
          const [msgsRaw, docsRaw] = await Promise.all([
            apiGetMessages(conversationId),
            apiGetDocuments(conversationId),
          ])
          if (cancelled) return

          // Defensive extraction — handle any envelope the backend sends
          const extractArray = (raw, ...keys) => {
            if (Array.isArray(raw)) return raw
            for (const k of keys) {
              if (raw && Array.isArray(raw[k])) return raw[k]
            }
            console.warn('[SessionChat] unexpected API shape:', raw)
            return []
          }

          const sMsgs = extractArray(msgsRaw,  'messages', 'data', 'items')
          const sDocs = extractArray(docsRaw,  'documents', 'data', 'items')

          console.debug('[SessionChat] restore — msgs:', sMsgs.length, 'docs:', sDocs.length)
          if (sMsgs.length) console.debug('[SessionChat] first msg raw:', sMsgs[0])
          if (sDocs.length)  console.debug('[SessionChat] first doc raw:', sDocs[0])

          // Normalise snake_case API shapes → camelCase IDB shapes
          const normMsgs = sMsgs.map(m => normaliseApiMessage(m, conversationId)).filter(Boolean)
          const normDocs = sDocs.map(d => normaliseApiDocument(d, conversationId)).filter(Boolean)

          // Write to IDB in bulk (single transaction each)
          // DEDUP FIX: clear IDB messages before writing API versions.
          // Frontend uses uid() for temp IDs during streaming; backend stores
          // messages with its own UUIDs. Both coexist in IDB (different keyPath
          // values) causing duplicate display. Clear first so only canonical
          // backend IDs remain.
          if (normMsgs.length) {
            await dbDeleteMessagesByConversation(conversationId)
            await dbBulkPutMessages(normMsgs)
          }
          if (normDocs.length) await Promise.all(normDocs.map(d => dbPutDocument(d)))

          const [fm, fd] = await Promise.all([
            dbGetMessages(conversationId),
            dbGetDocuments(conversationId),
          ])
          if (!cancelled) { setMessages(fm); setDocuments(fd) }
        } catch (e) {
          console.error('[SessionChat] sync failed:', e)
        }
      }
    }

    load().catch(e => { if (!cancelled) { console.error(e); setIsLoadingData(false) } })
    return () => { cancelled = true }
  }, [conversationId])

  const updateDocumentStatus = useCallback((docId, patch) => {
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ...patch } : d))
  }, [])

  // ── Stream a chat message ─────────────────────────────────────────
  const submitMessage = useCallback(async (content) => {
    if (!content.trim() || isSending || !conversationId) return
    streamCtrl.current?.abort()
    const ctrl = new AbortController()
    streamCtrl.current = ctrl

    const userMsg = {
      id: uid(), conversationId, role: 'user',
      content: content.trim(), createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    await dbPutMessage(userMsg)
    setIsSending(true); setError(null)
    onConversationTouched?.(conversationId)

    const aId  = uid()
    const stub = {
      id: aId, conversationId, role: 'assistant',
      content: '', streaming: true,
      createdAt: new Date().toISOString(), metadata: null,
    }
    setMessages(prev => [...prev, stub])

    await apiStreamChat(conversationId, content.trim(), {
      onToken: token => setMessages(prev =>
        prev.map(m => m.id === aId ? { ...m, content: m.content + token } : m)
      ),

      // Sources normalised from snake_case and stored in metadata
      onSources: sources => {
        const norm = (sources ?? []).map(normaliseSource)
        setMessages(prev =>
          prev.map(m => m.id === aId
            ? { ...m, metadata: { ...(m.metadata ?? {}), sources: norm } }
            : m
          )
        )
      },

      onMeta: meta => setMessages(prev =>
        prev.map(m => m.id === aId
          ? { ...m, metadata: { ...(m.metadata ?? {}), ...meta } }
          : m
        )
      ),

      // Merge latencyMs, chunksUsed, state into metadata on completion.
      // dbPutMessage is intentionally OUTSIDE setMessages — side effects
      // inside React state updaters are unsafe in concurrent mode.
      onDone: async (payload) => {
        let finalMsg = null
        setMessages(prev => {
          const next = prev.map(m => {
            if (m.id !== aId) return m
            const meta    = m.metadata ?? {}
            const sources = meta.sources ?? []
            const conf    = payload?.confidence ?? 'medium'
            finalMsg = {
              ...m, streaming: false,
              metadata: {
                ...meta,
                state:      confidenceToState(conf),
                latencyMs:  payload != null ? (payload.latency_ms ?? 0) : (meta.latencyMs ?? 0),
                chunksUsed: sources.length,
                confidence: conf,
              },
            }
            return finalMsg
          })
          return next
        })
        if (finalMsg) dbPutMessage(finalMsg).catch(console.warn)
        setIsSending(false)
      },

      // Backend-generated title from first message
      onTitle: (title, convId) => {
        if (title && convId) onRenameSession?.(convId, title)
      },

      onError: async err => {
        setMessages(prev => prev.filter(m => m.id !== aId))
        await dbDeleteMessage(aId).catch(() => {})
        setError(err?.message ?? 'Something went wrong')
        setIsSending(false)
      },
    }, ctrl.signal)
  }, [conversationId, isSending, onConversationTouched, onRenameSession])

  // ── First upload — creates conversation + document atomically ─────
  const uploadFirstDoc = useCallback(async (file) => {
    if (!file || isUploading) return null
    uploadCtrl.current?.abort()
    const ctrl = new AbortController()
    uploadCtrl.current = ctrl
    setIsUploading(true); setUploadProgress(0); setError(null)

    try {
      const data = await apiUploadFirst(
        file, getAnonymousId(),
        pct => setUploadProgress(pct), ctrl.signal
      )

      if (data.anonymous_id) setAnonymousId(data.anonymous_id)

      const convId = data.conversation_id
      const docId  = data.document_id
      await registerUploadedFile(docId, file)

      const conv = {
        id: convId, title: 'New Chat',
        anonymousId: data.anonymous_id, userId: null,
        docCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // 'processing' — polling must start immediately after backend returns 202
      const doc = {
        id: docId, conversationId: convId,
        filename: data.filename ?? file.name,
        originalName: data.filename ?? file.name,
        fileType: data.file_type ?? file.name.split('.').pop().toLowerCase(),
        fileSize: data.file_size ?? file.size,
        status: 'processing',
        chunkCount: 0, createdAt: new Date().toISOString(),
      }

      await dbPutDocument(doc)
      onConversationCreated?.(conv)
      onDocAdded?.(convId)

      return { conversationId: convId, documentId: docId }
    } catch (e) {
      if (e.name !== 'AbortError') setError(e?.message ?? 'Upload failed')
      return null
    } finally {
      setIsUploading(false); setUploadProgress(0)
    }
  }, [isUploading, onConversationCreated, onDocAdded])

  // ── Core single-file upload (internal) ──────────────────────────
  const _uploadSingleDoc = useCallback(async (file, ctrl) => {
    if (!file || !conversationId) return
    try {
      const data = await apiUploadDocument(
        conversationId, file,
        pct => setUploadProgress(pct), ctrl.signal
      )
      await registerUploadedFile(data.document_id, file)
      const doc = {
        id: data.document_id, conversationId: data.conversation_id,
        filename: data.filename ?? file.name,
        originalName: data.filename ?? file.name,
        fileType: data.file_type ?? file.name.split('.').pop().toLowerCase(),
        fileSize: data.file_size ?? file.size,
        status: 'processing',
        chunkCount: 0, createdAt: new Date().toISOString(),
      }
      setDocuments(prev => [...prev, doc])
      await dbPutDocument(doc)
      onDocAdded?.(conversationId)
      onConversationTouched?.(conversationId)
    } catch (e) {
      if (e.name !== 'AbortError') setError(e?.message ?? 'Upload failed')
    }
  }, [conversationId, onDocAdded, onConversationTouched])

  // ── Public uploadDoc — accepts one file OR an array of files ─────
  // Files are uploaded sequentially (one at a time) so the backend's
  // per-conversation upload lock is never hit simultaneously.
  const uploadDoc = useCallback(async (fileOrFiles) => {
    if (!fileOrFiles || !conversationId) return
    const files = Array.isArray(fileOrFiles)
      ? fileOrFiles
      : [fileOrFiles]
    if (!files.length) return

    uploadCtrl.current?.abort()
    const ctrl = new AbortController()
    uploadCtrl.current = ctrl

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)
    setUploadBatchTotal(files.length)

    try {
      for (let i = 0; i < files.length; i++) {
        if (ctrl.signal.aborted) break
        setUploadBatchIdx(i + 1)
        setUploadProgress(0)
        await _uploadSingleDoc(files[i], ctrl)
      }
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      setUploadBatchIdx(0)
      setUploadBatchTotal(0)
    }
  }, [conversationId, _uploadSingleDoc])

  const retryMessage = useCallback(async (failedMsg) => {
    if (!failedMsg) return
    const idx     = messages.findIndex(m => m.id === failedMsg.id)
    const userMsg = idx > 0 ? messages[idx - 1] : null
    if (!userMsg || userMsg.role !== 'user') return
    setMessages(prev => prev.filter(m => m.id !== failedMsg.id))
    await dbDeleteMessage(failedMsg.id).catch(() => {})
    await submitMessage(userMsg.content)
  }, [messages, submitMessage])

  const cancelStream = useCallback(() => {
    streamCtrl.current?.abort(); setIsSending(false)
    setMessages(prev => prev.filter(m => !m.streaming))
  }, [])

  const cancelUpload = useCallback(() => {
    uploadCtrl.current?.abort(); setIsUploading(false); setUploadProgress(0)
  }, [])

  return {
    messages, documents,
    isSending, isUploading, uploadProgress, uploadBatchIdx, uploadBatchTotal,
    isLoadingData, error,
    submitMessage, uploadFirstDoc, uploadDoc,
    retryMessage, cancelStream, cancelUpload,
    updateDocumentStatus,
    clearError: () => setError(null),
  }
}
