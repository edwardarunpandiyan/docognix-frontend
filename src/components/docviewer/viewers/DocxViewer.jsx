import { useEffect, useRef, useState } from 'react'
import './DocxViewer.css'

// ── Phrase extraction from snippet ───────────────────────────────
// Returns the best candidate phrase to search for in the document.
// We prefer the longest contiguous run of real words from the snippet.
function extractPhrase(snippet) {
  if (!snippet) return null
  // Strip leading/trailing punctuation and quote characters
  const cleaned = snippet
    .replace(/^["""«»''…\s]+/, '')
    .replace(/["""«»''…\s]+$/, '')
    .replace(/\.{2,}/g, ' ')   // collapse ellipses
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length >= 6 ? cleaned : null
}

// ── Exact-phrase highlighter for DOM tree ───────────────────────
// Finds the FIRST occurrence of `phrase` (case-insensitive) in the
// text content of `container`, then wraps the matching characters
// in <mark> elements.  Only the exact matching region is marked —
// nothing else in the document is touched.

function highlightExactPhrase(container, phrase) {
  if (!phrase) return null

  // Collect all text nodes in document order
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes = []
  let node
  while ((node = walker.nextNode())) textNodes.push(node)
  if (!textNodes.length) return null

  // Build a map: global char offset → { nodeIndex, localOffset }
  const charMap = []   // charMap[globalIdx] = { ni, li }
  const fullText = textNodes.map((n, ni) => {
    const t = n.textContent
    for (let li = 0; li < t.length; li++) charMap.push({ ni, li })
    return t
  }).join('')

  const lower = fullText.toLowerCase()
  const phraseL = phrase.toLowerCase()

  // Try the full phrase first, then progressively trim word-by-word from the end
  const words = phrase.split(/\s+/)
  let matchIdx = -1
  let matchLen = 0

  for (let len = words.length; len >= Math.max(3, Math.floor(words.length * 0.5)); len--) {
    const sub = words.slice(0, len).join(' ')
    const idx = lower.indexOf(sub.toLowerCase())
    if (idx !== -1) { matchIdx = idx; matchLen = sub.length; break }
    // Also try from the latter half
    const subEnd = words.slice(-len).join(' ')
    const idxEnd = lower.indexOf(subEnd.toLowerCase())
    if (idxEnd !== -1) { matchIdx = idxEnd; matchLen = subEnd.length; break }
  }

  if (matchIdx === -1) return null

  // Split affected text nodes and insert <mark>
  const matchEnd = matchIdx + matchLen
  const affectedNodes = new Map()  // ni → [{start, end}] local ranges

  for (let gi = matchIdx; gi < matchEnd; gi++) {
    const { ni, li } = charMap[gi]
    if (!affectedNodes.has(ni)) affectedNodes.set(ni, [li, li])
    affectedNodes.get(ni)[1] = li + 1
  }

  let firstMark = null
  // Process in reverse order so offsets aren't invalidated
  const sortedNi = [...affectedNodes.keys()].sort((a, b) => b - a)

  sortedNi.forEach(ni => {
    const [start, end] = affectedNodes.get(ni)
    const tn = textNodes[ni]
    const text = tn.textContent

    // Split: before | matched | after
    const before = text.slice(0, start)
    const matched = text.slice(start, end)
    const after = text.slice(end)

    const frag = document.createDocumentFragment()
    if (before) frag.appendChild(document.createTextNode(before))

    const mark = document.createElement('mark')
    mark.className = 'docx-hl'
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

export function DocxViewer({ file, url, snippet = null }) {
  const bodyRef = useRef(null)
  const [status, setStatus] = useState('loading')
  const [errMsg, setErrMsg] = useState('')

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

        const div = bodyRef.current
        div.innerHTML = html

        if (snippet) {
          const phrase = extractPhrase(snippet)
          const firstMark = phrase ? highlightExactPhrase(div, phrase) : null
          if (firstMark) {
            setTimeout(() => firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
          }
        }

        if (!cancelled) setStatus('ready')
      } catch (e) {
        if (!cancelled) { setErrMsg(e.message || 'Failed to render document'); setStatus('error') }
      }
    })()

    return () => { cancelled = true }
  }, [file, url, snippet])

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
      <div ref={bodyRef} className="docx-viewer__body" />
    </div>
  )
}
