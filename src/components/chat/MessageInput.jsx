/**
 * MessageInput
 * ─────────────
 * - Enter sends, Shift+Enter = new line
 * - forwardRef exposes triggerUpload() for empty state CTA
 * - Drag-drop, validation, progress, cancel stream/upload
 * - Blocked (textarea + send disabled) until at least one doc is ready
 * - Multi-file upload: file picker and drag-drop both accept multiple files
 */
import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import './MessageInput.css'
import { Attach, Send } from '../ui/Icons.jsx'
import { validateFile } from '../../utils/fileValidation.js'

export const MessageInput = forwardRef(function MessageInput({
  onSend, onUpload, onCancelUpload, onCancelStream,
  disabled, isUploading, uploadProgress = 0, isSending,
  hasReadyDoc = false, isProcessing = false,
  uploadBatchIdx = 0, uploadBatchTotal = 0,
}, ref) {
  const [value,    setValue]    = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [banner,   setBanner]   = useState(null)
  const textRef  = useRef(null)
  const fileRef  = useRef(null)
  const errTimer = useRef(null)

  // Expose triggerUpload() to parent via ref
  // Used by NoDocumentsState CTA button
  useImperativeHandle(ref, () => ({
    triggerUpload: () => fileRef.current?.click(),
  }))

  useEffect(() => {
    if (!banner) return
    clearTimeout(errTimer.current)
    errTimer.current = setTimeout(() => setBanner(null), 6000)
    return () => clearTimeout(errTimer.current)
  }, [banner])

  // Textarea and send are blocked until a doc is ready
  const inputBlocked = isProcessing || !hasReadyDoc

  const submit = useCallback(() => {
    const t = value.trim()
    if (!t || disabled || isUploading || inputBlocked) return
    onSend(t); setValue('')
    if (textRef.current) textRef.current.style.height = 'auto'
  }, [value, disabled, isUploading, inputBlocked, onSend])

  const onKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const onInput = e => {
    setValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  // ── Multi-file picker ────────────────────────────────────────────
  // Accepts multiple files; filters to allowed extensions; passes
  // single File or File[] to onUpload (uploadDoc handles sequencing)
  const onFileInput = async e => {
    const files = e.target.files
    if (!files?.length) { e.target.value = ''; return }
    const allowed = ['.pdf', '.docx', '.txt']
    const picked  = Array.from(files).filter(f =>
      allowed.some(ext => f.name.toLowerCase().endsWith(ext))
    )
    if (picked.length === 1) await onUpload?.(picked[0])
    else if (picked.length > 1) await onUpload?.(picked)
    e.target.value = ''
  }

  // ── Drag-drop ────────────────────────────────────────────────────
  const onDragEnter = e => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }
  const onDragLeave = e => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }
  const onDragOver  = e => { e.preventDefault(); e.stopPropagation() }
  const onDrop = useCallback(async e => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false)
    const allowed = ['.pdf', '.docx', '.txt']
    const picked  = Array.from(e.dataTransfer.files ?? []).filter(f =>
      allowed.some(ext => f.name.toLowerCase().endsWith(ext))
    )
    if (picked.length === 1) await onUpload?.(picked[0])
    else if (picked.length > 1) await onUpload?.(picked)
  }, [onUpload])

  // ── Labels ───────────────────────────────────────────────────────
  const batchLabel = uploadBatchTotal > 1
    ? ` (${uploadBatchIdx} of ${uploadBatchTotal})`
    : ''
  const processingLabel = isUploading
    ? `Uploading${batchLabel}${uploadProgress > 0 ? ` — ${uploadProgress}%` : '…'}`
    : 'Processing document — please wait…'

  const placeholderText = isUploading
    ? 'Uploading…'
    : isProcessing
      ? 'Waiting for document to be ready…'
      : 'Message Docognix…'

  return (
    <div
      className={`msg-input${dragOver ? ' msg-input--drag' : ''}`}
      onDragEnter={onDragEnter} onDragLeave={onDragLeave}
      onDragOver={onDragOver}   onDrop={onDrop}
    >
      {dragOver && (
        <div className="msg-input__drag-overlay" aria-hidden>
          <span>Drop to upload · PDF, DOCX, TXT</span>
        </div>
      )}

      {banner && (
        <div className={`msg-input__banner msg-input__banner--${banner.type}`} role="alert">
          <span>{banner.msg}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Processing / upload status bar — shown while any doc is not yet ready */}
      {(isUploading || isProcessing) && (
        <div className="msg-input__processing">
          <span className="msg-input__processing-spinner" aria-hidden />
          {isUploading ? (
            <>
              <div className="msg-input__progress-track">
                <div className="msg-input__progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <span className="msg-input__processing-label">{processingLabel}</span>
              {onCancelUpload && (
                <button className="msg-input__progress-cancel" onClick={onCancelUpload}>Cancel</button>
              )}
            </>
          ) : (
            <span className="msg-input__processing-label">{processingLabel}</span>
          )}
        </div>
      )}

      <div className={`msg-input__bar${inputBlocked ? ' msg-input__bar--blocked' : ''}`}>
        <button className="msg-input__icon-btn" type="button"
          title="Attach file (PDF, DOCX, TXT)"
          disabled={isUploading} onClick={() => fileRef.current?.click()}>
          <Attach />
        </button>
        {/* multiple — allows selecting several files at once from picker */}
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" multiple hidden onChange={onFileInput} />

        <textarea
          ref={textRef}
          className="msg-input__field"
          placeholder={placeholderText}
          value={value} onChange={onInput} onKeyDown={onKeyDown}
          rows={1} aria-label="Message input"
          disabled={isUploading || inputBlocked}
        />

        {isSending && onCancelStream && (
          <button className="msg-input__stop" onClick={onCancelStream}
            title="Stop generating" aria-label="Stop generating">■</button>
        )}
        <button className="msg-input__send" type="button" onClick={submit}
          disabled={!value.trim() || disabled || inputBlocked} aria-label="Send message">
          <Send />
        </button>
      </div>

      <p className="msg-input__hint" aria-hidden>
        {inputBlocked
          ? 'Querying will be enabled once the document is ready'
          : 'Enter to send \u00A0·\u00A0 Shift+Enter for new line \u00A0·\u00A0 Drop PDF · DOCX · TXT to upload'}
      </p>
    </div>
  )
})
