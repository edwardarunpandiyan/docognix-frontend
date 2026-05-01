import './ChatHeader.css'
import { AppLogo }  from '../ui/AppLogo.jsx'
import { Grid, Menu } from '../ui/Icons.jsx'

export function ChatHeader({
  title, docCount, isPanelOpen,
  onToggleDocPanel, onToggleSidebar, sidebarVisible,
  onExport, hasMessages,
}) {
  return (
    <header className="chat-header">
      <div className="chat-header__left">
        {!sidebarVisible && (
          <>
            <button className="chat-header__menu-btn" onClick={onToggleSidebar} aria-label="Open sidebar">
              <Menu />
            </button>
            <AppLogo size="sm" showName={false} className="chat-header__mini-logo" />
          </>
        )}
        <h1 className="chat-header__title">{title}</h1>
      </div>

      <div className="chat-header__right">
        {/* Export button — only shown when there are messages */}
        {hasMessages && onExport && (
          <button
            className="chat-header__export-btn"
            onClick={onExport}
            title="Export conversation as Markdown"
            aria-label="Export conversation"
          >
            <ExportIcon />
            <span className="chat-header__export-label">Export</span>
          </button>
        )}

        {docCount > 0 && (
          <button
            className={`chat-header__docs-btn${isPanelOpen ? ' active' : ''}`}
            onClick={onToggleDocPanel}
          >
            <Grid style={{ color: '#7C3AED' }} />
            <span>{isPanelOpen ? 'Hide Docs ‹' : `${docCount} Doc${docCount !== 1 ? 's' : ''} ›`}</span>
          </button>
        )}
      </div>
    </header>
  )
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1v8m0-8L5.5 3.5M8 1l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.5 10v3.5a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
