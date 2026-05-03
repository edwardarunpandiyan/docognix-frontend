import { useState, useEffect } from 'react'

const BP = 1024

function classify(w) {
  if (w >= BP)  return 'desktop'
  if (w >= 768) return 'tablet'
  return 'mobile'
}

export function useBreakpoint() {
  const [bp, setBp] = useState(() => classify(window.innerWidth))
  useEffect(() => {
    const h = () => setBp(classify(window.innerWidth))
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return {
    breakpoint: bp,
    isMobile:         bp === 'mobile',
    isTablet:         bp === 'tablet',
    isDesktop:        bp === 'desktop',
    isMobileOrTablet: bp !== 'desktop',
  }
}
