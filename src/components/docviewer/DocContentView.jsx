/**
 * DocContentView — async URL resolution + bbox highlight support
 */
import { useState, useEffect, useMemo } from 'react'
import './DocContentView.css'
import { Back, Close, DocSm, Eye } from '../ui/Icons.jsx'
import { getConfidenceStyle } from '../../utils/helpers.js'
import { getOrRestoreDocUrl, getDocFile } from '../../utils/pdfRegistry.js'
import { PdfViewer }  from './viewers/PdfViewer.jsx'
import { DocxViewer } from './viewers/DocxViewer.jsx'
import { TxtViewer }  from './viewers/TxtViewer.jsx'

function getFileType(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  if (ext === 'pdf')                return 'pdf'
  if (ext === 'docx' || ext === 'doc') return 'docx'
  if (ext === 'txt'  || ext === 'md')  return 'txt'
  return 'unknown'
}

export function DocContentView({
  document, page, snippet, highlightBbox,
  matchedSource, onBack, onClose,
}) {
  const cs = matchedSource ? getConfidenceStyle(matchedSource.confidence) : null

  const [fileUrl,     setFileUrl]     = useState(null)
  const [fileObj,     setFileObj]     = useState(null)
  const [isRestoring, setIsRestoring] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function resolve() {
      setIsRestoring(true)
      const url  = await getOrRestoreDocUrl(document.id, document.fileUrl ?? null, document.fileUrlExpiresAt ?? null)
      const file = getDocFile(document.id)
      if (!cancelled) { setFileUrl(url); setFileObj(file); setIsRestoring(false) }
    }
    resolve()
    return () => { cancelled = true }
  }, [document.id, document.fileUrl, document.fileUrlExpiresAt])

  const fileType    = useMemo(() => getFileType(document.filename), [document.filename])
  const displayPage = page ?? matchedSource?.page ?? null

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
          page={displayPage ?? 1}
          snippet={snippet ?? null}
          highlightBbox={highlightBbox ?? null}
        />
      )
    }
    if (fileType === 'docx')
      return <DocxViewer file={fileObj ?? null} url={fileObj ? null : fileUrl} snippet={snippet ?? null} />
    if (fileType === 'txt')
      return <TxtViewer  file={fileObj ?? null} url={fileObj ? null : fileUrl} snippet={snippet ?? null} />

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
        <button className="doc-content__back-btn" onClick={onBack} aria-label="Back to list"><Back /></button>
        <div className="doc-content__crumb">
          <DocSm className="doc-content__crumb-icon" />
          <span className="doc-content__crumb-name">{document.filename}</span>
          {displayPage && <><span className="doc-content__crumb-sep">·</span><span className="doc-content__crumb-page">Page {displayPage}{document.totalPages > 1 ? ` of ${document.totalPages}` : ""}</span></> }
          {(snippet || highlightBbox) && (
            <span className="doc-content__crumb-hl-badge">
              {highlightBbox ? '📍 Pinpointed' : 'Highlighted'}
            </span>
          )}
        </div>
        {cs && (
          <div className="doc-content__conf-pill" style={{ background: cs.bg, borderColor: cs.border }}>
            <Eye eyeColor={cs.color} />
            <span className="doc-content__conf-pct" style={{ color: cs.color }}>{matchedSource.confidence}%</span>
          </div>
        )}
        <button className="doc-content__close-btn" onClick={onClose} aria-label="Close panel"><Close /></button>
      </div>
      <div className="doc-content__viewer">{renderViewer()}</div>
    </div>
  )
}
