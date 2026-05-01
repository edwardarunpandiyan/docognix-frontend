import { useState } from 'react'
import { useNavigate, useMatch } from 'react-router-dom'
import './Sidebar.css'
import { ChevronLeft, Plus, Doc, DocActive, Trash, Edit } from '../ui/Icons.jsx'
import { AppLogo } from '../ui/AppLogo.jsx'
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx'
import { formatDate } from '../../utils/helpers.js'

export function Sidebar({ history, isLoading, isCollapsed, isMobileOpen, onToggleCollapse, onOverlayClick, onNewChat, onDeleteSession, onRenameSession }) {
  const match     = useMatch('/chat/:sessionId')
  const sessionId = match?.params?.sessionId ?? null
  const navigate  = useNavigate()
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null) // { id, title }
  const [searchQuery,  setSearchQuery]  = useState('')

  const startEdit = (e, item) => {
    e.stopPropagation()
    setEditingId(item.id)
    setEditValue(item.title)
  }
  const commitEdit = (id) => {
    if (editValue.trim()) onRenameSession?.(id, editValue.trim())
    setEditingId(null)
  }
  const handleDelete = (e, item) => {
    e.stopPropagation()
    setDeleteTarget({ id: item.id, title: item.title })
  }
  const confirmDelete = () => {
    if (!deleteTarget) return
    onDeleteSession?.(deleteTarget.id)
    if (sessionId === deleteTarget.id) navigate('/')
    setDeleteTarget(null)
  }
  const cancelDelete = () => setDeleteTarget(null)

  return (
    <>
      <div className={`sidebar-overlay${isMobileOpen ? ' visible' : ''}`} onClick={onOverlayClick} aria-hidden="true" />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete chat?"
        message={deleteTarget ? `"${deleteTarget.title}" will be permanently removed.` : ''}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <aside className={['sidebar', isCollapsed ? 'collapsed' : '', isMobileOpen ? 'mobile-open' : ''].filter(Boolean).join(' ')}>

        {/* ── Logo row ─────────────────────────────────── */}
        <div className="sidebar__logo">
          <AppLogo size="md" showName showTag className="sidebar__brand" />
          <button className="sidebar__collapse-btn" onClick={onToggleCollapse} aria-label="Close sidebar">
            <ChevronLeft />
          </button>
        </div>

        {/* ── New Chat ─────────────────────────────────── */}
        <div className="sidebar__new-chat">
          <button className="sidebar__new-chat-btn" onClick={onNewChat}>
            <span className="sidebar__new-chat-icon"><Plus /></span>
            <span className="sidebar__new-chat-label">New Chat</span>
            <span className="sidebar__new-chat-kbd">⌘ N</span>
          </button>
        </div>

        <div className="sidebar__section-label">Recent</div>

        {/* ── Search ───────────────────────────────────── */}
        {!isCollapsed && (
          <div className="sidebar__search">
            <input
              className="sidebar__search-input"
              type="text"
              placeholder="Search conversations…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search conversations"
            />
            {searchQuery && (
              <button className="sidebar__search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">×</button>
            )}
          </div>
        )}

        {/* ── Nav ──────────────────────────────────────── */}
        <nav className="sidebar__nav">
          {isLoading ? (
            [1,2,3].map(n => (
              <div key={n} className="sidebar__nav-item-skeleton" aria-hidden>
                <div className="sidebar__skeleton-icon" />
                <div className="sidebar__skeleton-line" style={{ width: `${50 + n*13}%` }} />
              </div>
            ))
          ) : null}
          {!isLoading && (() => {
            const filtered = searchQuery.trim()
              ? history.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
              : history
            if (!isLoading && !filtered.length && searchQuery) {
              return <p className="sidebar__search-empty">No results for "{searchQuery}"</p>
            }
            return filtered
          })().map?.((item) => {
            const isActive = item.id === sessionId
            return (
              <div
                key={item.id}
                className={`sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`}
                onClick={() => navigate(`/chat/${item.id}`)}
              >
                {isActive
                  ? <DocActive className="sidebar__nav-item-icon sidebar__nav-item-icon--active" />
                  : <Doc       className="sidebar__nav-item-icon sidebar__nav-item-icon--default" />}

                <div className="sidebar__nav-item-body">
                  {editingId === item.id ? (
                    <input
                      className="sidebar__nav-item-edit"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit(item.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span className={`sidebar__nav-item-title${isActive ? ' sidebar__nav-item-title--active' : ' sidebar__nav-item-title--default'}`}>
                      {item.title}
                    </span>
                  )}
                  <span className="sidebar__nav-item-meta">
                    {item.docCount > 0 ? `${item.docCount} doc${item.docCount !== 1 ? 's' : ''} · ` : ''}
                    {formatDate(item.createdAt)}
                  </span>
                </div>

                <div className="sidebar__nav-item-actions">
                  <button className="sidebar__action-btn" onClick={(e) => startEdit(e, item)} title="Rename" aria-label="Rename chat">
                    <Edit style={{ width: 11, height: 11 }} />
                  </button>
                  <button className="sidebar__action-btn sidebar__action-btn--danger" onClick={(e) => handleDelete(e, item)} title="Delete" aria-label="Delete chat">
                    <Trash style={{ width: 11, height: 11 }} />
                  </button>
                </div>
              </div>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
