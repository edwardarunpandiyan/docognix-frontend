/**
 * useChatSessions — conversation list, IDB-backed, synced with backend
 */
import { useState, useCallback, useEffect } from 'react'
import { getAnonymousId } from '../utils/identity.js'
import {
  dbGetAllConversations, dbPutConversation, dbDeleteConversation,
  dbDeleteMessagesByConversation, dbDeleteDocumentsByConversation,
} from '../utils/db.js'
import { apiGetConversations, apiDeleteConversation, apiRenameConversation } from '../api/chatApi.js'

export function useChatSessions() {
  const [conversations, setConversations] = useState([])
  const [isLoading,     setIsLoading]     = useState(true)

  useEffect(() => {
    let cancelled = false

    async function init() {
      // Load from IDB first for instant render
      const cached = await dbGetAllConversations()
      if (!cancelled) {
        setConversations(cached)
        setIsLoading(false)
      }

      // Sync from backend if anonymous_id exists
      if (!cancelled) {
        const anonymousId = getAnonymousId()
        if (!anonymousId) return

        try {
          const { conversations: fresh } = await apiGetConversations(anonymousId)
          if (cancelled) return
          for (const c of fresh) await dbPutConversation(normalise(c))
          if (!cancelled) setConversations(await dbGetAllConversations())
        } catch (e) {
          console.warn('[Conversations] backend sync failed:', e.message)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  // Called by useSessionChat after first upload — adds conversation to sidebar
  const addConversation = useCallback(async (conv) => {
    const n = normalise(conv)
    await dbPutConversation(n)
    setConversations(prev => {
      if (prev.find(c => c.id === n.id)) return prev
      return [n, ...prev]
    })
  }, [])

  // Called when SSE title event arrives
  const renameConversation = useCallback(async (id, title) => {
    if (!id || !title) return
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
    const all    = await dbGetAllConversations()
    const target = all.find(c => c.id === id)
    if (target) await dbPutConversation({ ...target, title })
    apiRenameConversation(id, title).catch(() => {})
  }, [])

  const deleteConversation = useCallback(async (id) => {
    setConversations(prev => prev.filter(c => c.id !== id))
    await Promise.all([
      dbDeleteConversation(id),
      dbDeleteMessagesByConversation(id),
      dbDeleteDocumentsByConversation(id),
    ])
    apiDeleteConversation(id).catch(() => {})
  }, [])

  const incrementDocCount = useCallback(async (id) => {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, docCount: (c.docCount ?? 0) + 1 } : c)
    )
    const all    = await dbGetAllConversations()
    const target = all.find(c => c.id === id)
    if (target) await dbPutConversation({ ...target, docCount: (target.docCount ?? 0) + 1 })
  }, [])

  const touchConversation = useCallback(async (id) => {
    const now = new Date().toISOString()
    setConversations(prev =>
      prev
        .map(c => c.id === id ? { ...c, updatedAt: now } : c)
        .sort((a, b) => new Date(b.updatedAt ?? b.createdAt) - new Date(a.updatedAt ?? a.createdAt))
    )
    const all    = await dbGetAllConversations()
    const target = all.find(c => c.id === id)
    if (target) await dbPutConversation({ ...target, updatedAt: now })
  }, [])

  return {
    history:          conversations,
    isLoading,
    addConversation,
    createSession:    () => { /* no-op — conversations created on first upload */ },
    renameSession:    renameConversation,
    deleteSession:    deleteConversation,
    incrementDocCount,
    touchSession:     touchConversation,
  }
}

function normalise(c) {
  return {
    id:          c.conversation_id ?? c.id,
    title:       c.title       ?? 'New Chat',
    anonymousId: c.anonymous_id ?? c.anonymousId ?? '',
    userId:      c.user_id     ?? c.userId       ?? null,
    docCount:    c.document_count ?? c.docCount  ?? 0,
    createdAt:   c.created_at  ?? c.createdAt    ?? new Date().toISOString(),
    updatedAt:   c.updated_at  ?? c.updatedAt    ?? new Date().toISOString(),
  }
}
