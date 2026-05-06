/**
 * ChatArea
 * ─────────
 * - Passes full message object to UserMessage (needed for timestamp)
 * - Passes onRetry to AssistantMessage
 * - Skeleton loading, smart scroll anchoring
 */
import { useEffect, useRef, useState } from 'react'
import './ChatArea.css'
import { UserMessage }      from './UserMessage.jsx'
import { AssistantMessage } from './AssistantMessage.jsx'

export function ChatArea({ messages, isSending, isLoadingData, onOpenDoc, onRetry }) {
  const areaRef   = useRef(null)
  const bottomRef = useRef(null)
  const [pinned, setPinned] = useState(true)

  const onScroll = () => {
    const el = areaRef.current; if (!el) return
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight <= 120)
  }

  useEffect(() => {
    if (pinned) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending, pinned])

  if (isLoadingData) return (
    <div className="chat-area" ref={areaRef}><ChatSkeleton /></div>
  )

  return (
    <div className="chat-area" ref={areaRef} onScroll={onScroll}>
      {messages.map(msg =>
        msg.role === 'user'
          ? <UserMessage key={msg.id} message={msg} />
          : <AssistantMessage key={msg.id} message={msg} onOpenDoc={onOpenDoc} onRetry={onRetry} />
      )}
      {isSending && !messages.some(m => m.streaming) && (
        <AssistantMessage
          message={{ id: '__typing__', role: 'assistant', content: '', streaming: true }}
          onOpenDoc={onOpenDoc}
        />
      )}
      <div ref={bottomRef} />
    </div>
  )
}

function ChatSkeleton() {
  return (
    <div className="chat-skeleton" aria-busy="true" aria-label="Loading conversation">
      {[
        { user: true,  w: '60%' },
        { user: false, lines: ['85%','70%','50%'] },
        { user: true,  w: '40%' },
        { user: false, lines: ['90%','65%'] },
      ].map((item, i) => (
        <div key={i} className={`chat-skeleton__msg chat-skeleton__msg--${item.user ? 'user' : 'ai'}`}>
          {item.user ? (
            <div className="chat-skeleton__bubble" style={{ width: item.w }} />
          ) : (
            <>
              <div className="chat-skeleton__avatar" />
              <div className="chat-skeleton__lines">
                {item.lines.map((w, j) => <div key={j} className="chat-skeleton__line" style={{ width: w }} />)}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
