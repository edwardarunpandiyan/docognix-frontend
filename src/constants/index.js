// ── Confidence thresholds ─────────────────────────────────────────
export const CONFIDENCE_HIGH = 85
export const CONFIDENCE_MED  = 60

// ── Answer state config ───────────────────────────────────────────
export const ANSWER_STATE_CONFIG = {
  supported:      { label: 'Answer Supported by Documents',  color: '#16A34A', bgColor: '#F0FDF4', borderColor: '#86EFAC' },
  partial:        { label: 'Answer partially supported.',    color: '#D97706', bgColor: '#FFFBEB', borderColor: '#FDE68A' },
  not_relevant:   { label: 'No relevant information found',  color: '#DC2626', bgColor: '#FEF2F2', borderColor: '#FCA5A5' },
  contradiction:  { label: 'Contradiction detected',         color: '#7C3AED', bgColor: '#F5F3FF', borderColor: '#DDD6FE' },
}

// ── Document processing statuses ──────────────────────────────────
// Backend provision: POST /documents returns status='uploading'
// then transitions: uploading → extracting → chunking → embedding → ready | failed
export const DOC_STATUS = {
  UPLOADING:   'uploading',    // file being sent to server
  EXTRACTING:  'extracting',   // backend extracting text from PDF/DOCX
  CHUNKING:    'chunking',     // splitting text into chunks
  EMBEDDING:   'embedding',    // generating vector embeddings
  READY:       'ready',        // fully indexed, ready for RAG
  FAILED:      'failed',
  PROCESSING:  'processing',
  ERROR:       'error',       // processing failed
}

// Label + color for each status (used in DocStatusBadge)
export const DOC_STATUS_CONFIG = {
  processing: { label: 'Processing…', color: '#D97706', bg: '#FFFBEB', pulse: true  },
  error:      { label: 'Failed',      color: '#DC2626', bg: '#FEF2F2', pulse: false },
  uploading:  { label: 'Uploading…',   color: '#2563EB', bg: '#EFF6FF', pulse: true  },
  extracting: { label: 'Extracting…',  color: '#D97706', bg: '#FFFBEB', pulse: true  },
  chunking:   { label: 'Chunking…',    color: '#D97706', bg: '#FFFBEB', pulse: true  },
  embedding:  { label: 'Embedding…',   color: '#7C3AED', bg: '#F5F3FF', pulse: true  },
  ready:      { label: 'Ready',        color: '#16A34A', bg: '#F0FDF4', pulse: false },
  failed:     { label: 'Failed',       color: '#DC2626', bg: '#FEF2F2', pulse: false },
}

// How often to poll backend for document status (ms)
export const DOC_POLL_INTERVAL_MS = 2000

// ── IndexedDB ─────────────────────────────────────────────────────
export const IDB_NAME             = 'docognix_v1'
export const IDB_VERSION          = 1
export const STORE_CONVERSATIONS  = 'conversations'
export const STORE_MESSAGES       = 'messages'
export const STORE_DOCUMENTS      = 'documents'
export const STORE_URLS           = 'signedUrls'
export const STORE_BLOBS          = 'blobs'

// ── localStorage (identity only) ──────────────────────────────────
export const LS_ANONYMOUS_ID      = 'docognix_anonymous_id'
export const LS_USER              = 'docognix_user'

// ── Seed flag ─────────────────────────────────────────────────────
export const IDB_SEED_FLAG        = 'docognix_idb_seeded_v1'

// ── File limits ───────────────────────────────────────────────────
export const MAX_FILE_MB          = 50
export const WARN_FILE_MB         = 20

export const BREAKPOINTS          = { desktop: 1024 }
