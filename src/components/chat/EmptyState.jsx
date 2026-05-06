/**
 * EmptyState — contextual empty states for all scenarios
 * ──────────────────────────────────────────────────────
 * Scenarios:
 *   no-conversations  — brand new user, sidebar empty
 *   no-documents      — conversation exists but no docs uploaded yet
 *   has-documents     — docs uploaded but no messages yet
 *   upload-failed     — doc upload failed, retry available
 */
import './EmptyState.css'
import { FileAdd } from '../ui/Icons.jsx'

// ── No conversations (fresh user / cleared IDB) ────────────────────
export function NoConversationsState({ onNewChat }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">💬</div>
      <h3 className="empty-state__title">No conversations yet</h3>
      <p className="empty-state__body">
        Start by uploading a document and asking a question about it.
      </p>
      <button className="empty-state__cta" onClick={onNewChat}>
        Start your first chat
      </button>
    </div>
  )
}

// ── Conversation with no documents ────────────────────────────────
export function NoDocumentsState({ onUploadClick }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <FileAdd style={{ width: 36, height: 36, color: '#7C3AED' }} />
      </div>
      <h3 className="empty-state__title">No documents yet</h3>
      <p className="empty-state__body">
        Upload a PDF, DOCX, or TXT to get started.<br />
        Docognix will index it and let you ask questions about its content.
      </p>
      <button className="empty-state__cta" onClick={onUploadClick}>
        Upload a document
      </button>
      <p className="empty-state__hint">Or drag and drop a file anywhere in this window</p>
    </div>
  )
}

// ── Documents uploaded but no messages ────────────────────────────
export function ReadyToAskState({ documents }) {
  return (
    <div className="empty-state">
      <div className="empty-state__doc-badges">
        {documents.slice(0, 3).map(d => (
          <span key={d.id} className="empty-state__doc-badge">
            {getFileEmoji(d.filename)} {d.filename}
          </span>
        ))}
        {documents.length > 3 && (
          <span className="empty-state__doc-badge empty-state__doc-badge--more">
            +{documents.length - 3} more
          </span>
        )}
      </div>
      <h3 className="empty-state__title">
        {documents.length === 1
          ? 'Document ready — ask anything'
          : `${documents.length} documents ready — ask anything`}
      </h3>
      <p className="empty-state__body">
        Try: <em>"Summarise this document"</em> or <em>"What does it say about X?"</em>
      </p>
      <div className="empty-state__suggestions">
        {SUGGESTIONS.map((s, i) => (
          <span key={i} className="empty-state__suggestion">{s}</span>
        ))}
      </div>
    </div>
  )
}

// ── Upload failed ──────────────────────────────────────────────────
export function UploadFailedState({ filename, error, onRetry, onDismiss }) {
  return (
    <div className="empty-state empty-state--error">
      <div className="empty-state__icon">⚠️</div>
      <h3 className="empty-state__title">Upload failed</h3>
      <p className="empty-state__body">
        <strong>{filename}</strong> could not be uploaded.<br />
        <span className="empty-state__error-detail">{error}</span>
      </p>
      <div className="empty-state__actions">
        <button className="empty-state__cta" onClick={onRetry}>Try again</button>
        <button className="empty-state__cta empty-state__cta--ghost" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────
function getFileEmoji(filename = '') {
  const ext = filename.split('.').pop().toLowerCase()
  if (ext === 'pdf')  return '📄'
  if (ext === 'docx') return '📝'
  if (ext === 'txt')  return '📃'
  return '📎'
}

const SUGGESTIONS = [
  'Summarise this document',
  'What are the key findings?',
  'List the main conclusions',
  'What does it say about…',
]
