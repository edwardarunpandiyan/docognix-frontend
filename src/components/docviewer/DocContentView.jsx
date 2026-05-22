/**
 * DocContentView — zoom + fullscreen + async URL resolution + bbox highlight
 *
 * Zoom:
 *   zoomLevel state (default 1.0, steps 0.25, range 0.5–2.0)
 *   Resets to 1.0 when document changes.
 *   PDF:  scale prop → PDF.js re-renders canvas (crisp)
 *   TXT:  fontSize prop → scales font-size (crisp)
 *   DOCX: zoom prop → CSS transform: scale() (good)
 *
 * Fullscreen:
 *   isFullscreen / onToggleFullscreen passed from DocPanel.
 *   Button hidden on tablet/mobile via CSS (already full-screen there).
 */
import { useState, useEffect, useMemo } from 'react'
import './DocContentView.css'
import { Back, Close, DocSm, Eye, Expand, Collapse, ZoomIn, ZoomOut } from '../ui/Icons.jsx'
import { getConfidenceStyle }  from '../../utils/helpers.js'
import { getOrRestoreDocUrl, getDocFile, registerUploadedFile } from '../../utils/pdfRegistry.js'
import { apiGetDocumentUrl }   from '../../api/chatApi.js'
import { PdfViewer }           from './viewers/PdfViewer.jsx'
import { DocxViewer }          from './viewers/DocxViewer.jsx'
import { TxtViewer }           from './viewers/TxtViewer.jsx'

const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]
const ZOOM_DEFAULT = 1.0

function getFileType(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  if (ext === 'pdf')                  return 'pdf'
  if (ext === 'docx' || ext === 'doc') return 'docx'
  if (ext === 'txt'  || ext === 'md')  return 'txt'
  return 'unknown'
}

export function DocContentView({
  document, page, snippet, highlightBbox,
  matchedSource, onBack, onClose,
  isFullscreen = false, onToggleFullscreen,
}) {
  const cs = matchedSource ? getConfidenceStyle(matchedSource.confidence) : null

  const [fileUrl,     setFileUrl]     = useState(null)
  const [fileObj,     setFileObj]     = useState(null)
  const [isRestoring, setIsRestoring] = useState(true)
  const [zoomLevel,   setZoomLevel]   = useState(ZOOM_DEFAULT)
  const [currentPage, setCurrentPage] = useState(1)

  // Reset zoom + page when document changes
  useEffect(() => {
    setZoomLevel(ZOOM_DEFAULT)
    setCurrentPage(page ?? 1)
  }, [document.id, page])

  // Resolve file URL (5-tier: memory → IDB signedUrl → IDB blob → doc.fileUrl → backend)
  useEffect(() => {
    let cancelled = false
    async function resolve() {
      setIsRestoring(true)
      let url  = await getOrRestoreDocUrl(document.id, document.fileUrl ?? null, document.fileUrlExpiresAt ?? null)
      const file = getDocFile(document.id)

      if (!url && document.conversationId) {
        try {
          const res = await apiGetDocumentUrl(document.conversationId, document.id)
          if (res?.objectUrl) {
            url = res.objectUrl
            if (res.blob) {
              const f = new File([res.blob], document.filename ?? 'document', { type: res.blob.type })
              await registerUploadedFile(document.id, f)
            }
          }
        } catch { /* silently skip */ }
      }

      if (!cancelled) { setFileUrl(url); setFileObj(file); setIsRestoring(false) }
    }
    resolve()
    return () => { cancelled = true }
  }, [document.id, document.conversationId, document.fileUrl, document.fileUrlExpiresAt])

  const fileType    = useMemo(() => getFileType(document.filename), [document.filename])
  const displayPage = currentPage

  // Zoom helpers
  const zoomIdx    = ZOOM_STEPS.indexOf(zoomLevel)
  const canZoomIn  = zoomIdx < ZOOM_STEPS.length - 1
  const canZoomOut = zoomIdx > 0
  const zoomIn  = () => { if (canZoomIn)  setZoomLevel(ZOOM_STEPS[zoomIdx + 1]) }
  const zoomOut = () => { if (canZoomOut) setZoomLevel(ZOOM_STEPS[zoomIdx - 1]) }
  const zoomPct = `${Math.round(zoomLevel * 100)}%`

  function renderViewer() {
    if (isRestoring) {
      return (
        <div className="doc-content__restoring">
          <div className="doc-content__restoring-spin" />
          <span>Loading document…</span>
        </div>
      )
    }
    if (fileType === 'pdf' && fileUrl) {
      return (
        <PdfViewer
          url={fileUrl}
          page={page ?? matchedSource?.page ?? 1}
          snippet={snippet ?? null}
          highlightBbox={highlightBbox ?? null}
          zoom={zoomLevel}
          onPageChange={setCurrentPage}
        />
      )
    }
    if (fileType === 'docx')
      return <DocxViewer file={fileObj ?? null} url={fileObj ? null : fileUrl} snippet={snippet ?? null} fontSize={14 * zoomLevel} totalPages={document.totalPages ?? 1} onPageChange={setCurrentPage} />
    if (fileType === 'txt')
      return <TxtViewer  file={fileObj ?? null} url={fileObj ? null : fileUrl} snippet={snippet ?? null} fontSize={14 * zoomLevel} totalPages={document.totalPages ?? 1} onPageChange={setCurrentPage} />

    return (
      <div className="doc-content__no-preview">
        <DocSm style={{ width: 32, height: 32, color: '#CBD5E1' }} />
        <p className="doc-content__no-preview-text">
          No preview available.<br />Connect a backend to serve the file.
        </p>
      </div>
    )
  }

  return (
    <div className="doc-content">
      <div className="doc-content__topbar">
        {/* Back */}
        <button className="doc-content__back-btn" onClick={onBack} aria-label="Back to list"><Back /></button>

        {/* Breadcrumb */}
        <div className="doc-content__crumb">
          <DocSm className="doc-content__crumb-icon" />
          <span className="doc-content__crumb-name">{document.filename}</span>
          <span className="doc-content__crumb-sep">·</span>
          <span className="doc-content__crumb-page">
            Page {currentPage}{document.totalPages > 1 ? ` of ${document.totalPages}` : ''}
          </span>
          {(snippet || highlightBbox) && (
            <span className="doc-content__crumb-hl-badge">
              {highlightBbox ? '📍 Pinpointed' : 'Highlighted'}
            </span>
          )}
        </div>

        {/* Confidence pill */}
        {cs && (
          <div className="doc-content__conf-pill" style={{ background: cs.bg, borderColor: cs.border }}>
            <Eye eyeColor={cs.color} />
            <span className="doc-content__conf-pct" style={{ color: cs.color }}>{matchedSource.confidence}%</span>
          </div>
        )}

        {/* Zoom controls — HIDDEN until zoom is fully fixed
        <div className="doc-content__zoom">
          <button className="doc-content__zoom-btn" onClick={zoomOut} disabled={!canZoomOut} aria-label="Zoom out" title="Zoom out"><ZoomOut /></button>
          <span className="doc-content__zoom-label" title="Current zoom">{zoomPct}</span>
          <button className="doc-content__zoom-btn" onClick={zoomIn} disabled={!canZoomIn} aria-label="Zoom in" title="Zoom in"><ZoomIn /></button>
        </div>
        */}

        {/* Fullscreen toggle — desktop only (hidden via CSS on tablet/mobile) */}
        <button
          className="doc-content__fullscreen-btn"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Collapse /> : <Expand />}
        </button>

        {/* Close */}
        <button className="doc-content__close-btn" onClick={onClose} aria-label="Close panel"><Close /></button>
      </div>

      <div className="doc-content__viewer">{renderViewer()}</div>
    </div>
  )
}
