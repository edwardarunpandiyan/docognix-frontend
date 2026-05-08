import { useEffect, useRef, useState } from 'react'
import './TxtViewer.css'

// ── Snippet cleaner ───────────────────────────────────────────────
function cleanSnippet(s) {
  if (!s) return null
  return s
    .replace(/^["""«»''…\s\-]+/, '')
    .replace(/["""«»''…\s\-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Escape HTML ───────────────────────────────────────────────────
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Build highlighted HTML ────────────────────────────────────────
// Uses a whitespace-flexible regex so phrase matches across newlines.
function buildHtml(rawText, phrase) {
  if (!phrase) return esc(rawText)

  const words = phrase.split(/\s+/).filter(Boolean)
  if (words.length < 2) return esc(rawText)

  // Try progressively shorter prefixes
  for (let len = words.length; len >= Math.max(2, Math.ceil(words.length * 0.4)); len--) {
    const sub = words.slice(0, len)
    const pattern = sub
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s\\r\\n\\-]+')   // matches newlines, spaces, hyphens
    const re = new RegExp(pattern, 'i')
    const m = re.exec(rawText)
    if (m) {
      const before  = rawText.slice(0, m.index)
      const matched = rawText.slice(m.index, m.index + m[0].length)
      const after   = rawText.slice(m.index + m[0].length)
      return esc(before) + `<mark class="txt-hl">${esc(matched)}</mark>` + esc(after)
    }
    // Also try from the end
    const subE = words.slice(-len)
    const patternE = subE
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s\\r\\n\\-]+')
    const reE = new RegExp(patternE, 'i')
    const mE = reE.exec(rawText)
    if (mE) {
      const before  = rawText.slice(0, mE.index)
      const matched = rawText.slice(mE.index, mE.index + mE[0].length)
      const after   = rawText.slice(mE.index + mE[0].length)
      return esc(before) + `<mark class="txt-hl">${esc(matched)}</mark>` + esc(after)
    }
  }
  return esc(rawText)
}

async function loadText(file, url) {
  if (file) return file.text()
  if (url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  }
  throw new Error('No source')
}

export function TxtViewer({ file, url, snippet = null }) {
  const viewerRef = useRef(null)
  const bodyRef   = useRef(null)

  // Use state for HTML content so React renders it via dangerouslySetInnerHTML
  // (avoids React wiping manually-set innerHTML on re-render)
  const [html, setHtml]       = useState('')
  const [status, setStatus]   = useState('loading')
  const [errMsg, setErrMsg]   = useState('')

  // Load & process text
  useEffect(() => {
    if (!file && !url) { setStatus('error'); setErrMsg('No source'); return }
    let cancelled = false
    setStatus('loading')
    setHtml('')
    setErrMsg('')

    ;(async () => {
      try {
        const text  = await loadText(file, url)
        if (cancelled) return
        const built = buildHtml(text, cleanSnippet(snippet))
        if (cancelled) return
        setHtml(built)
        setStatus('ready')
      } catch (e) {
        if (!cancelled) { setErrMsg(e.message); setStatus('error') }
      }
    })()

    return () => { cancelled = true }
  }, [file, url, snippet])

  // Scroll to highlight AFTER content renders (React has committed to DOM)
  useEffect(() => {
    if (status !== 'ready' || !html || !bodyRef.current || !viewerRef.current) return
    const mark = bodyRef.current.querySelector('.txt-hl')
    if (!mark) return
    // Use scrollIntoView — nearest scrollable ancestor is the viewer div
    setTimeout(() => {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
  }, [status, html])

  return (
    <div className="txt-viewer" ref={viewerRef}>
      {status === 'loading' && (
        <div className="txt-viewer__overlay">
          <div className="txt-viewer__spinner" />
          <span>Loading…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="txt-viewer__overlay txt-viewer__overlay--err">⚠ {errMsg}</div>
      )}
      {/* dangerouslySetInnerHTML = React owns the HTML, won't wipe it on re-render */}
      <pre
        ref={bodyRef}
        className="txt-viewer__body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
