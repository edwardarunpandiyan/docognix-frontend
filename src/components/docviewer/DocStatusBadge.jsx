/**
 * DocStatusBadge — shows document processing status
 * ──────────────────────────────────────────────────
 * Displayed in DocListView next to each document.
 * Processing stages pulse to indicate activity.
 * Ready = green. Failed = red with error tooltip.
 */
import './DocStatusBadge.css'
import { DOC_STATUS_CONFIG } from '../../constants/index.js'

export function DocStatusBadge({ status, error }) {
  const cfg = DOC_STATUS_CONFIG[status] ?? DOC_STATUS_CONFIG.ready

  return (
    <span
      className={`doc-status-badge${cfg.pulse ? ' doc-status-badge--pulse' : ''}`}
      style={{ color: cfg.color, background: cfg.bg }}
      title={error ?? cfg.label}
      aria-label={`Document status: ${cfg.label}`}
    >
      {cfg.pulse && <span className="doc-status-badge__dot" style={{ background: cfg.color }} />}
      {cfg.label}
    </span>
  )
}

/**
 * DocProcessingBar — full pipeline progress bar
 * Shows all stages with current stage highlighted.
 * Displayed in DocListView while a doc is processing.
 */
const STAGES = ['uploading', 'extracting', 'chunking', 'embedding', 'ready']
const STAGE_LABELS = {
  uploading:  'Upload',
  extracting: 'Extract',
  chunking:   'Chunk',
  embedding:  'Embed',
  ready:      'Ready',
}

export function DocProcessingBar({ status }) {
  // Backend sends 'processing' as a generic status.
  // Map it to 'extracting' so the pipeline bar shows stage 2.
  const normalised = status === 'processing' ? 'extracting' : status
  const currentIdx = STAGES.indexOf(normalised)
  if (currentIdx === -1 || normalised === 'ready' || normalised === 'failed') return null

  return (
    <div className="doc-processing-bar" role="progressbar" aria-label={`Processing: ${status}`}>
      {STAGES.map((stage, i) => {
        const done    = i < currentIdx
        const active  = i === currentIdx
        const pending = i > currentIdx
        return (
          <div key={stage} className="doc-processing-bar__step">
            <div
              className={[
                'doc-processing-bar__node',
                done    ? 'doc-processing-bar__node--done'    : '',
                active  ? 'doc-processing-bar__node--active'  : '',
                pending ? 'doc-processing-bar__node--pending' : '',
              ].filter(Boolean).join(' ')}
            >
              {done ? '✓' : i + 1}
            </div>
            <span className={`doc-processing-bar__label${active ? ' doc-processing-bar__label--active' : ''}`}>
              {STAGE_LABELS[stage]}
            </span>
            {i < STAGES.length - 1 && (
              <div className={`doc-processing-bar__line${done ? ' doc-processing-bar__line--done' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
