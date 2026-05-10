// ── Document statuses ─────────────────────────────────────────────
// Backend transitions: processing → ready | error
// Frontend sub-statuses used in DocProcessingBar: uploading | extracting | chunking | embedding
export const DOC_STATUS = {
  UPLOADING:   'uploading',
  PROCESSING:  'processing',  // generic backend status during ingest
  EXTRACTING:  'extracting',
  CHUNKING:    'chunking',
  EMBEDDING:   'embedding',
  READY:       'ready',
  FAILED:      'failed',
  ERROR:       'error',       // backend error variant
}

// Label + color for each status (used in DocStatusBadge)
export const DOC_STATUS_CONFIG = {
  uploading:  { label: 'Uploading…',   color: '#2563EB', bg: '#EFF6FF', pulse: true  },
  processing: { label: 'Processing…',  color: '#D97706', bg: '#FFFBEB', pulse: true  },
  extracting: { label: 'Extracting…',  color: '#D97706', bg: '#FFFBEB', pulse: true  },
  chunking:   { label: 'Chunking…',    color: '#D97706', bg: '#FFFBEB', pulse: true  },
  embedding:  { label: 'Embedding…',   color: '#7C3AED', bg: '#F5F3FF', pulse: true  },
  ready:      { label: 'Ready',        color: '#16A34A', bg: '#F0FDF4', pulse: false },
  failed:     { label: 'Failed',       color: '#DC2626', bg: '#FEF2F2', pulse: false },
  error:      { label: 'Failed',       color: '#DC2626', bg: '#FEF2F2', pulse: false },
}

// How often to poll backend for document status (ms)
export const DOC_POLL_INTERVAL_MS = 2000

// ── File limits ───────────────────────────────────────────────────
export const MAX_FILE_MB  = 50
export const WARN_FILE_MB = 20

// ── IndexedDB ─────────────────────────────────────────────────────
export const IDB_NAME             = 'docognix_v1'
export const IDB_VERSION          = 1
export const STORE_CONVERSATIONS  = 'conversations'
export const STORE_MESSAGES       = 'messages'
export const STORE_DOCUMENTS      = 'documents'
export const STORE_URLS           = 'signedUrls'
export const STORE_BLOBS          = 'blobs'
