/**
 * db.js — IndexedDB layer
 * ─────────────────────────
 * Store names use finalised naming:
 *   conversations  (was: sessions)
 *   messages
 *   documents
 *   signedUrls
 *   blobs
 */
import {
  IDB_NAME, IDB_VERSION,
  STORE_CONVERSATIONS, STORE_MESSAGES, STORE_DOCUMENTS,
  STORE_URLS, STORE_BLOBS,
} from '../constants/index.js'

let _dbPromise = null

function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const ms = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' })
        ms.createIndex('by_conversation', 'conversationId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_DOCUMENTS)) {
        const ds = db.createObjectStore(STORE_DOCUMENTS, { keyPath: 'id' })
        ds.createIndex('by_conversation', 'conversationId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_URLS)) {
        db.createObjectStore(STORE_URLS, { keyPath: 'docId' })
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'docId' })
      }
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror   = (e) => { _dbPromise = null; reject(e.target.error) }
    req.onblocked = ()  => console.warn('[IDB] Upgrade blocked — close other tabs')
  })
  return _dbPromise
}

function wrap(req) {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
}

async function store(name, mode) {
  const db = await openDB()
  return db.transaction(name, mode).objectStore(name)
}

// ── Conversations ─────────────────────────────────────────────────
export async function dbGetAllConversations() {
  const s   = await store(STORE_CONVERSATIONS, 'readonly')
  const all = await wrap(s.getAll())
  return all.sort((a, b) => new Date(b.updatedAt ?? b.createdAt) - new Date(a.updatedAt ?? a.createdAt))
}

export async function dbPutConversation(conv) {
  return wrap((await store(STORE_CONVERSATIONS, 'readwrite')).put(conv))
}

export async function dbDeleteConversation(id) {
  return wrap((await store(STORE_CONVERSATIONS, 'readwrite')).delete(id))
}

// ── Messages ──────────────────────────────────────────────────────
export async function dbGetMessages(conversationId) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const req = db.transaction(STORE_MESSAGES, 'readonly')
      .objectStore(STORE_MESSAGES)
      .index('by_conversation')
      .getAll(conversationId)
    req.onsuccess = () => res(req.result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)))
    req.onerror   = () => rej(req.error)
  })
}

export async function dbPutMessage(msg) {
  if (!msg.conversationId) throw new Error('[IDB] message missing conversationId')
  return wrap((await store(STORE_MESSAGES, 'readwrite')).put(msg))
}

export async function dbDeleteMessage(id) {
  return wrap((await store(STORE_MESSAGES, 'readwrite')).delete(id))
}

export async function dbDeleteMessagesByConversation(conversationId) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const t   = db.transaction(STORE_MESSAGES, 'readwrite')
    const req = t.objectStore(STORE_MESSAGES).index('by_conversation').openCursor(conversationId)
    req.onsuccess = () => { const c = req.result; if (c) { c.delete(); c.continue() } }
    t.oncomplete = res; t.onerror = () => rej(t.error)
  })
}

export async function dbBulkPutMessages(messages) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const t = db.transaction(STORE_MESSAGES, 'readwrite')
    const s = t.objectStore(STORE_MESSAGES)
    messages.forEach(m => {
      if (!m.conversationId) throw new Error('[IDB] bulk message missing conversationId')
      s.put(m)
    })
    t.oncomplete = res; t.onerror = () => rej(t.error)
  })
}

// ── Documents ─────────────────────────────────────────────────────
export async function dbGetDocuments(conversationId) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const req = db.transaction(STORE_DOCUMENTS, 'readonly')
      .objectStore(STORE_DOCUMENTS)
      .index('by_conversation')
      .getAll(conversationId)
    req.onsuccess = () => res(req.result)
    req.onerror   = () => rej(req.error)
  })
}

export async function dbPutDocument(doc) {
  if (!doc.conversationId) throw new Error('[IDB] document missing conversationId')
  return wrap((await store(STORE_DOCUMENTS, 'readwrite')).put(doc))
}

export async function dbDeleteDocumentsByConversation(conversationId) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const t   = db.transaction(STORE_DOCUMENTS, 'readwrite')
    const req = t.objectStore(STORE_DOCUMENTS).index('by_conversation').openCursor(conversationId)
    req.onsuccess = () => { const c = req.result; if (c) { c.delete(); c.continue() } }
    t.oncomplete = res; t.onerror = () => rej(t.error)
  })
}

// ── Signed URLs ───────────────────────────────────────────────────
export async function dbPutSignedUrl(docId, url, expiresAt) {
  return wrap((await store(STORE_URLS, 'readwrite')).put({ docId, url, expiresAt }))
}

export async function dbGetSignedUrl(docId) {
  try { return await wrap((await store(STORE_URLS, 'readonly')).get(docId)) }
  catch { return null }
}

export async function dbDeleteSignedUrl(docId) {
  try { return await wrap((await store(STORE_URLS, 'readwrite')).delete(docId)) }
  catch {}
}

// ── Blobs ─────────────────────────────────────────────────────────
export async function dbStoreBlob(docId, file) {
  return wrap((await store(STORE_BLOBS, 'readwrite')).put({ docId, blob: file, filename: file.name }))
}

export async function dbGetBlob(docId) {
  try { return await wrap((await store(STORE_BLOBS, 'readonly')).get(docId)) }
  catch { return null }
}

export async function dbDeleteBlob(docId) {
  try { return await wrap((await store(STORE_BLOBS, 'readwrite')).delete(docId)) }
  catch {}
}
