/**
 * pdfRegistry.js — two-tier URL resolution
 * ──────────────────────────────────────────
 * Tier 1 — In-memory Map  (instant, same session)
 * Tier 2 — IndexedDB      (persistent across refreshes)
 *
 * Development (USE_SAMPLE=true):
 *   Uploaded files → Blob → createObjectURL → store File in IDB blobs
 *   After refresh  → recreate blob URL from IDB blob
 *   Static sample docs → static path, no IDB needed
 *
 * Production (USE_SAMPLE=false):
 *   Backend returns signed S3 URL + expiresAt
 *   Cache in IDB signedUrls store
 *   On expiry → re-fetch fresh signed URL from backend
 *   No blobs stored (files live on S3)
 */
import { dbStoreBlob, dbGetBlob, dbDeleteBlob, dbPutSignedUrl, dbGetSignedUrl, dbDeleteSignedUrl } from './db.js'

const urlRegistry  = new Map() // docId → string URL
const fileRegistry = new Map() // docId → File (dev only)

// ── Static / sample doc paths ─────────────────────────────────────
export function registerStaticUrl(docId, url) {
  urlRegistry.set(docId, url)
}

// ── Dev: uploaded File → blob URL + IDB persistence ──────────────
export async function registerUploadedFile(docId, file) {
  const prev = urlRegistry.get(docId)
  if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
  const url = URL.createObjectURL(file)
  urlRegistry.set(docId, url)
  fileRegistry.set(docId, file)
  dbStoreBlob(docId, file).catch(e => console.warn('[Registry] blob store failed', e))
  return url
}

// ── Prod: register signed URL from backend ────────────────────────
export async function registerSignedUrl(docId, url, expiresAt) {
  urlRegistry.set(docId, url)
  await dbPutSignedUrl(docId, url, expiresAt).catch(e => console.warn('[Registry] signedUrl store failed', e))
}

// ── Swap temp ID → server ID after upload ────────────────────────
export async function reRegisterWithServerId(tempId, realId) {
  const url  = urlRegistry.get(tempId)
  const file = fileRegistry.get(tempId)
  if (url)  urlRegistry.set(realId, url)
  if (file) fileRegistry.set(realId, file)
  urlRegistry.delete(tempId)
  fileRegistry.delete(tempId)
  if (file) {
    await dbStoreBlob(realId, file).catch(() => {})
    await dbDeleteBlob(tempId).catch(() => {})
  }
}

// ── Main resolution — async, checks IDB ──────────────────────────
/**
 * Resolve a document URL.
 *
 * Priority:
 *  1. In-memory (instant — covers current session)
 *  2. IDB signedUrls (production cache, checks expiry)
 *  3. IDB blobs (dev — recreate blob URL from stored File)
 *  4. serverUrl fallback (provided by caller from document metadata)
 *
 * @param {string} docId
 * @param {string} [serverUrl]    — doc.fileUrl from document metadata
 * @param {string} [expiresAt]   — doc.fileUrlExpiresAt
 * @returns {Promise<string|null>}
 */
export async function getOrRestoreDocUrl(docId, serverUrl = null, expiresAt = null) {
  // 1. Memory
  const cached = urlRegistry.get(docId)
  if (cached) return cached

  // 2. Signed URL cache (production)
  try {
    const record = await dbGetSignedUrl(docId)
    if (record?.url) {
      const expired = record.expiresAt && new Date(record.expiresAt) <= new Date()
      if (!expired) {
        urlRegistry.set(docId, record.url)
        return record.url
      }
      // Expired — clear it, fall through to fetch fresh
      await dbDeleteSignedUrl(docId).catch(() => {})
    }
  } catch {}

  // 3. IDB blob (dev — file survived refresh)
  try {
    const record = await dbGetBlob(docId)
    if (record?.blob) {
      const url = URL.createObjectURL(record.blob)
      urlRegistry.set(docId, url)
      if (record.blob instanceof File) fileRegistry.set(docId, record.blob)
      return url
    }
  } catch {}

  // 4. Server URL fallback
  //    In dev: fileUrl is a static path like '/harvardmini.pdf'
  //    In prod: fileUrl is a signed S3 URL returned by the backend
  if (serverUrl) {
    urlRegistry.set(docId, serverUrl)
    if (expiresAt) {
      await dbPutSignedUrl(docId, serverUrl, expiresAt).catch(() => {})
    }
    return serverUrl
  }

  return null
}

export function getDocUrl(docId) { return urlRegistry.get(docId) ?? null }
export function getDocFile(docId) { return fileRegistry.get(docId) ?? null }

export async function revokeDocUrl(docId) {
  const url = urlRegistry.get(docId)
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  urlRegistry.delete(docId)
  fileRegistry.delete(docId)
  await Promise.all([dbDeleteBlob(docId), dbDeleteSignedUrl(docId)]).catch(() => {})
}
