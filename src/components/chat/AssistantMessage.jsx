import { useState, useCallback } from 'react'
import './AssistantMessage.css'
import { AppLogo }            from '../ui/AppLogo.jsx'
import { SourceCard }         from './SourceCard.jsx'
import { AnswerFooter }       from './AnswerFooter.jsx'
import { ContradictionCard }  from './ContradictionCard.jsx'
import { formatMessageTime, formatMessageTooltip } from '../../utils/time.js'

export function AssistantMessage({ message, onOpenDoc, onRetry }) {
  const { content, metadata, streaming, error: msgError, createdAt } = message
  const isTyping = streaming && !content

  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = content; ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [content])

  const time    = formatMessageTime(createdAt)
  const tooltip = formatMessageTooltip(createdAt)
  const isContradiction = metadata?.state === 'contradiction'

  return (
    <div className="ai-msg">
      <AppLogo avatarOnly size="md" className="ai-msg__avatar-wrap" />
      <div className="ai-msg__card">

        {/* Typing indicator */}
        {isTyping && (
          <div className="ai-msg__typing">
            <div className="ai-msg__dot" /><div className="ai-msg__dot" /><div className="ai-msg__dot" />
          </div>
        )}

        {/* Error state */}
        {!isTyping && msgError && (
          <div className="ai-msg__error">
            <span className="ai-msg__error-text">⚠ {msgError}</span>
            {onRetry && (
              <button className="ai-msg__retry-btn" onClick={() => onRetry(message)}>Retry</button>
            )}
          </div>
        )}

        {/* Normal + contradiction content */}
        {!isTyping && !msgError && (
          <>
            <div className="ai-msg__body">
              <p className="ai-msg__text">
                {content}
                {streaming && <span className="ai-msg__cursor" aria-hidden />}
              </p>
            </div>

            {/* Contradiction card — shown instead of normal source cards */}
            {isContradiction && metadata?.contradiction && (
              <ContradictionCard
                contradiction={metadata.contradiction}
                onOpenDoc={onOpenDoc}
              />
            )}

            {/* Normal sources — shown when not a contradiction */}
            {!isContradiction && metadata?.sources?.length > 0 && (
              <div className="ai-msg__sources">
                <div className="ai-msg__sources-label">Sources</div>
                <div className="ai-msg__sources-list">
                  {metadata.sources.map((src, i) => (
                    <SourceCard
                      key={`${src.documentId}-${src.page}-${i}`}
                      source={src} isPrimary={i === 0}
                      onOpenDoc={onOpenDoc}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            {metadata && !streaming && (
              <AnswerFooter
                state={metadata.state}
                latencyMs={metadata.latencyMs}
                chunksUsed={metadata.chunksUsed}
              />
            )}

            {/* Actions row */}
            {!streaming && (
              <div className="ai-msg__actions">
                <button
                  className={`ai-msg__copy-btn${copied ? ' ai-msg__copy-btn--done' : ''}`}
                  onClick={handleCopy} title="Copy response" aria-label="Copy response"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
                {time && (
                  <span className="ai-msg__time" title={tooltip} aria-label={tooltip}>{time}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
