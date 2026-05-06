import './AnswerFooter.css'
import { Check } from '../ui/Icons.jsx'
import { ANSWER_STATE_CONFIG } from '../../constants/index.js'

export function AnswerFooter({ state, latencyMs, chunksUsed }) {
  const cfg = ANSWER_STATE_CONFIG[state] ?? ANSWER_STATE_CONFIG.supported
  return (
    <div className="answer-footer">
      <div className="answer-footer__state">
        <div className="answer-footer__icon" style={{ background: cfg.bgColor, borderColor: cfg.borderColor }}>
          <Check style={{ color: cfg.color }} />
        </div>
        <span className="answer-footer__label" style={{ color: cfg.color }}>{cfg.label}</span>
      </div>
      <div className="answer-footer__meta">
        <span>{latencyMs}ms</span>
        <span className="answer-footer__sep">·</span>
        <span>{chunksUsed} chunks</span>
      </div>
    </div>
  )
}
