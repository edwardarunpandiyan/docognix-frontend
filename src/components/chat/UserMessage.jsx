import './UserMessage.css'
import { formatMessageTime, formatMessageTooltip } from '../../utils/time.js'

export function UserMessage({ message }) {
  const time    = formatMessageTime(message.createdAt)
  const tooltip = formatMessageTooltip(message.createdAt)

  return (
    <div className="user-msg">
      <div className="user-msg__bubble">{message.content}</div>
      {time && (
        <span className="user-msg__time" title={tooltip} aria-label={tooltip}>
          {time}
        </span>
      )}
    </div>
  )
}
