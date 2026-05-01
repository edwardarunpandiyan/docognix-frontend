/**
 * NewChatPage — upload-first entry point
 * ───────────────────────────────────────
 * No conversation exists yet. The ONLY action available is uploading a document.
 * Conversation is created by the backend atomically with the first upload.
 *
 * Flow:
 *   1. User selects / drops a file
 *   2. onUploadFirst(file) called → POST /api/v1/documents/upload
 *   3. Backend returns { conversation_id, document_id, anonymous_id }
 *   4. Parent stores anonymous_id, adds conversation to sidebar
 *   5. navigate(/chat/{conversation_id})
 *   6. ChatPage polls doc status → unlocks chat when ready
 */
import { useState, useRef, useCallback } from 'react'
import './NewChatPage.css'
import { AppLogo }  from '../components/ui/AppLogo.jsx'
import { Menu, Attach, FileAdd } from '../components/ui/Icons.jsx'
import { validateFile, pickAllowedFile } from '../utils/fileValidation.js'

export function NewChatPage({
  onUploadFirst,      // (file: File) => Promise<void> — provided by App
  onToggleSidebar,
  sidebarVisible,
  isUploading,
  uploadProgress,
}) {
  const fileRef  = useRef(null)
  const [dragOver,  setDragOver]  = useState(false)
  const [fileErr,   setFileErr]   = useState(null)

  const handleFile = useCallback(async (file) => {
    if (!file || isUploading) return
    const result = await validateFile(file)
    if (!result.valid) { setFileErr(result.error); return }
    setFileErr(null)
    await onUploadFirst?.(file)
  }, [isUploading, onUploadFirst])

  const onFileInput = async e => {
    if (e.target.files?.[0]) await handleFile(e.target.files[0])
    e.target.value = ''
  }

  const onDragEnter = e => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = e => {
    e.preventDefault()
    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) setDragOver(false)
  }
  const onDragOver = e => e.preventDefault()
  const onDrop = useCallback(async e => {
    e.preventDefault(); setDragOver(false)
    const f = pickAllowedFile(e.dataTransfer.files)
    if (f) await handleFile(f)
  }, [handleFile])

  return (
    <div
      className={`new-chat-page${dragOver ? ' new-chat-page--drag' : ''}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="new-chat-page__drag-overlay" aria-hidden>
          <div className="new-chat-page__drag-card">
            <span style={{ fontSize: '2.5rem' }}>📂</span>
            <span className="new-chat-page__drag-title">Drop your document to start</span>
            <span className="new-chat-page__drag-sub">PDF, DOCX, or TXT · Max 50 MB</span>
          </div>
        </div>
      )}

      <header className="new-chat-page__header">
        {!sidebarVisible && (
          <button
            className="new-chat-page__header-menu"
            onClick={onToggleSidebar}
            aria-label="Open sidebar"
          >
            <Menu />
          </button>
        )}
        {!sidebarVisible && <AppLogo size="sm" showName showTag={false} />}
      </header>

      <div className="new-chat-page__body">
        <div className="new-chat-page__hero">
          <AppLogo size="xl" showName showTag className="new-chat-page__hero-brand" />
          <p className="new-chat-page__hero-sub">
            Upload a PDF, DOCX, or TXT file to get started.<br />
            Docognix retrieves the most relevant passages and cites its sources.
          </p>

          <div className="new-chat-page__tips">
            <div className="new-chat-page__tip">
              <div className="new-chat-page__tip-icon">
                <FileAdd style={{ width: 14, height: 14 }} />
              </div>
              <span className="new-chat-page__tip-text">
                <strong>Upload a document</strong> — PDF, DOCX, or TXT up to 50 MB.
                Use the 📎 button or drag &amp; drop anywhere.
              </span>
            </div>
            <div className="new-chat-page__tip">
              <div className="new-chat-page__tip-icon">
                <span style={{ fontSize: 14 }}>💬</span>
              </div>
              <span className="new-chat-page__tip-text">
                <strong>Ask anything</strong> — once your document is ready,
                ask questions and get cited answers.
              </span>
            </div>
            <div className="new-chat-page__tip">
              <div className="new-chat-page__tip-icon">
                <span style={{ fontSize: 14 }}>📌</span>
              </div>
              <span className="new-chat-page__tip-text">
                <strong>Click any source</strong> — answers cite exact passages.
                Click a filename to jump to the highlighted chunk.
              </span>
            </div>
          </div>

          {/* Upload button — primary CTA */}
          <div className="new-chat-page__upload-cta">
            {isUploading ? (
              <div className="new-chat-page__uploading">
                <div className="new-chat-page__upload-bar">
                  <div
                    className="new-chat-page__upload-fill"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="new-chat-page__upload-pct">{uploadProgress}%</span>
              </div>
            ) : (
              <button
                className="new-chat-page__upload-btn"
                type="button"
                onClick={() => fileRef.current?.click()}
              >
                <Attach style={{ width: 16, height: 16 }} />
                Upload a document to start
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt"
              hidden
              onChange={onFileInput}
            />
          </div>
        </div>
      </div>

      {fileErr && (
        <div className="new-chat-page__file-err" role="alert">
          <span>{fileErr}</span>
          <button onClick={() => setFileErr(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <p className="new-chat-page__footer-hint" aria-hidden>
        Drop PDF, DOCX, or TXT anywhere on this page
      </p>
    </div>
  )
}
