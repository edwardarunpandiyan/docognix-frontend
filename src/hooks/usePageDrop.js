/**
 * usePageDrop
 * ───────────
 * Attaches page-level drag-and-drop to any container ref.
 *
 * Counter-based approach:
 *   dragenter increments, dragleave decrements.
 *   Only show overlay when counter > 0.
 *   This prevents the overlay flickering off when the cursor
 *   moves over a child element (which fires dragLeave on the parent).
 *
 * Usage:
 *   const { isDragging, pageDropProps } = usePageDrop(handleFile)
 *   <div {...pageDropProps}>…</div>
 */
import { useState, useCallback, useRef } from 'react'

/**
 * @param {(file: File) => Promise<void>} onFile  - called with the first valid file
 * @param {boolean} [disabled=false]              - when true, drag events are ignored
 */
export function usePageDrop(onFile, disabled = false) {
  const [isDragging, setIsDragging] = useState(false)
  const counter = useRef(0)

  const onDragEnter = useCallback(e => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    counter.current += 1
    if (counter.current === 1) setIsDragging(true)
  }, [disabled])

  const onDragLeave = useCallback(e => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    counter.current -= 1
    if (counter.current <= 0) {
      counter.current = 0
      setIsDragging(false)
    }
  }, [disabled])

  const onDragOver = useCallback(e => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    // Set dropEffect so the OS shows a copy cursor instead of "not allowed"
    e.dataTransfer.dropEffect = 'copy'
  }, [disabled])

  const onDrop = useCallback(async e => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    counter.current = 0
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (!files?.length) return

    // Pick first PDF/DOCX/TXT — same logic as pickAllowedFile util
    const allowed = ['application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain']
    const allowedExts = ['.pdf', '.docx', '.txt']

    let picked = null
    for (const f of files) {
      const name = f.name.toLowerCase()
      if (allowed.includes(f.type) || allowedExts.some(ext => name.endsWith(ext))) {
        picked = f; break
      }
    }

    if (picked) await onFile?.(picked)
  }, [disabled, onFile])

  return {
    isDragging,
    pageDropProps: { onDragEnter, onDragLeave, onDragOver, onDrop },
  }
}
