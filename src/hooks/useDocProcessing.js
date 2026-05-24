/**
 * useDocProcessing — polls document status until ready or error
 *
 * Polls GET /api/v1/conversations/{id}/documents/{docId}/status
 * every DOC_POLL_INTERVAL_MS until status is 'ready' or 'error'.
 *
 * Terminal statuses: ready, error, failed
 * Polling statuses:  processing (backend generic), extracting, chunking, embedding
 */
import { useEffect, useRef, useCallback } from 'react'
import { DOC_STATUS, DOC_POLL_INTERVAL_MS } from '../constants/index.js'
import { dbPutDocument } from '../utils/db.js'
import { apiGetDocumentStatus } from '../api/chatApi.js'

function isTerminalStatus(status) {
  return (
    status === DOC_STATUS.READY  ||
    status === DOC_STATUS.FAILED ||
    status === DOC_STATUS.ERROR  ||
    status === 'ready'           ||
    status === 'error'           ||
    status === 'failed'
  )
}

export function useDocProcessing(documents, conversationId, onDocumentUpdated) {
  const pollingRef = useRef(new Set())
  const cancelRef  = useRef(new Set())

  const isTerminal = useCallback(isTerminalStatus, [])

  useEffect(() => {
    // Poll any doc that is not terminal and not stuck in 'uploading'
    const toProcess = documents.filter(
      d => !isTerminal(d.status) && d.status !== DOC_STATUS.UPLOADING
    )

    for (const doc of toProcess) {
      if (pollingRef.current.has(doc.id)) continue
      pollingRef.current.add(doc.id)
      cancelRef.current.delete(doc.id)

      const poll = async () => {
        try {
          while (!cancelRef.current.has(doc.id)) {
            await new Promise(r => setTimeout(r, DOC_POLL_INTERVAL_MS))
            if (cancelRef.current.has(doc.id)) break

            const result = await apiGetDocumentStatus(conversationId, doc.id)
            const status = result.status

            const patch = {
              status,
              chunkCount: result.chunk_count ?? 0,
              // page_count and word_count now returned by status endpoint
              // so totalPages is available the moment a doc becomes ready —
              // no extra API call needed.
              totalPages: result.page_count  ?? 0,
              wordCount:  result.word_count  ?? 0,
              ...(result.error_message ? { processingError: result.error_message } : {}),
            }

            onDocumentUpdated(doc.id, patch)
            await dbPutDocument({ ...doc, ...patch }).catch(console.warn)

            if (isTerminal(status)) {
              pollingRef.current.delete(doc.id)
              break
            }
          }
        } catch (err) {
          console.warn('[DocProcessing] Poll error for', doc.id, err.message)
          onDocumentUpdated(doc.id, {
            status: DOC_STATUS.FAILED,
            processingError: err.message,
          })
          pollingRef.current.delete(doc.id)
        }
      }
      poll()
    }

    return () => {
      const currentIds = new Set(documents.map(d => d.id))
      for (const id of pollingRef.current) {
        if (!currentIds.has(id)) {
          cancelRef.current.add(id)
          pollingRef.current.delete(id)
        }
      }
    }
  }, [documents, conversationId, onDocumentUpdated, isTerminal])
}
