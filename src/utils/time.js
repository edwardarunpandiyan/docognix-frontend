/**
 * time.js — message timestamp formatting
 * ─────────────────────────────────────────
 * Rules:
 *   < 60s        → "just now"
 *   < 60m        → "5m ago"
 *   Same day     → "10:30 PM"
 *   Yesterday    → "Yesterday 10:30 PM"
 *   This year    → "Jan 15, 10:30 PM"
 *   Older        → "Jan 15 2023"
 *
 * Always uses browser locale (undefined) so timezone and
 * 12/24h format match the user's OS settings automatically.
 * Input must be ISO 8601 UTC ("...Z") — never local date strings.
 *
 * Backend provision:
 *   Server assigns authoritative createdAt on insert.
 *   Frontend optimistic timestamp is replaced by server value
 *   when the stream/response completes.
 */

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate()
}

const timeOpts = { hour: 'numeric', minute: '2-digit' }

/**
 * Short relative label shown inline below each message.
 * @param {string} isoString — ISO 8601 UTC
 * @returns {string}
 */
export function formatMessageTime(isoString) {
  if (!isoString) return ''
  const date   = new Date(isoString)
  const now    = new Date()
  const diffMs = now - date

  if (isNaN(diffMs)) return ''

  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffSec < 60)  return 'just now'
  if (diffMin < 60)  return `${diffMin}m ago`

  if (isSameDay(date, now))
    return date.toLocaleTimeString(undefined, timeOpts)

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (isSameDay(date, yesterday))
    return `Yesterday ${date.toLocaleTimeString(undefined, timeOpts)}`

  if (date.getFullYear() === now.getFullYear())
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...timeOpts })

  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Full expanded timestamp for tooltip on hover.
 * "Monday, January 15, 2024 at 10:30 PM"
 * @param {string} isoString
 * @returns {string}
 */
export function formatMessageTooltip(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date)) return ''
  return date.toLocaleString(undefined, {
    weekday: 'long', year: 'numeric',
    month: 'long',   day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}
