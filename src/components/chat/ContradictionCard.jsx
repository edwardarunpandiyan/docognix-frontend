/**
 * ContradictionCard — surfaces conflicting passages between documents
 * ──────────────────────────────────────────────────────────────────
 * Shown inside AssistantMessage when metadata.state === 'contradiction'.
 *
 * Backend provision:
 *   metadata.contradiction = {
 *     detected:    true,
 *     topic:       string,        // what topic the contradiction is about
 *     explanation: string,        // why it might exist (time period, source, etc.)
 *     sides: [
 *       {
 *         documentId, filename, page,
 *         stance:     string,     // one-line summary of this side's position
 *         snippet:    string,     // verbatim chunk text
 *         confidence: number,
 *         bbox:       { x1,y1,x2,y2 } | null
 *       },
 *       { ...same... }
 *     ]
 *   }
 *
 * Both "View in document" buttons open the doc panel and jump to the
 * exact passage with highlight — same flow as normal source cards.
 */
import './ContradictionCard.css'
import { getConfidenceStyle } from '../../utils/helpers.js'

export function ContradictionCard({ contradiction, onOpenDoc }) {
  if (!contradiction?.detected || !contradiction.sides?.length) return null

  const { topic, explanation, sides } = contradiction

  return (
    <div className="contradiction-card" role="alert" aria-label="Contradiction detected">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="contradiction-card__header">
        <span className="contradiction-card__icon">⚠️</span>
        <div className="contradiction-card__header-text">
          <span className="contradiction-card__title">Contradiction Detected</span>
          {topic && (
            <span className="contradiction-card__topic">Topic: {topic}</span>
          )}
        </div>
      </div>

      {/* ── Two sides ──────────────────────────────────────── */}
      <div className="contradiction-card__sides">
        {sides.map((side, i) => {
          const cs = getConfidenceStyle(side.confidence)
          return (
            <div key={`${side.documentId}-${i}`} className="contradiction-card__side">
              {/* Side label */}
              <div className="contradiction-card__side-label">
                {i === 0 ? 'View A' : 'View B'}
              </div>

              {/* Doc name + page */}
              <div className="contradiction-card__side-doc">
                <span className="contradiction-card__side-filename">{side.filename}</span>
                <span className="contradiction-card__side-page">· p.{side.page}</span>
                <span
                  className="contradiction-card__side-conf"
                  style={{ color: cs.color }}
                >
                  {side.confidence}%
                </span>
              </div>

              {/* Stance — one-line summary */}
              {side.stance && (
                <p className="contradiction-card__side-stance">"{side.stance}"</p>
              )}

              {/* Snippet */}
              <p className="contradiction-card__side-snippet">{side.snippet}</p>

              {/* View button */}
              <button
                className="contradiction-card__view-btn"
                onClick={() => onOpenDoc?.(side.documentId, side.page, side.snippet, side.bbox ?? null)}
              >
                View in document →
              </button>
            </div>
          )
        })}
      </div>

      {/* Divider between sides — visual "vs" */}
      <div className="contradiction-card__vs" aria-hidden>vs</div>

      {/* ── Explanation ─────────────────────────────────────── */}
      {explanation && (
        <p className="contradiction-card__explanation">{explanation}</p>
      )}
    </div>
  )
}
