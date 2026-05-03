import { CONFIDENCE_HIGH, CONFIDENCE_MED } from '../constants/index.js'

export function getConfidenceStyle(conf) {
  if (conf >= CONFIDENCE_HIGH) return { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' }
  if (conf >= CONFIDENCE_MED)  return { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' }
  return { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' }
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function formatDate(iso) {
  const d = new Date(iso), now = new Date()
  const diffMin = Math.floor((now - d) / 60000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7)    return `${diffD}d ago`
  return d.toLocaleDateString()
}

export function truncate(str, max) {
  return str.length <= max ? str : `${str.slice(0, max - 1)}…`
}
