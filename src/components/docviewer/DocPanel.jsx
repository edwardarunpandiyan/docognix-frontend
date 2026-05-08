import './DocPanel.css'
import { DocListView }    from './DocListView.jsx'
import { DocContentView } from './DocContentView.jsx'

export function DocPanel({
  isOpen, view, activeDocId, activePage, activeSnippet, activeBbox,
  documents, messages, onOpenDoc, onShowList, onClose,
}) {
  const activeDoc = documents.find(d => d.id === activeDocId) ?? null

  // Find the most recent source for this doc (for confidence pill)
  const matchedSource = (() => {
    if (!activeDocId) return null
    for (let i = messages.length - 1; i >= 0; i--) {
      const src = messages[i].metadata?.sources?.find(s => s.documentId === activeDocId)
      if (src) return src
    }
    return null
  })()

  return (
    <div className={`doc-panel${isOpen ? ' open' : ''}`} aria-hidden={!isOpen}>
      {isOpen && view === 'list' && (
        <DocListView documents={documents} onOpenDoc={onOpenDoc} onClose={onClose} />
      )}
      {isOpen && view === 'doc' && activeDoc && (
        <DocContentView
          document={activeDoc}
          page={activePage}
          snippet={activeSnippet}
          highlightBbox={activeBbox}
          matchedSource={matchedSource}
          onBack={onShowList}
          onClose={onClose}
        />
      )}
    </div>
  )
}
