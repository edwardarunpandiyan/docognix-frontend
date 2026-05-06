import './SourceCard.css'
import { DocSm } from '../ui/Icons.jsx'
import { getConfidenceStyle } from '../../utils/helpers.js'

export function SourceCard({ source, isPrimary, onOpenDoc }) {
  const s = getConfidenceStyle(source.confidence)
  return (
    <div className="source-card">
      <div className="source-card__dot" style={{ background: isPrimary ? '#111827' : '#CBD5E1' }} />
      <div className="source-card__box">
        <div className="source-card__row">
          <DocSm style={{ color: isPrimary ? '#374151' : '#9CA3AF', flexShrink: 0 }} />
          <button
            className="source-card__name"
            style={{ color: isPrimary ? '#111827' : '#374151' }}
            onClick={() => onOpenDoc?.(source.documentId, source.page, source.snippet, source.bbox ?? null)}
          >
            {source.filename}
          </button>
          <span className="source-card__page">· Page {source.page}</span>
          <div className="source-card__badge">
            <span className="source-card__pct" style={{ color: s.color }}>{source.confidence}%</span>
          </div>
        </div>
        <p className="source-card__snippet">{source.snippet}</p>
        {source.bbox && (
          <span className="source-card__bbox-tag" title="Exact position available">
            📍 Coordinate highlight
          </span>
        )}
      </div>
    </div>
  )
}
