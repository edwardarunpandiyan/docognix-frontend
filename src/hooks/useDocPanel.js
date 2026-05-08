/**
 * useDocPanel — manages doc panel state
 * Adds activeBbox for coordinate-based PDF highlighting.
 */
import { useState, useCallback } from 'react'

const INIT = {
  isOpen: false, view: 'list',
  activeDocId: null, activePage: null,
  activeSnippet: null, activeBbox: null,  // ← NEW: PDF bounding box
}

export function useDocPanel() {
  const [state, setState] = useState(INIT)

  const toggle = useCallback(() =>
    setState(p => p.isOpen ? INIT : { ...INIT, isOpen: true, view: 'list' }), [])

  /** openDoc(id, page, snippet, bbox) — all optional except id */
  const openDoc = useCallback((id, page = null, snippet = null, bbox = null) =>
    setState({ isOpen: true, view: 'doc', activeDocId: id, activePage: page, activeSnippet: snippet, activeBbox: bbox }), [])

  const showList = useCallback(() =>
    setState(p => ({ ...p, view: 'list', activeDocId: null, activePage: null, activeSnippet: null, activeBbox: null })), [])

  const close = useCallback(() => setState(INIT), [])

  return { ...state, toggle, openDoc, showList, close }
}
