/**
 * useSessionChat — per-conversation messages + documents
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { uid } from '../utils/helpers.js'
import { registerUploadedFile } from '../utils/pdfRegistry.js'
import { setAnonymousId, getAnonymousId } from '../utils/identity.js'
import {
  dbGetMessages, dbPutMessage, dbDeleteMessage,
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

      if (!cancelled) {
        try {
          const [{ messages: sMsgs }, { documents: sDocs }] = await Promise.all([
            apiGetMessages(conversationId),
            apiGetDocuments(conversationId),
          ])
          if (cancelled) return
          for (const m of sMsgs) await dbPutMessage({ ...m, conversationId })
          for (const d of sDocs)  await dbPutDocument({ ...d, conversationId })
          const [fm, fd] = await Promise.all([
            dbGetMessages(conversationId),
            dbGetDocuments(conversationId),
          ])
          if (!cancelled) { setMessages(fm); setDocuments(fd) }
        } catch (e) { console.warn('[SessionChat] sync failed:', e.message) }
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
      // NOTE: IDB save is intentionally done OUTSIDE setMessages — side effects
      // inside React state updaters are unsafe (updater may run multiple times
      // in concurrent mode). We capture the final message in a variable so the
      // async IDB write always sees the correct, post-update value.
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
                // payload is undefined when stream ends without a done event;
                // fall back to 0 only in that case — never when payload exists.
                latencyMs:  payload != null ? (payload.latency_ms ?? 0) : (meta.latencyMs ?? 0),
                chunksUsed: sources.length,
                confidence: conf,
              },
            }
            return finalMsg
          })
          return next
        })

        // Persist to IDB after state is committed, outside the updater closure
        if (finalMsg) {
          dbPutMessage(finalMsg).catch(console.warn)
        }

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

  // ── Additional upload — to existing conversation ──────────────────
  const uploadDoc = useCallback(async (file) => {
    if (!file || isUploading || !conversationId) return
    uploadCtrl.current?.abort()
    const ctrl = new AbortController()
    uploadCtrl.current = ctrl
    setIsUploading(true); setUploadProgress(0); setError(null)

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
    } finally {
      setIsUploading(false); setUploadProgress(0)
    }
  }, [conversationId, isUploading, onDocAdded, onConversationTouched])

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
    isSending, isUploading, uploadProgress,
    isLoadingData, error,
    submitMessage, uploadFirstDoc, uploadDoc,
    retryMessage, cancelStream, cancelUpload,
    updateDocumentStatus,
    clearError: () => setError(null),
  }
}
