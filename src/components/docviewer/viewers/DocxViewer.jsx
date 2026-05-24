import { useEffect, useRef, useState } from 'react'
import './DocxViewer.css'

// ── Phrase extraction ─────────────────────────────────────────────
function extractPhrase(snippet) {
  if (!snippet) return null
  const cleaned = snippet
    .replace(/^["""«»''…\s]+/, '')
    .replace(/["""«»''…\s]+$/, '')
    .replace(/\.{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length >= 6 ? cleaned : null
}

// ── DOM text highlight ────────────────────────────────────────────
function highlightExactPhrase(container, phrase) {
  if (!phrase) return null

  // Remove any previous highlights first
  container.querySelectorAll('mark.docx-hl').forEach(m => {
    m.replaceWith(document.createTextNode(m.textContent))
  })

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes = []
  let node
  while ((node = walker.nextNode())) textNodes.push(node)
  if (!textNodes.length) return null

  const charMap = []
  const fullText = textNodes.map((n, ni) => {
    const t = n.textContent
    for (let li = 0; li < t.length; li++) charMap.push({ ni, li })
    return t
  }).join('')

  const lower  = fullText.toLowerCase()
  const words  = phrase.split(/\s+/)
  let matchIdx = -1, matchLen = 0

  for (let len = words.length; len >= Math.max(3, Math.floor(words.length * 0.5)); len--) {
    const sub = words.slice(0, len).join(' ')
    const idx = lower.indexOf(sub.toLowerCase())
    if (idx !== -1) { matchIdx = idx; matchLen = sub.length; break }
    const subEnd = words.slice(-len).join(' ')
    const idxEnd = lower.indexOf(subEnd.toLowerCase())
    if (idxEnd !== -1) { matchIdx = idxEnd; matchLen = subEnd.length; break }
  }

  if (matchIdx === -1) return null

  const matchEnd     = matchIdx + matchLen
  const affectedNodes = new Map()
  for (let gi = matchIdx; gi < matchEnd; gi++) {
    const { ni, li } = charMap[gi]
    if (!affectedNodes.has(ni)) affectedNodes.set(ni, [li, li])
    affectedNodes.get(ni)[1] = li + 1
  }

  let firstMark = null
  const sortedNi = [...affectedNodes.keys()].sort((a, b) => b - a)
  sortedNi.forEach(ni => {
    const [start, end] = affectedNodes.get(ni)
    const tn      = textNodes[ni]
    const text    = tn.textContent
    const before  = text.slice(0, start)
    const matched = text.slice(start, end)
    const after   = text.slice(end)
    const frag = document.createDocumentFragment()
    if (before) frag.appendChild(document.createTextNode(before))
    const mark = document.createElement('mark')
    mark.className   = 'docx-hl'
    mark.textContent = matched
    frag.appendChild(mark)
    if (!firstMark) firstMark = mark
    if (after) frag.appendChild(document.createTextNode(after))
    tn.parentNode?.replaceChild(frag, tn)
  })

  return firstMark
}

async function loadArrayBuffer(file, url) {
  if (file) return file.arrayBuffer()
  if (url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    return res.arrayBuffer()
  }
  throw new Error('No file or URL provided')
}

export function DocxViewer({ file, url, snippet = null, fontSize = 14, totalPages = 1, onPageChange }) {
  const bodyRef  = useRef(null)
  const [status, setStatus] = useState('idle')
  const [errMsg, setErrMsg] = useState('')

  // ── Effect 1: load + render mammoth HTML — only when file/url changes ──
  useEffect(() => {
    if (!file && !url) { setStatus('error'); setErrMsg('No document source'); return }
    if (!bodyRef.current) return
    let cancelled = false
    setStatus('loading')
    setErrMsg('')

    ;(async () => {
      try {
        const mammoth = await import('mammoth')
        const buf = await loadArrayBuffer(file, url)
        if (cancelled) return
        const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf })
        if (cancelled) return
        bodyRef.current.innerHTML = html
        if (!cancelled) setStatus('ready')
      } catch (e) {
        if (!cancelled) { setErrMsg(e.message || 'Failed to render document'); setStatus('error') }
      }
    })()

    return () => { cancelled = true }
  }, [file, url])

  // ── Effect 2: highlight + scroll — runs after render, when snippet changes ──
  // Separated so switching source snippets does NOT re-load the document.
  useEffect(() => {
    if (status !== 'ready' || !bodyRef.current) return
    if (!snippet) return

    const phrase     = extractPhrase(snippet)
    const firstMark  = phrase ? highlightExactPhrase(bodyRef.current, phrase) : null
    if (!firstMark) return

    // Use getBoundingClientRect — reliable across all layout/position configs.
    // offsetParent traversal fails when ancestors aren't position:relative.
    requestAnimationFrame(() => {
      const viewer = bodyRef.current?.closest('.docx-viewer')
      if (!viewer || !firstMark.isConnected) return
      const markRect   = firstMark.getBoundingClientRect()
      const viewerRect = viewer.getBoundingClientRect()
      const scrollTop  = viewer.scrollTop + markRect.top - viewerRect.top - viewer.clientHeight / 3
      viewer.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' })
    })
  }, [status, snippet])

  // ── Effect 3: page tracking via scroll percentage ─────────────────
  useEffect(() => {
    const el = bodyRef.current?.closest('.docx-viewer')
    if (!el || !onPageChange || totalPages <= 1) return
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      const max  = scrollHeight - clientHeight
      const pct  = max > 0 ? scrollTop / max : 0
      const page = Math.min(totalPages, Math.max(1, Math.round(pct * (totalPages - 1)) + 1))
      onPageChange(page)
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [totalPages, onPageChange])

  return (
    <div className="docx-viewer">
      {status === 'loading' && (
        <div className="docx-viewer__overlay">
          <div className="docx-viewer__spinner" />
          <span>Loading document…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="docx-viewer__overlay docx-viewer__overlay--err">⚠ {errMsg}</div>
      )}
      <div
        ref={bodyRef}
        className="docx-viewer__body"
        style={{ fontSize: `${fontSize}px` }}
      />
    </div>
  )
}
