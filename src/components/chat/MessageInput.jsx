/**
 * MessageInput
 * ─────────────
 * - Enter sends, Shift+Enter = new line (already correct)
 * - forwardRef exposes triggerUpload() for empty state CTA
 * - Drag-drop, validation, progress, cancel stream/upload
 */
import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import './MessageInput.css'
import { Attach, Send } from '../ui/Icons.jsx'
import { validateFile, pickAllowedFile } from '../../utils/fileValidation.js'

export const MessageInput = forwardRef(function MessageInput({
  onSend, onUpload, onCancelUpload, onCancelStream,
  disabled, isUploading, uploadProgress = 0, isSending,
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

  // Enter = send, Shift+Enter = new line
  const submit = useCallback(() => {
    const t = value.trim()
    if (!t || disabled || isUploading) return
    onSend(t); setValue('')
    if (textRef.current) textRef.current.style.height = 'auto'
  }, [value, disabled, isUploading, onSend])

  const onKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
    // Shift+Enter: default textarea behaviour (new line) — no handling needed
  }

  const onInput = e => {
    setValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  const handleFile = useCallback(async file => {
    if (!file) return
    const result = await validateFile(file)
    if (!result.valid) { setBanner({ msg: result.error, type: 'error' }); return }
    if (result.warn)    setBanner({ msg: `⚠️ ${result.warn}`, type: 'warn' })
    onUpload?.(file)
  }, [onUpload])

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

  const onDragEnter = e => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }
  const onDragLeave = e => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }
  const onDragOver  = e => { e.preventDefault(); e.stopPropagation() }
  const onDrop = useCallback(async e => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false)
    const allowed    = ['.pdf', '.docx', '.txt']
    const picked     = Array.from(e.dataTransfer.files ?? []).filter(f =>
      allowed.some(ext => f.name.toLowerCase().endsWith(ext))
    )
    if (picked.length === 1) await onUpload?.(picked[0])
    else if (picked.length > 1) await onUpload?.(picked)
  }, [onUpload])

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

      {isUploading && (
        <div className="msg-input__progress">
          <div className="msg-input__progress-track">
            <div className="msg-input__progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
          <span className="msg-input__progress-label">
            Uploading{uploadProgress > 0 ? ` ${uploadProgress}%` : '…'}
          </span>
          {onCancelUpload && (
            <button className="msg-input__progress-cancel" onClick={onCancelUpload}>Cancel</button>
          )}
        </div>
      )}

      <div className="msg-input__bar">
        <button className="msg-input__icon-btn" type="button"
          title="Attach file (PDF, DOCX, TXT)"
          disabled={isUploading} onClick={() => fileRef.current?.click()}>
          <Attach />
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" multiple hidden onChange={onFileInput} />

        <textarea
          ref={textRef}
          className="msg-input__field"
          placeholder={isUploading ? 'Uploading…' : 'Message Docognix…'}
          value={value} onChange={onInput} onKeyDown={onKeyDown}
          rows={1} aria-label="Message input" disabled={isUploading}
        />

        {isSending && onCancelStream && (
          <button className="msg-input__stop" onClick={onCancelStream}
            title="Stop generating" aria-label="Stop generating">■</button>
        )}
        <button className="msg-input__send" type="button" onClick={submit}
          disabled={!value.trim() || disabled} aria-label="Send message">
          <Send />
        </button>
      </div>

      <p className="msg-input__hint" aria-hidden>
        Enter to send &nbsp;·&nbsp; Shift+Enter for new line &nbsp;·&nbsp; Drop PDF · DOCX · TXT to upload
      </p>
    </div>
  )
})
