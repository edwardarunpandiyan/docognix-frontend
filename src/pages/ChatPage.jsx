/**
 * ChatPage — active conversation view
 * ─────────────────────────────────────
 * Receives conversationId from URL params.
 * Conversation already exists in DB (created during first upload).
 *
 * Upload in ChatPage = additional document to existing conversation.
 * Uses uploadDoc() not uploadFirstDoc().
 *
 * Auto-title comes from SSE title event via onRenameSession callback.
 * No client-side title generation hook needed.
 */
import { useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './ChatPage.css'
import { ChatHeader }       from '../components/layout/ChatHeader.jsx'
import { ChatArea }         from '../components/chat/ChatArea.jsx'
import { MessageInput }     from '../components/chat/MessageInput.jsx'
import { DocPanel }         from '../components/docviewer/DocPanel.jsx'
import { NoDocumentsState, ReadyToAskState } from '../components/chat/EmptyState.jsx'
import { useSessionChat }   from '../hooks/useSessionChat.js'
import { useDocPanel }      from '../hooks/useDocPanel.js'
import { useDocProcessing } from '../hooks/useDocProcessing.js'
import { exportConversation } from '../utils/exportConversation.js'
import { DOC_STATUS }      from '../constants/index.js'

export function ChatPage({
  history,
  sidebarVisible,
  onToggleSidebar,
  onIncrementDocCount,
  onSessionTouched,
  onRenameSession,
}) {
  const { sessionId: conversationId } = useParams()
  const navigate  = useNavigate()
  const inputRef  = useRef(null)

  const {
    messages, documents,
    isSending, isUploading, uploadProgress,
    isLoadingData, error,
    submitMessage, uploadDoc,
    retryMessage, cancelStream, cancelUpload,
    updateDocumentStatus, clearError,
  } = useSessionChat(
    conversationId,
    onIncrementDocCount,
    onSessionTouched,
    onRenameSession,    // ← passed so SSE title event updates sidebar
    null,               // onConversationCreated not needed here
  )

  const panel = useDocPanel()
  const conv  = history.find(s => s.id === conversationId)
  const title = conv?.title ?? 'Chat'

  // ── Doc processing polling ────────────────────────────────────────
  useDocProcessing(documents, conversationId, updateDocumentStatus)

  // ── Close doc panel on conversation change ────────────────────────
  useEffect(() => { panel.close() }, [conversationId]) // eslint-disable-line

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape' && panel.isOpen) { panel.close(); return }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); navigate('/') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [panel.isOpen, navigate, panel])

  // ── Export ────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!conv) return
    exportConversation(conv, messages, documents)
  }, [conv, messages, documents])

  const hasMessages = messages.filter(m => !m.streaming).length > 0
  const hasDocs     = documents.length > 0
  const hasReadyDoc = documents.some(d => d.status === 'ready' || d.status === DOC_STATUS.READY)
  // True when docs exist but none are ready yet (still uploading/processing/chunking)
  const isProcessing = hasDocs && !hasReadyDoc
  const showNoDoc   = !isLoadingData && !hasDocs && !hasMessages
  const showReady   = !isLoadingData && hasReadyDoc && !hasMessages
  const showChat    = isLoadingData || hasMessages

  return (
    <>
      <div className="chat-page">
        <ChatHeader
          title={title}
          docCount={documents.length}
          isPanelOpen={panel.isOpen}
          onToggleDocPanel={panel.toggle}
          onToggleSidebar={onToggleSidebar}
          sidebarVisible={sidebarVisible}
          onExport={handleExport}
          hasMessages={hasMessages}
        />

        {error && (
          <div className="chat-page__error">
            <span>{error}</span>
            <button className="chat-page__error-close" onClick={clearError}>×</button>
          </div>
        )}

        {showNoDoc && (
          <div className="chat-page__empty">
            <NoDocumentsState onUploadClick={() => inputRef.current?.triggerUpload()} />
          </div>
        )}
        {showReady && (
          <div className="chat-page__empty">
            <ReadyToAskState documents={documents} />
          </div>
        )}
        {showChat && (
          <ChatArea
            messages={messages}
            isSending={isSending}
            isLoadingData={isLoadingData}
            onOpenDoc={(docId, page, snippet, bbox) => panel.openDoc(docId, page, snippet, bbox)}
            onRetry={retryMessage}
          />
        )}

        <MessageInput
          ref={inputRef}
          onSend={submitMessage}
          onUpload={uploadDoc}
          onCancelUpload={cancelUpload}
          onCancelStream={cancelStream}
          disabled={isSending}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          isSending={isSending}
          hasReadyDoc={hasReadyDoc}
          isProcessing={isProcessing}
        />
      </div>

      <DocPanel
        isOpen={panel.isOpen}
        view={panel.view}
        activeDocId={panel.activeDocId}
        activePage={panel.activePage}
        activeSnippet={panel.activeSnippet}
        activeBbox={panel.activeBbox}
        documents={documents}
        messages={messages}
        onOpenDoc={(id, page, snippet, bbox) => panel.openDoc(id, page, snippet, bbox)}
        onShowList={panel.showList}
        onClose={panel.close}
      />
    </>
  )
}
