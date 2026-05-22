/**
 * PdfViewer — dual highlight mode
 * ─────────────────────────────────
 * Mode A — Coordinate (bbox): when highlightBbox is provided
 *   Backend sends { x1, y1, x2, y2 } in PDF user-space points.
 *   We draw an exact yellow rectangle at those coordinates.
 *   This is pixel-perfect — same approach as Google Docs, Notion AI.
 *   viewport.convertToViewportPoint() handles scale + rotation.
 *
 * Mode B — Text search (snippet): fallback when no bbox
 *   Concatenates all text items, finds phrase with flexible regex,
 *   draws highlight over matched items.
 *   Works well for text PDFs; fails on scanned/image PDFs.
 *
 * Both modes scroll the viewport to center on the highlight.
 */
import { useEffect, useRef, useState } from 'react'
import './PdfViewer.css'

// ── PDF.js singleton ──────────────────────────────────────────────
const PDFJS_VERSION = '3.11.174'
let _lib = null
async function getPdfJs() {
  if (_lib) return _lib
  const lib = await import('pdfjs-dist')
  lib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`
  _lib = lib
  return lib
}

// ── Mode A: Coordinate bbox highlight ────────────────────────────
/**
 * Draw a yellow rectangle at the exact PDF coordinates.
 *
 * PDF coordinate system: origin bottom-left, y increases upward.
 * Viewport coordinate system: origin top-left, y increases downward.
 * viewport.convertToViewportPoint(x, y) converts between them correctly,
 * accounting for scale, rotation, and page offset.
 *
 * bbox: { x1, y1, x2, y2 } in PDF points (72 DPI)
 *   (x1,y1) = bottom-left of the chunk rectangle
 *   (x2,y2) = top-right of the chunk rectangle
 *
 * Returns canvas-pixel Y of the top edge of the highlight (for scroll).
 */
function drawBboxHighlight(ctx, viewport, bbox) {
  if (!bbox) return null

  const [vx1, vy1] = viewport.convertToViewportPoint(bbox.x1, bbox.y1)
  const [vx2, vy2] = viewport.convertToViewportPoint(bbox.x2, bbox.y2)

  // After y-flip: vy1 (from lower PDF y) > vy2 (from higher PDF y)
  // So top of rect = min(vy1, vy2), height = abs(vy2 - vy1)
  const left   = Math.min(vx1, vx2)
  const top    = Math.min(vy1, vy2)
  const width  = Math.abs(vx2 - vx1)
  const height = Math.abs(vy2 - vy1)

  if (width < 1 || height < 1) return null

  ctx.save()
  ctx.fillStyle   = 'rgba(253, 224, 71, 0.45)'
  ctx.strokeStyle = 'rgba(202, 138, 4, 0.85)'
  ctx.lineWidth   = 2
  ctx.fillRect(left, top, width, height)
  ctx.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1)
  ctx.restore()

  return top // canvas-pixel Y for scroll targeting
}

// ── Mode B: Text-search highlight ────────────────────────────────
function cleanSnippet(s) {
  if (!s) return null
  return s.replace(/^["«»''…\s\-]+/, '').replace(/["«»''…\s\-]+$/, '').replace(/\s+/g, ' ').trim()
}

function findMatchedItemIndices(items, phrase) {
  if (!items?.length || !phrase) return new Set()
  const words = phrase.split(/\s+/).filter(Boolean)
  if (words.length < 2) return new Set()

  let concat = '', starts = [], ends = []
  items.forEach(item => {
    starts.push(concat.length)
    concat += (item.str || '') + ' '
    ends.push(concat.length - 1)
  })

  let matchStart = -1, matchEnd = -1
  for (let len = words.length; len >= Math.max(2, Math.ceil(words.length * 0.4)); len--) {
    for (const sub of [words.slice(0, len), words.slice(-len)]) {
      const pat = sub.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\-]*')
      const m   = new RegExp(pat, 'i').exec(concat)
      if (m) { matchStart = m.index; matchEnd = m.index + m[0].length; break }
    }
    if (matchStart !== -1) break
  }
  if (matchStart === -1) return new Set()

  const result = new Set()
  items.forEach((item, i) => {
    if (!item.str?.trim()) return
    if (ends[i] > matchStart && starts[i] < matchEnd) result.add(i)
  })
  return result
}

function drawTextHighlights(ctx, viewport, items, matchedSet) {
  if (!matchedSet.size) return null
  const scale = viewport.scale
  ctx.save()
  ctx.fillStyle   = 'rgba(253, 224, 71, 0.55)'
  ctx.strokeStyle = 'rgba(202, 138, 4, 0.75)'
  ctx.lineWidth   = 1.5
  let firstY = null

  matchedSet.forEach(idx => {
    const item = items[idx]
    if (!item?.str?.trim()) return
    const [, , , fontD, pdfX, pdfY] = item.transform
    const fontSz = Math.abs(fontD) || Math.abs(item.transform[0]) || 10
    const pdfW   = item.width > 0 ? item.width : item.str.length * fontSz * 0.55
    if (pdfW <= 0 || fontSz <= 0) return
    const [cx, cy] = viewport.convertToViewportPoint(pdfX, pdfY)
    const fontHpx  = fontSz * scale
    const rx = cx, ry = cy - fontHpx * 0.88
    const rw = pdfW * scale, rh = fontHpx * 1.1
    if (rw <= 0 || rh <= 0) return
    ctx.fillRect(rx, ry, rw, rh)
    ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1)
    if (firstY === null) firstY = ry
  })

  ctx.restore()
  return firstY
}

// ── Component ─────────────────────────────────────────────────────
export function PdfViewer({ url, page: targetPage = 1, snippet = null, highlightBbox = null, zoom = 1.0, onPageChange }) {
  const viewerRef = useRef(null)
  const areaRef   = useRef(null)
  const [status, setStatus] = useState('loading')
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    if (!url || !areaRef.current) return
    let cancelled = false
    setStatus('loading')
    setErrMsg('')

    let highlightInfo = null  // { pageIdx, canvasY }

    ;(async () => {
      try {
        const lib = await getPdfJs()
        if (cancelled) return

        const pdf  = await lib.getDocument(url).promise
        if (cancelled) return

        const area = areaRef.current
        area.innerHTML = ''

        const phrase = cleanSnippet(snippet)

        for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
          if (cancelled) return

          const pdfPage = await pdf.getPage(pNum)
          if (cancelled) return

          const vp = pdfPage.getViewport({ scale: 1.6 })   // fixed render scale — zoom is CSS-only

          const wrapper = document.createElement('div')
          wrapper.className = 'pdf-page-wrapper'

          const canvas  = document.createElement('canvas')
          canvas.width  = Math.floor(vp.width)
          canvas.height = Math.floor(vp.height)
          wrapper.appendChild(canvas)
          area.appendChild(wrapper)

          const ctx = canvas.getContext('2d')
          await pdfPage.render({ canvasContext: ctx, viewport: vp }).promise
          if (cancelled) return

          // ── Mode A: bbox coordinate highlight ──────────────────
          if (highlightBbox && pNum === (targetPage || 1) && !highlightInfo) {
            const firstY = drawBboxHighlight(ctx, vp, highlightBbox)
            if (firstY !== null) {
              highlightInfo = { pageIdx: pNum - 1, canvasY: firstY }
            }
          }

          // ── Mode B: text-search fallback ───────────────────────
          if (phrase && !highlightInfo) {
            const tc = await pdfPage.getTextContent()
            if (cancelled) return
            const matched = findMatchedItemIndices(tc.items, phrase)
            if (matched.size > 0) {
              const firstY = drawTextHighlights(ctx, vp, tc.items, matched)
              if (firstY !== null) highlightInfo = { pageIdx: pNum - 1, canvasY: firstY }
            }
          }
        }

        if (cancelled) return
        setStatus('ready')

        // ── Scroll to highlight ────────────────────────────────────
        setTimeout(() => {
          if (!areaRef.current || !viewerRef.current) return
          const pages = areaRef.current.querySelectorAll('.pdf-page-wrapper')

          if (highlightInfo) {
            const wrapper = pages[highlightInfo.pageIdx]
            if (wrapper) {
              const canvas   = wrapper.querySelector('canvas')
              const dispScale = canvas ? (canvas.clientWidth / canvas.width) : 1
              const hlCssY    = highlightInfo.canvasY * dispScale
              const target    = wrapper.offsetTop + hlCssY - viewerRef.current.clientHeight / 2
              viewerRef.current.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
            }
          } else if (targetPage > 1) {
            const wrapper = pages[targetPage - 1]
            if (wrapper) viewerRef.current.scrollTo({ top: wrapper.offsetTop - 20, behavior: 'smooth' })
          }
        }, 200)

      } catch (e) {
        if (!cancelled) { setErrMsg(e.message || 'Failed to load PDF'); setStatus('error') }
      }
    })()

    return () => { cancelled = true }
  }, [url, snippet, targetPage, highlightBbox])

  // ── Live page tracking via IntersectionObserver ─────────────────
  // Watches all .pdf-page-wrapper elements. Whichever has the highest
  // intersectionRatio (most visible) is the "current page".
  useEffect(() => {
    const area = areaRef.current
    if (!area || !onPageChange) return

    const map = new Map()   // element → page number

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => map.set(e.target, e.intersectionRatio))
        let bestEl = null, bestRatio = -1
        map.forEach((ratio, el) => {
          if (ratio > bestRatio) { bestRatio = ratio; bestEl = el }
        })
        if (bestEl) {
          const idx = Array.from(area.querySelectorAll('.pdf-page-wrapper')).indexOf(bestEl)
          if (idx !== -1) onPageChange(idx + 1)
        }
      },
      { root: viewerRef.current, threshold: Array.from({ length: 11 }, (_, i) => i / 10) }
    )

    // Observe pages once they are rendered (status = ready)
    const pages = area.querySelectorAll('.pdf-page-wrapper')
    pages.forEach((p, i) => { map.set(p, 0); observer.observe(p) })

    return () => observer.disconnect()
  }, [status, onPageChange])


  return (
    <div className="pdf-viewer" ref={viewerRef}>
      {status === 'loading' && (
        <div className="pdf-viewer__overlay">
          <div className="pdf-viewer__spinner" />
          <span className="pdf-viewer__overlay-text">Rendering PDF…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="pdf-viewer__overlay pdf-viewer__overlay--err">
          <span>⚠ {errMsg || 'Could not render PDF'}</span>
        </div>
      )}
      {/* zoom-wrap scales the canvas without affecting scroll container size.
           transformOrigin top-left + padding-bottom compensation lets the
           scaled canvas expand downward/rightward into scrollable space. */}
      <div className="pdf-viewer__zoom-wrap" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
        <div ref={areaRef} className="pdf-viewer__canvas-area" />
      </div>
    </div>
  )
}
