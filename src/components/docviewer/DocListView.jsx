import { useState, useMemo } from 'react'
import './DocListView.css'
import { Close, Search, DocLg, ChevronRight, GridLg } from '../ui/Icons.jsx'
import { DocStatusBadge, DocProcessingBar } from './DocStatusBadge.jsx'
import { DOC_STATUS } from '../../constants/index.js'

export function DocListView({ documents, onOpenDoc, onClose }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return documents
    return documents.filter(d => d.filename.toLowerCase().includes(q))
  }, [documents, query])

  const processingCount = documents.filter(
    d => d.status !== DOC_STATUS.READY &&
         d.status !== DOC_STATUS.FAILED &&
         d.status !== 'ready' &&
         d.status !== 'error' &&
         d.status !== 'failed'
  ).length

  return (
    <div className="doc-list">
      {/* Topbar */}
      <div className="doc-list__topbar">
        <div className="doc-list__title-row">
          <GridLg style={{ color: '#111827' }} />
          <span className="doc-list__title">
            {documents.length} Document{documents.length !== 1 ? 's' : ''}
          </span>
          {processingCount > 0 && (
            <span className="doc-list__processing-chip">
              {processingCount} processing…
            </span>
          )}
        </div>
        <button className="doc-list__close-btn" onClick={onClose} aria-label="Close panel">
          <Close />
        </button>
      </div>

      {/* Search */}
      <div className="doc-list__search">
        <div className="doc-list__search-box">
          <Search style={{ color: '#9CA3AF', flexShrink: 0 }} />
          <input
            className="doc-list__search-input"
            placeholder="Search documents…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search documents"
          />
          {query && (
            <button className="doc-list__search-clear" onClick={() => setQuery('')} aria-label="Clear">
              <Close style={{ width: 8, height: 8 }} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="doc-list__items">
        {filtered.length === 0 ? (
          <div className="doc-list__empty">No documents match "{query}"</div>
        ) : (
          filtered.map(doc => {
            const isReady      = doc.status === DOC_STATUS.READY || doc.status === 'ready' || !doc.status
            const isFailed     = doc.status === DOC_STATUS.FAILED || doc.status === 'error' || doc.status === 'failed'
            const isProcessing = !isReady && !isFailed

            return (
              <div
                key={doc.id}
                className={`doc-list__card${isProcessing ? ' doc-list__card--processing' : ''}${isFailed ? ' doc-list__card--failed' : ''}`}
              >
                <button
                  className="doc-list__card-inner"
                  onClick={() => isReady ? onOpenDoc(doc.id, 1) : undefined}
                  disabled={isProcessing || isFailed}
                  title={isFailed ? (doc.processingError ?? 'Processing failed') : undefined}
                >
                  <div className="doc-list__card-icon">
                    <DocLg style={{ color: isFailed ? '#DC2626' : isProcessing ? '#7C3AED' : '#374151' }} />
                  </div>
                  <div className="doc-list__card-body">
                    <span className="doc-list__card-name">{doc.filename}</span>
                  {doc.totalPages > 0 && (
                    <span className="doc-list__card-pages">{doc.totalPages} p.</span>
                  )}
                    <DocStatusBadge status={doc.status ?? DOC_STATUS.READY} error={doc.processingError} />
                  </div>
                  {isReady && <ChevronRight className="doc-list__card-chevron" />}
                </button>

                {/* Pipeline progress bar — shown only while processing */}
                {isProcessing && (
                  <DocProcessingBar status={doc.status} />
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="doc-list__footer">
        {documents.length} document{documents.length !== 1 ? 's' : ''}
        {query && filtered.length !== documents.length && ` · ${filtered.length} shown`}
      </div>
    </div>
  )
}
