/**
 * UserMessage
 * ───────────
 * Layout:
 *   bubble (right-aligned)
 *   meta row: [copy icon] [time]  ← below bubble, right-aligned
 *
 * Time visibility:
 *   Desktop (>768px): visible on hover of the whole user-msg wrapper
 *   Tablet + Mobile (<=768px): always visible
 *
 * Copy: icon-only button (no text), same hover-show logic as time on desktop
 */
import { useState, useCallback } from 'react'
import './UserMessage.css'
import { CopyIcon, CheckThin } from '../ui/Icons.jsx'
import { formatMessageTime, formatMessageTooltip } from '../../utils/time.js'

export function UserMessage({ message }) {
  const [copied, setCopied] = useState(false)
  const time    = formatMessageTime(message.createdAt)
  const tooltip = formatMessageTooltip(message.createdAt)

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message.content)
      } else {
        const ta = document.createElement('textarea')
        ta.value = message.content
        ta.style.cssText = 'position:fixed;opacity:0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* silently ignore */ }
  }, [message.content])

  return (
    <div className="user-msg">
      <div className="user-msg__bubble">{message.content}</div>

      {/* Meta row: copy + time — below bubble, right-aligned */}
      <div className="user-msg__meta">
        <button
          className={`user-msg__copy${copied ? ' user-msg__copy--done' : ''}`}
          onClick={handleCopy}
          title="Copy message"
          aria-label="Copy message"
        >
          {copied ? <CheckThin /> : <CopyIcon />}
        </button>

        {time && (
          <span className="user-msg__time" title={tooltip} aria-label={tooltip}>
            {time}
          </span>
        )}
      </div>
    </div>
  )
}
