import { useState } from 'react'
import './DocPanel.css'
import { DocListView }    from './DocListView.jsx'
import { DocContentView } from './DocContentView.jsx'

export function DocPanel({
  isOpen, view, activeDocId, activePage, activeSnippet, activeBbox,
  documents, messages, onOpenDoc, onShowList, onClose,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const activeDoc = documents.find(d => d.id === activeDocId) ?? null

  const matchedSource = (() => {
    if (!activeDocId) return null
    for (let i = messages.length - 1; i >= 0; i--) {
      const src = messages[i].metadata?.sources?.find(s => s.documentId === activeDocId)
      if (src) return src
    }
    return null
  })()

  // Exit fullscreen automatically when user navigates back to list
  const handleShowList = () => {
    setIsFullscreen(false)
    onShowList?.()
  }

  const handleClose = () => {
    setIsFullscreen(false)
    onClose?.()
  }

  return (
    <div
      className={[
        'doc-panel',
        isOpen       ? 'open'       : '',
        isFullscreen ? 'doc-panel--fullscreen' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden={!isOpen}
    >
      {isOpen && view === 'list' && (
        <DocListView documents={documents} onOpenDoc={onOpenDoc} onClose={handleClose} />
      )}
      {isOpen && view === 'doc' && activeDoc && (
        <DocContentView
          document={activeDoc}
          page={activePage}
          snippet={activeSnippet}
          highlightBbox={activeBbox}
          matchedSource={matchedSource}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(prev => !prev)}
          onBack={handleShowList}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
