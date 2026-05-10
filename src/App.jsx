/**
 * App.jsx — root layout
 * ─────────────────────
 * Key wiring changes:
 *
 * 1. NewChatPage receives onUploadFirst — calls uploadFirstDoc from
 *    a shared useSessionChat instance at the App level for first uploads.
 *    After success: addConversation() → navigate to new conversation.
 *
 * 2. useChatSessions.createSession is now a no-op (New Chat = UI only).
 *    addConversation() is the real entry point, called after backend responds.
 *
 * 3. ChatPage receives onRenameSession so the SSE title event updates sidebar.
 */
import { useState, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import './App.css'
import { Sidebar }         from './components/layout/Sidebar.jsx'
import { NewChatPage }     from './pages/NewChatPage.jsx'
import { ChatPage }        from './pages/ChatPage.jsx'
import { useChatSessions } from './hooks/useChatSessions.js'
import { useSessionChat }  from './hooks/useSessionChat.js'
import { useBreakpoint }   from './hooks/useBreakpoint.js'

export default function App() {
  const { isDesktop }                 = useBreakpoint()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const navigate                      = useNavigate()

  const {
    history, isLoading,
    addConversation,
    renameSession, deleteSession,
    incrementDocCount, touchSession,
  } = useChatSessions()

  // Shared upload hook for first-doc uploads (before any conversation exists)
  // conversationId = null because no conversation exists yet at this point.
  const {
    uploadFirstDoc,
    isUploading: isFirstUploading,
    uploadProgress: firstUploadProgress,
  } = useSessionChat(
    null,               // no conversationId yet
    incrementDocCount,
    touchSession,
    renameSession,
    addConversation,    // called after first upload — adds to sidebar
  )

  // After first upload creates a conversation, navigate to it
  const handleFirstUpload = useCallback(async (file) => {
    const result = await uploadFirstDoc(file)
    if (result?.conversationId) {
      navigate(`/chat/${result.conversationId}`)
    }
  }, [uploadFirstDoc, navigate])

  const toggleSidebar = () => setSidebarOpen(p => !p)
  const closeSidebar  = () => setSidebarOpen(false)

  const sidebarVisible = isDesktop && sidebarOpen
  const isCollapsed    = isDesktop && !sidebarOpen
  const isMobileOpen   = !isDesktop && sidebarOpen

  return (
    <div className="app">
      <div className="app__body">
        <Sidebar
          history={history}
          isLoading={isLoading}
          isCollapsed={isCollapsed}
          isMobileOpen={isMobileOpen}
          onToggleCollapse={toggleSidebar}
          onOverlayClick={closeSidebar}
          onNewChat={() => navigate('/')}
          onDeleteSession={deleteSession}
          onRenameSession={renameSession}
        />
        <main className="app__main">
          <Routes>
            <Route
              path="/"
              element={
                <NewChatPage
                  onUploadFirst={handleFirstUpload}
                  onToggleSidebar={toggleSidebar}
                  sidebarVisible={sidebarVisible}
                  isUploading={isFirstUploading}
                  uploadProgress={firstUploadProgress}
                />
              }
            />
            <Route
              path="/chat/:sessionId"
              element={
                <ChatPage
                  history={history}
                  sidebarVisible={sidebarVisible}
                  onToggleSidebar={toggleSidebar}
                  onIncrementDocCount={incrementDocCount}
                  onSessionTouched={touchSession}
                  onRenameSession={renameSession}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
