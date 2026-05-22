/**
 * SourceCard
 * ──────────
 * Displays a single RAG source chunk with:
 * - Filename + page link → opens PDF viewer at exact location
 * - Confidence badge
 * - Snippet with Show more / Show less toggle
 *   · Desktop/tablet: clamp to 3 lines
 *   · Mobile:         clamp to 2 lines
 *   Both expand inline on click — no layout surprise
 */
import { useState } from 'react'
import './SourceCard.css'
import { DocSm } from '../ui/Icons.jsx'
import { getConfidenceStyle } from '../../utils/helpers.js'

export function SourceCard({ source, isPrimary, onOpenDoc }) {
  const [expanded, setExpanded] = useState(false)
  const s = getConfidenceStyle(source.confidence)

  // Only show the toggle if snippet is long enough to actually be clamped.
  // 120 chars ≈ 3 lines at normal card width — below that, no toggle needed.
  const isLong = (source.snippet?.length ?? 0) > 120

  return (
    <div className="source-card">
      <div
        className="source-card__dot"
        style={{ background: isPrimary ? '#111827' : '#CBD5E1' }}
      />
      <div className="source-card__box">
        {/* ── Header row ── */}
        <div className="source-card__row">
          <DocSm style={{ color: isPrimary ? '#374151' : '#9CA3AF', flexShrink: 0 }} />
          <button
            className="source-card__name"
            style={{ color: isPrimary ? '#111827' : '#374151' }}
            onClick={() =>
              onOpenDoc?.(source.documentId, source.page, source.snippet, source.bbox ?? null)
            }
          >
            {source.filename}
          </button>
          <span className="source-card__page">· Page {source.page}</span>
          <div className="source-card__badge">
            <span className="source-card__pct" style={{ color: s.color }}>
              {source.confidence}%
            </span>
          </div>
        </div>

        {/* ── Snippet with clamp toggle ── */}
        <p className={`source-card__snippet${expanded ? ' source-card__snippet--expanded' : ''}`}>
          {source.snippet}
        </p>

        {/* ── Show more / Show less — only rendered when snippet is long ── */}
        {isLong && (
          <button
            className="source-card__toggle"
            onClick={() => setExpanded(prev => !prev)}
            aria-expanded={expanded}
          >
            {expanded ? 'Show less ↑' : 'Show more ↓'}
          </button>
        )}

        {/* ── Coordinate highlight tag ── */}
        {source.bbox && (
          <span className="source-card__bbox-tag" title="Exact position available">
            📍 Coordinate highlight
          </span>
        )}
      </div>
    </div>
  )
}
